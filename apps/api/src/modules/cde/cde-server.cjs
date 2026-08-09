const { createHash, timingSafeEqual } = require('crypto');
const { getPrismaClient } = require('../../database/prisma-client.cjs');
const { assertCsrf, requireUtmsSession, sessionContext } = require('../auth/auth-session-server.cjs');
const {
  assertLogicalSuccess,
  createCdeState,
  getDataSource,
  storeFormData,
} = require('./core-client.cjs');
const {
  createLoginChallenge,
  deleteCdeSession,
  getCdeSession,
  readLoginChallenge,
  setCdeSession,
} = require('./cde-session-store.cjs');
const { acquireCdeWriteLock } = require('./cde-write-lock.cjs');
const { normalizeSourcePath } = require('./data-service-compiler.cjs');
const { deleteObject, putEncryptedObject } = require('../playwright/object-store.cjs');
const { cancelQueuedRun, enqueueRun, enqueueSnapshot } = require('../playwright/playwright-queue.cjs');
const {
  bindingFingerprint,
  bindingForMapping,
  createDocument: createCouchTestDocument,
  getDocument: getCouchTestDocument,
  health: couchTestStoreHealth,
  listProjectDocuments: listCouchTestDocuments,
  storeDescriptor: couchStoreDescriptor,
  updateDocument: updateCouchTestDocument,
} = require('../playwright/couchdb-test-store.cjs');

const REPOSITORY_CONFIG = {
  WEB_UI: { mappingField: 'webUiRepoName', key: 'cde/repository/web-ui/list/fetch', root: 'web-ui', suffix: 'web-ui' },
  DATA_SERVICE: { mappingField: 'dataServiceRepoName', key: 'cde/repository/data-service/list/fetch', root: 'data-service', suffix: 'data-service' },
  API_MODULE: { mappingField: 'apiModuleRepoName', key: 'cde/repository/api-module/list/fetch', root: 'api-module', suffix: 'api-module' },
  MESSAGE_CONSUMER: { mappingField: 'messageConsumerRepoName', key: 'cde/repository/message-consumer/list/fetch', root: 'message-consumer', suffix: 'message-consumer' },
};
const BROWSABLE_REPOSITORY_TYPES = ['WEB_UI', 'DATA_SERVICE', 'API_MODULE', 'MESSAGE_CONSUMER'];
const TEST_FILE_PATTERN = /\.(?:spec\.(?:ts|js)|ts|js|json|md)$/i;
const RUNNABLE_PLAYWRIGHT_FILE_PATTERN = /(?:\.spec\.(?:ts|js)|\.test\.(?:ts|js)|\.js)$/i;
const CDE_EDITOR_ORIGIN = 'https://cde.edus.ir';

class CdeApiError extends Error {
  constructor(category, message, statusCode = 400, details) {
    super(message);
    this.category = category;
    this.statusCode = statusCode;
    this.details = details;
  }
}

function hash(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

function resultOf(response) {
  return response?.Result && typeof response.Result === 'object' ? response.Result : {};
}

function itemsOf(response) {
  const items = resultOf(response).items;
  if (!Array.isArray(items)) throw new CdeApiError('CDE_SCHEMA_ERROR', 'CDE response did not contain an items array.', 502);
  return items;
}

function displayCdeUser(loginUser) {
  if (!loginUser || typeof loginUser !== 'object') return null;
  return {
    firstName: String(loginUser.firstName || ''),
    lastName: String(loginUser.lastName || ''),
    displayName: `${loginUser.firstName || ''} ${loginUser.lastName || ''}`.trim(),
  };
}

function normalizeCdeLoginName(value) {
  const latinDigits = String(value || '')
    .trim()
    .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[\s()-]/g, '');
  const local = latinDigits
    .replace(/^\+98/, '')
    .replace(/^0098/, '')
    .replace(/^98/, '')
    .replace(/^0(?=9)/, '');
  return /^9\d{9}$/.test(local) ? local : '';
}

function requireCdePasswordStep(response) {
  const result = resultOf(response);
  const nextStep = typeof result.nextStep === 'string' ? result.nextStep.trim().toLowerCase() : '';
  if (nextStep === 'password') return 'password';
  throw new CdeApiError(
    'CDE_ACCOUNT_NOT_FOUND',
    'This cellphone is not registered for the selected CDE user source.',
    404,
    nextStep ? { nextStep } : undefined,
  );
}

function assertApplicationScope(req, applicationId) {
  const { context } = requireUtmsSession(req);
  if (context.role === 'SYSTEM_ADMIN') return context;
  if (!context.scopeApplicationIds?.includes(String(applicationId))) {
    throw new CdeApiError('APPLICATION_ACCESS_DENIED', 'The active UTMS context cannot access this Application.', 403);
  }
  return context;
}

function assertSystemAdmin(req) {
  const { context } = requireUtmsSession(req);
  if (context.role !== 'SYSTEM_ADMIN') throw new CdeApiError('ADMIN_REQUIRED', 'System Administrator access is required.', 403);
  return context;
}

function assertAutomatedTestAccess(req) {
  const { context } = requireUtmsSession(req);
  if (!['SYSTEM_ADMIN', 'QA_LEAD', 'QA_SPECIALIST'].includes(context.role)) {
    throw new CdeApiError('PLAYWRIGHT_ACCESS_DENIED', 'The active role cannot manage Playwright files.', 403);
  }
  if (context.role === 'QA_SPECIALIST' && context.automatedTestsEnabled === false) {
    throw new CdeApiError('PLAYWRIGHT_ACCESS_DENIED', 'Automated tests are disabled for this role assignment.', 403);
  }
  return context;
}

async function loadCdeState(req) {
  const { session } = requireUtmsSession(req);
  const state = await getCdeSession(session.id);
  if (!state) throw new CdeApiError('CDE_NOT_CONNECTED', 'Connect a CDE account before using this feature.', 401);
  return state;
}

async function persistCoreResult(req, callResult) {
  const { session } = requireUtmsSession(req);
  await setCdeSession(session.id, callResult.state);
  return callResult.response;
}

async function callDataSource(req, key, params = {}, options = {}) {
  const state = options.state || await loadCdeState(req);
  const callResult = await getDataSource(state, key, params);
  const response = await persistCoreResult(req, callResult);
  assertLogicalSuccess(response);
  if (options.requireLogin !== false && resultOf(response).IsUserLogin === false) {
    await deleteCdeSession(req.utmsSession.id);
    throw new CdeApiError('CDE_RECONNECT_REQUIRED', 'The CDE session has expired. Connect again.', 401);
  }
  return response;
}

async function cdeStatus(req) {
  const state = await getCdeSession(requireUtmsSession(req).session.id);
  if (!state) return { connected: false };
  try {
    const response = await callDataSource(req, 'pages-app/who-am-i', {}, { state, requireLogin: false });
    const result = resultOf(response);
    if (!result.IsUserLogin) {
      await deleteCdeSession(req.utmsSession.id);
      return { connected: false, reconnectRequired: true };
    }
    return { connected: true, user: displayCdeUser(result.LoginUser), ecreq: Boolean(result.ecreq) };
  } catch (error) {
    if (error.category === 'CDE_RECONNECT_REQUIRED') return { connected: false, reconnectRequired: true };
    throw error;
  }
}

async function startCdeLogin(req, body) {
  assertCsrf(req);
  const { session } = requireUtmsSession(req);
  const userLoginName = normalizeCdeLoginName(body.userLoginName);
  if (!userLoginName) throw new CdeApiError('CDE_LOGIN_NAME_INVALID', 'Enter a valid Iranian cellphone number.', 400);
  await deleteCdeSession(session.id);
  let state = createCdeState();
  let callResult = await getDataSource(state, 'pages-app/who-am-i', {});
  state = callResult.state;
  if (resultOf(callResult.response).IsUserLogin) {
    await setCdeSession(session.id, state);
    return { connected: true, user: displayCdeUser(resultOf(callResult.response).LoginUser) };
  }
  callResult = await storeFormData(state, 'auth/signin/iran-cellphone', {
    userSource: 'rayadevelopers',
    userLoginName,
  });
  assertLogicalSuccess(callResult.response);
  const loginResult = resultOf(callResult.response);
  if (loginResult.IsUserLogin === true) {
    await setCdeSession(session.id, callResult.state);
    return { connected: true, user: displayCdeUser(loginResult.LoginUser), ecreq: Boolean(loginResult.ecreq) };
  }
  const nextStep = requireCdePasswordStep(callResult.response);
  await setCdeSession(session.id, callResult.state, 5 * 60);
  return {
    connected: false,
    nextStep,
    challenge: createLoginChallenge(session.id, userLoginName),
  };
}

async function finishCdePassword(req, body) {
  assertCsrf(req);
  const { session } = requireUtmsSession(req);
  const password = String(body.password || '');
  if (!password || !body.challenge) throw new CdeApiError('CDE_PASSWORD_REQUIRED', 'Password and login challenge are required.', 400);
  let userLoginName;
  try {
    userLoginName = readLoginChallenge(session.id, String(body.challenge));
  } catch {
    throw new CdeApiError('CDE_LOGIN_CHALLENGE_EXPIRED', 'The CDE login challenge expired. Start again.', 401);
  }
  const state = await loadCdeState(req);
  let callResult = await storeFormData(state, 'auth/signin/check-password', {
    userSource: 'rayadevelopers',
    userLoginName,
    contact: 'iran-cellphone',
    password,
  });
  try {
    assertLogicalSuccess(callResult.response);
  } catch (error) {
    await setCdeSession(session.id, callResult.state, 5 * 60);
    if (error.category === 'CDE_LOGICAL_ERROR') {
      throw new CdeApiError('CDE_INVALID_CREDENTIALS', 'The CDE password is incorrect.', 401);
    }
    throw error;
  }
  callResult = await getDataSource(callResult.state, 'pages-app/who-am-i', {});
  const result = resultOf(callResult.response);
  if (!result.IsUserLogin) {
    await setCdeSession(session.id, callResult.state, 5 * 60);
    throw new CdeApiError('CDE_INVALID_CREDENTIALS', 'The CDE password is incorrect.', 401);
  }
  await setCdeSession(session.id, callResult.state);
  return { connected: true, user: displayCdeUser(result.LoginUser), ecreq: Boolean(result.ecreq) };
}

async function disconnectCde(req) {
  assertCsrf(req);
  await deleteCdeSession(requireUtmsSession(req).session.id);
  return { connected: false };
}

async function accessibleProjects(req, force = false) {
  const state = await loadCdeState(req);
  if (!force && Array.isArray(state.accessibleProjects) && Date.now() - Number(state.accessibleProjectsAt || 0) < 60_000) {
    return state.accessibleProjects;
  }
  const response = await callDataSource(req, 'cde/repository/list/my-repo', {}, { state });
  const projects = itemsOf(response).map(item => typeof item === 'string' ? item.trim() : '').filter(Boolean);
  state.accessibleProjects = Array.from(new Set(projects));
  state.accessibleProjectsAt = Date.now();
  await setCdeSession(req.utmsSession.id, state);
  return state.accessibleProjects;
}

function normalizeProjectKey(value) {
  const projectKey = String(value || '').trim();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,254}$/.test(projectKey)) {
    throw new CdeApiError('CDE_PROJECT_INVALID', 'CDE project key is invalid.', 400);
  }
  return projectKey;
}

function projectRepositoryName(projectKey, repositoryType) {
  const normalizedProjectKey = normalizeProjectKey(projectKey);
  const config = REPOSITORY_CONFIG[String(repositoryType || '')];
  if (!config || !BROWSABLE_REPOSITORY_TYPES.includes(String(repositoryType))) {
    throw new CdeApiError('CDE_REPOSITORY_TYPE_INVALID', 'Repository type is not browsable.', 400);
  }
  return `${normalizedProjectKey}/${config.suffix}`;
}

async function assertAccessibleProject(req, projectKey) {
  const normalizedProjectKey = normalizeProjectKey(projectKey);
  const projects = await accessibleProjects(req);
  if (!projects.includes(normalizedProjectKey)) {
    throw new CdeApiError('CDE_PROJECT_ACCESS_DENIED', 'The connected CDE account cannot access this project.', 403);
  }
  return normalizedProjectKey;
}

function projectDescriptor(projectKey) {
  const normalizedProjectKey = normalizeProjectKey(projectKey);
  const encodedProject = encodeURIComponent(normalizedProjectKey);
  const encodedApp = encodeURIComponent(`${normalizedProjectKey}>App`);
  const encodedGateway = encodeURIComponent(`${normalizedProjectKey}>`);
  return {
    projectKey: normalizedProjectKey,
    repositories: Object.fromEntries(BROWSABLE_REPOSITORY_TYPES.map(repositoryType => [
      repositoryType,
      projectRepositoryName(normalizedProjectKey, repositoryType),
    ])),
    editorUrls: {
      webUi: `${CDE_EDITOR_ORIGIN}/front/directory/${encodedApp}`,
      dataService: `${CDE_EDITOR_ORIGIN}/dservice/directory/${encodedApp}`,
      gateway: `${CDE_EDITOR_ORIGIN}/back/${encodedProject}/${encodedGateway}?return=/workspace/${encodedProject}`,
    },
  };
}

async function browseProjects(req) {
  return (await accessibleProjects(req)).map(projectDescriptor);
}

async function mappingForApplication(req, applicationId) {
  assertApplicationScope(req, applicationId);
  const mapping = await getPrismaClient().cdeApplicationMapping.findUnique({ where: { applicationId: String(applicationId) } });
  if (!mapping?.enabled) throw new CdeApiError('CDE_MAPPING_NOT_FOUND', 'This Application does not have an enabled CDE mapping.', 404);
  const projects = await accessibleProjects(req);
  if (!projects.includes(mapping.projectKey)) {
    throw new CdeApiError('CDE_PROJECT_ACCESS_DENIED', 'The connected CDE account cannot access the mapped project.', 403);
  }
  return mapping;
}

function repositoryBranches(item, repositoryType) {
  const branches = [];
  if (item?.public && typeof item.public === 'object' && Object.keys(item.public).length) {
    branches.push({
      selector: { kind: 'PUBLIC' },
      versionId: item.public.versionId || null,
      editable: false,
      meta: item.public.meta || {},
      value: item.public,
    });
  }
  (Array.isArray(item?.personal) ? item.personal : []).forEach((branch, index) => {
    branches.push({
      selector: {
        kind: 'PERSONAL',
        ...(branch.rand_id ? { randId: String(branch.rand_id) } : {}),
        index: Number.isInteger(branch.index) ? branch.index : index,
      },
      versionId: branch.versionId || null,
      editable: branch.editable === true,
      meta: branch.meta || {},
      value: branch,
    });
  });
  return branches.map(branch => ({ ...branch, repositoryType }));
}

function branchSummaries(branches) {
  return branches.map(({ selector, versionId, editable, meta }) => ({ selector, versionId, editable, meta }));
}

function publicBranch(branch) {
  return branch.selector.kind === 'PUBLIC';
}

function selectorMatches(branch, selector) {
  if (!selector || selector.kind !== branch.selector.kind) return false;
  if (selector.kind === 'PUBLIC') return true;
  if (selector.randId) return selector.randId === branch.selector.randId;
  return Number.isInteger(selector.index) && selector.index === branch.selector.index;
}

async function rememberedSelection(userId, applicationId, repositoryType, repoName, packId) {
  return getPrismaClient().cdeBranchSelection.findUnique({
    where: {
      userId_applicationId_repositoryType_repoName_packId: {
        userId, applicationId, repositoryType, repoName, packId,
      },
    },
  });
}

function selectorFromRow(row) {
  if (!row) return null;
  return row.branchKind === 'PUBLIC'
    ? { kind: 'PUBLIC' }
    : { kind: 'PERSONAL', ...(row.branchRandId ? { randId: row.branchRandId } : {}), ...(Number.isInteger(row.branchIndex) ? { index: row.branchIndex } : {}) };
}

async function resolveBranch(req, applicationId, repositoryType, repoName, packId, item, requestedSelector) {
  const branches = repositoryBranches(item, repositoryType);
  let selector = requestedSelector;
  if (!selector) {
    const remembered = await rememberedSelection(req.utmsContext.userId, applicationId, repositoryType, repoName, packId);
    selector = selectorFromRow(remembered);
  }
  let branch = selector ? branches.find(candidate => selectorMatches(candidate, selector)) : null;
  if (!branch && branches.length === 1) branch = branches[0];
  if (!branch) {
    throw new CdeApiError('BRANCH_SELECTION_REQUIRED', 'Select one accessible CDE branch before opening this package.', 409, {
      branches: branches.map(({ selector: branchSelector, versionId, editable, meta }) => ({ selector: branchSelector, versionId, editable, meta })),
    });
  }
  return branch;
}

function packageSummary(item, repositoryType) {
  const id = String(item?.id || item?._id || '');
  return {
    id,
    branches: repositoryBranches(item, repositoryType).map(({ selector, versionId, editable, meta }) => ({ selector, versionId, editable, meta })),
  };
}

function packagesFromResponse(response, repositoryType) {
  return itemsOf(response).map(item => typeof item === 'string' ? { id: item, branches: [] } : packageSummary(item, repositoryType));
}

async function repositoryList(req, mapping, repositoryType) {
  const config = REPOSITORY_CONFIG[repositoryType];
  const repoName = mapping[config.mappingField];
  if (!repoName) return null;
  const response = await callDataSource(req, config.key, { repoName });
  return {
    type: repositoryType,
    repoName,
    packages: packagesFromResponse(response, repositoryType),
  };
}

async function browseProjectCatalog(req, projectKey) {
  const accessibleProjectKey = await assertAccessibleProject(req, projectKey);
  const repositories = [];
  for (const repositoryType of BROWSABLE_REPOSITORY_TYPES) {
    const config = REPOSITORY_CONFIG[repositoryType];
    const repoName = projectRepositoryName(accessibleProjectKey, repositoryType);
    try {
      const response = await callDataSource(req, config.key, { repoName });
      repositories.push({
        type: repositoryType,
        repoName,
        packages: packagesFromResponse(response, repositoryType),
      });
    } catch (error) {
      if (['CDE_NOT_CONNECTED', 'CDE_RECONNECT_REQUIRED'].includes(error.category)) throw error;
      repositories.push({
        type: repositoryType,
        repoName,
        packages: [],
        error: {
          code: error.category || 'CDE_REPOSITORY_LOAD_FAILED',
          message: error.message || 'CDE repository could not be loaded.',
        },
      });
    }
  }
  return { projectKey: accessibleProjectKey, repositories };
}

async function visibleApplications(req) {
  const { context } = requireUtmsSession(req);
  const applicationIds = context.role === 'SYSTEM_ADMIN' ? undefined : context.scopeApplicationIds;
  const projects = new Set(await accessibleProjects(req));
  const applications = await getPrismaClient().application.findMany({
    where: {
      isActive: true,
      ...(applicationIds ? { id: { in: applicationIds } } : {}),
      cdeMapping: { is: { enabled: true } },
    },
    include: {
      cdeMapping: true,
      applicationEnvironments: { where: environmentAvailabilityWhere(), orderBy: { name: 'asc' } },
    },
    orderBy: { name: 'asc' },
  });
  return applications.filter(application => projects.has(application.cdeMapping.projectKey)).map(application => ({
    id: application.id,
    name: application.name,
    code: application.code,
    projectKey: application.cdeMapping.projectKey,
    repositories: {
      webUi: application.cdeMapping.webUiRepoName,
      dataService: application.cdeMapping.dataServiceRepoName,
      apiModule: application.cdeMapping.apiModuleRepoName,
      messageConsumer: application.cdeMapping.messageConsumerRepoName,
      tests: `couchdb://${couchStoreDescriptor().database}/${application.cdeMapping.projectKey}`,
    },
    environments: application.applicationEnvironments.map(row => serializeEnvironment(row)),
  }));
}

async function catalog(req, applicationId) {
  const mapping = await mappingForApplication(req, applicationId);
  const repositories = [];
  for (const repositoryType of ['WEB_UI', 'DATA_SERVICE', 'API_MODULE', 'MESSAGE_CONSUMER']) {
    const repository = await repositoryList(req, mapping, repositoryType);
    if (repository) repositories.push(repository);
  }
  repositories.push({
    type: 'TESTS',
    repoName: couchStoreDescriptor().database,
    storage: 'COUCHDB',
    packages: [{ id: `playwright/${mapping.projectKey}`, branches: [], configured: true }],
  });
  return { applicationId, projectKey: mapping.projectKey, repositories };
}

function normalizeRemoteFiles(branch, repositoryType, packId) {
  if (repositoryType === 'API_MODULE') {
    return [{
      path: `${String(packId).replace(/^ds\//, '')}.js`,
      code: String(branch.value.actions || ''),
      language: 'javascript',
      readOnly: true,
    }];
  }
  const files = branch.value?.content?.content;
  if (!Array.isArray(files)) throw new CdeApiError('CDE_SCHEMA_ERROR', 'The selected CDE branch has no source file array.', 502);
  const seen = new Set();
  return files.map(file => {
    let path;
    try { path = normalizeSourcePath(file.name); } catch (error) { throw new CdeApiError('CDE_UNSAFE_PATH', error.message, 422); }
    const folded = path.toLocaleLowerCase('en-US');
    if (seen.has(folded)) throw new CdeApiError('CDE_PATH_COLLISION', 'CDE package contains duplicate or case-colliding paths.', 422);
    seen.add(folded);
    return { path, code: String(file.code ?? ''), readOnly: repositoryType !== 'TESTS' || !branch.editable };
  });
}

async function loadPackageItem(req, mapping, repositoryType, repoName, packId) {
  const config = REPOSITORY_CONFIG[repositoryType];
  if (!config) throw new CdeApiError('CDE_REPOSITORY_TYPE_INVALID', 'Repository type is invalid.', 400);
  if (mapping[config.mappingField] !== repoName) throw new CdeApiError('CDE_REPOSITORY_NOT_MAPPED', 'Repository is not mapped to this Application.', 403);
  if (repositoryType === 'API_MODULE') {
    const list = await callDataSource(req, config.key, { repoName });
    const item = itemsOf(list).find(candidate => candidate?.id === packId);
    if (!item) throw new CdeApiError('CDE_PACKAGE_NOT_FOUND', 'API Module was not found.', 404);
    return item;
  }
  const response = await callDataSource(req, 'cde/package/any/one/fetch', { repoName, packId });
  const pack = resultOf(response).pack;
  if (!pack || typeof pack !== 'object') throw new CdeApiError('CDE_PACKAGE_NOT_FOUND', 'CDE package was not found.', 404);
  return pack;
}

async function browseProjectPackage(req, projectKey, body) {
  const accessibleProjectKey = await assertAccessibleProject(req, projectKey);
  const repositoryType = String(body.repositoryType || '');
  const config = REPOSITORY_CONFIG[repositoryType];
  if (!config || !BROWSABLE_REPOSITORY_TYPES.includes(repositoryType)) {
    throw new CdeApiError('CDE_REPOSITORY_TYPE_INVALID', 'Repository type is not browsable.', 400);
  }
  const repoName = projectRepositoryName(accessibleProjectKey, repositoryType);
  const packId = String(body.packId || '');
  const list = await callDataSource(req, config.key, { repoName });
  const listedItem = itemsOf(list).find(candidate => String(candidate?.id || candidate?._id || candidate || '') === packId);
  if (!listedItem) throw new CdeApiError('CDE_PACKAGE_NOT_FOUND', 'CDE package was not found in the selected repository.', 404);

  let item = listedItem;
  if (repositoryType !== 'API_MODULE') {
    const response = await callDataSource(req, 'cde/package/any/one/fetch', { repoName, packId });
    item = resultOf(response).pack;
    if (!item || typeof item !== 'object') throw new CdeApiError('CDE_PACKAGE_NOT_FOUND', 'CDE package was not found.', 404);
  }

  const branches = repositoryBranches(item, repositoryType);
  const requestedSelector = body.branch || null;
  let branch = requestedSelector ? branches.find(candidate => selectorMatches(candidate, requestedSelector)) : null;
  if (!branch && branches.length === 1) branch = branches[0];
  if (!branch) {
    throw new CdeApiError('BRANCH_SELECTION_REQUIRED', 'Select one accessible CDE branch before opening this package.', 409, {
      branches: branches.map(({ selector, versionId, editable, meta }) => ({ selector, versionId, editable, meta })),
    });
  }

  return {
    projectKey: accessibleProjectKey,
    repositoryType,
    repoName,
    packId,
    branches: branchSummaries(branches),
    branch: { selector: branch.selector, versionId: branch.versionId, editable: branch.editable, meta: branch.meta },
    files: normalizeRemoteFiles(branch, repositoryType, packId),
  };
}

async function packageContent(req, applicationId, body) {
  const mapping = await mappingForApplication(req, applicationId);
  const repositoryType = String(body.repositoryType || '');
  const repoName = String(body.repoName || '');
  const packId = String(body.packId || '');
  const item = await loadPackageItem(req, mapping, repositoryType, repoName, packId);
  const branch = await resolveBranch(req, String(applicationId), repositoryType, repoName, packId, item, body.branch || null);
  const branches = repositoryBranches(item, repositoryType);
  return {
    applicationId,
    repositoryType,
    repoName,
    packId,
    branches: branchSummaries(branches),
    branch: { selector: branch.selector, versionId: branch.versionId, editable: branch.editable, meta: branch.meta },
    files: normalizeRemoteFiles(branch, repositoryType, packId),
  };
}

async function saveBranchSelection(req, applicationId, body) {
  assertCsrf(req);
  const mapping = await mappingForApplication(req, applicationId);
  const repositoryType = String(body.repositoryType || '');
  const config = REPOSITORY_CONFIG[repositoryType];
  if (!config) throw new CdeApiError('CDE_REPOSITORY_TYPE_INVALID', 'Repository type is invalid.', 400);
  if (mapping[config.mappingField] !== body.repoName) throw new CdeApiError('CDE_REPOSITORY_NOT_MAPPED', 'Repository is not mapped.', 403);
  const selector = body.branch || {};
  if (!['PUBLIC', 'PERSONAL'].includes(selector.kind)) throw new CdeApiError('CDE_BRANCH_INVALID', 'Branch selector is invalid.', 400);
  const item = await loadPackageItem(req, mapping, repositoryType, String(body.repoName), String(body.packId));
  const branch = repositoryBranches(item, repositoryType).find(candidate => selectorMatches(candidate, selector));
  if (!branch) throw new CdeApiError('CDE_BRANCH_NOT_FOUND', 'Selected branch is no longer accessible.', 404);
  const row = await getPrismaClient().cdeBranchSelection.upsert({
    where: { userId_applicationId_repositoryType_repoName_packId: {
      userId: req.utmsContext.userId,
      applicationId: String(applicationId),
      repositoryType,
      repoName: String(body.repoName),
      packId: String(body.packId),
    } },
    create: {
      userId: req.utmsContext.userId,
      applicationId: String(applicationId),
      repositoryType,
      repoName: String(body.repoName),
      packId: String(body.packId),
      branchKind: selector.kind,
      branchRandId: selector.randId || null,
      branchIndex: Number.isInteger(selector.index) ? selector.index : null,
      lastSeenVersionId: branch.versionId,
    },
    update: {
      branchKind: selector.kind,
      branchRandId: selector.randId || null,
      branchIndex: Number.isInteger(selector.index) ? selector.index : null,
      lastSeenVersionId: branch.versionId,
    },
  });
  return { id: row.id, branch: selector, versionId: row.lastSeenVersionId };
}

function validateMappingPayload(applicationId, body) {
  const projectKey = String(body.projectKey || '').trim();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{1,254}$/.test(projectKey)) {
    throw new CdeApiError('CDE_MAPPING_INVALID', 'CDE project key is invalid.', 400);
  }
  const repo = (value, suffix, required = false) => {
    const normalized = String(value || '').trim();
    if (!normalized && !required) return null;
    if (!normalized || !normalized.endsWith(`/${suffix}`) || normalized.includes('..')) {
      throw new CdeApiError('CDE_MAPPING_INVALID', `Repository must end with /${suffix}.`, 400);
    }
    return normalized;
  };
  return {
    applicationId: String(applicationId),
    serviceId: 'cde.edus.ir',
    projectKey,
    webUiRepoName: repo(body.webUiRepoName || `${projectKey}/web-ui`, 'web-ui'),
    dataServiceRepoName: repo(body.dataServiceRepoName || `${projectKey}/data-service`, 'data-service'),
    apiModuleRepoName: repo(body.apiModuleRepoName || `${projectKey}/api-module`, 'api-module'),
    messageConsumerRepoName: repo(body.messageConsumerRepoName, 'message-consumer'),
    // These columns remain nullable only for compatibility with mappings made
    // before CouchDB became the authoritative Playwright test store.
    testRepoName: null,
    testPackId: null,
    testBranchRandId: null,
    testBranchIndex: null,
    enabled: body.enabled !== false,
  };
}

async function putMapping(req, applicationId, body) {
  assertSystemAdmin(req);
  assertCsrf(req);
  const prisma = getPrismaClient();
  const application = await prisma.application.findUnique({ where: { id: String(applicationId) } });
  if (!application) throw new CdeApiError('APPLICATION_NOT_FOUND', 'Application was not found.', 404);
  const data = validateMappingPayload(applicationId, body);
  const mapping = await prisma.cdeApplicationMapping.upsert({
    where: { applicationId: String(applicationId) },
    create: data,
    update: data,
  });
  return mapping;
}

async function getMapping(req, applicationId) {
  assertSystemAdmin(req);
  const mapping = await getPrismaClient().cdeApplicationMapping.findUnique({
    where: { applicationId: String(applicationId) },
  });
  if (!mapping) throw new CdeApiError('CDE_MAPPING_NOT_FOUND', 'This Application does not have a CDE mapping.', 404);
  return mapping;
}

async function validateMapping(req, applicationId) {
  assertSystemAdmin(req);
  assertCsrf(req);
  const prisma = getPrismaClient();
  const mapping = await mappingForApplication(req, applicationId);
  try {
    const storage = await couchTestStoreHealth();
    await prisma.cdeApplicationMapping.update({
      where: { applicationId: String(applicationId) },
      data: { lastValidationStatus: 'HEALTHY', lastValidatedAt: new Date() },
    });
    return { valid: true, storage, projectKey: mapping.projectKey };
  } catch (error) {
    await prisma.cdeApplicationMapping.update({
      where: { applicationId: String(applicationId) },
      data: { lastValidationStatus: error.category || 'FAILED', lastValidatedAt: new Date() },
    });
    throw error;
  }
}

function testDisplayPath(remotePath) {
  return remotePath.startsWith('tests/') ? remotePath : `tests/${remotePath}`;
}

function testFileDto(row) {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    syncedAt: row.syncedAt?.toISOString(),
    createdBy: row.createdBy ? {
      id: row.createdBy.id,
      fullName: row.createdBy.fullName,
      phoneNumber: row.createdBy.phoneNumber,
      isActive: row.createdBy.isActive,
    } : undefined,
  };
}

function couchRootUrl(mapping) {
  return `couchdb://${couchStoreDescriptor().database}/${mapping.projectKey}`;
}

function normalizedCouchDocuments(documents) {
  const seen = new Set();
  return documents.map(document => {
    let path;
    try { path = normalizeTestPath(document.path); } catch (error) { throw new CdeApiError('COUCHDB_DOCUMENT_INVALID', error.message, 422); }
    const folded = path.toLocaleLowerCase('en-US');
    if (seen.has(folded)) throw new CdeApiError('COUCHDB_PATH_COLLISION', 'CouchDB contains duplicate or case-colliding Playwright paths.', 409);
    seen.add(folded);
    return { ...document, path };
  });
}

async function projectTestDocuments(applicationId, mapping) {
  return normalizedCouchDocuments(await listCouchTestDocuments(String(applicationId), bindingForMapping(mapping)));
}

async function syncCouchTestFiles(req, applicationId, mapping, suppliedDocuments) {
  const prisma = getPrismaClient();
  const documents = suppliedDocuments || await projectTestDocuments(applicationId, mapping);
  const synced = [];
  for (const document of documents) {
    const fullPath = testDisplayPath(document.path);
    const slash = fullPath.lastIndexOf('/');
    const folderPath = slash >= 0 ? fullPath.slice(0, slash) : 'tests';
    const fileName = slash >= 0 ? fullPath.slice(slash + 1) : fullPath;
    const shared = {
      rootKind: 'TESTS',
      rootUrl: couchRootUrl(mapping),
      source: 'COUCHDB',
      folderPath,
      relativeFolderPath: folderPath.replace(/^tests\/?/, ''),
      fileName,
      script: String(document.script || ''),
      remoteRepoName: mapping.projectKey,
      remotePackId: document._id,
      remoteBranchKind: null,
      remoteBranchRandId: null,
      remoteBranchIndex: null,
      remoteVersionId: document._rev,
      remotePath: document.path,
      sourceHash: document.sourceHash || hash(document.script || ''),
      syncedAt: new Date(),
      couchDocumentId: document._id,
      couchRevision: document._rev,
      cdeBinding: document.cdeBinding,
      description: document.description ? String(document.description).slice(0, 700) : null,
    };
    const existingByDocument = await prisma.playwrightTestFile.findUnique({ where: { couchDocumentId: document._id } });
    const row = existingByDocument
      ? await prisma.playwrightTestFile.update({
        where: { id: existingByDocument.id },
        data: { fullPath, ...shared },
        include: { createdBy: true },
      })
      : await prisma.playwrightTestFile.upsert({
        where: { applicationId_fullPath: { applicationId: String(applicationId), fullPath } },
        create: {
          applicationId: String(applicationId),
          fullPath,
          createdById: String(document.createdById || req.utmsContext.userId),
          ...shared,
        },
        update: shared,
        include: { createdBy: true },
      });
    synced.push(row);
  }
  return synced;
}

function derivedTestFolders(files) {
  const folders = new Set(['tests']);
  files.forEach(file => {
    const parts = file.fullPath.split('/');
    for (let index = 1; index < parts.length; index += 1) folders.add(parts.slice(0, index).join('/'));
  });
  return Array.from(folders).sort().map(path => ({
    id: `tests:${path}`,
    rootKind: 'TESTS',
    rootUrl: 'cde://tests',
    relativePath: path.replace(/^tests\/?/, ''),
    fullPath: path,
  }));
}

async function listTestFiles(req, applicationId, parsedUrl) {
  assertAutomatedTestAccess(req);
  const mapping = await mappingForApplication(req, applicationId);
  const documents = await projectTestDocuments(applicationId, mapping);
  const remoteRows = await syncCouchTestFiles(req, applicationId, mapping, documents);
  const remotePaths = new Set(remoteRows.map(row => row.fullPath));
  const legacy = await getPrismaClient().playwrightTestFile.findMany({
    where: { applicationId: String(applicationId), source: { in: ['MANAGED', 'DISCOVERED', 'CDE'] } },
    include: { createdBy: true },
    orderBy: { updatedAt: 'desc' },
  });
  let files = [...remoteRows, ...legacy.filter(row => !remotePaths.has(row.fullPath))].map(testFileDto);
  const search = String(parsedUrl.searchParams.get('search') || '').trim().toLowerCase();
  if (search) files = files.filter(file => `${file.fileName} ${file.fullPath} ${file.description || ''} ${file.script}`.toLowerCase().includes(search));
  const page = Math.max(1, Number(parsedUrl.searchParams.get('page') || 1));
  const limit = Math.min(100, Math.max(1, Number(parsedUrl.searchParams.get('limit') || 20)));
  return {
    files: {
      data: files.slice((page - 1) * limit, page * limit),
      total: files.length,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(files.length / limit)),
    },
    folders: derivedTestFolders(files),
    storage: {
      ...couchStoreDescriptor(),
      projectKey: mapping.projectKey,
      bindingFingerprint: bindingFingerprint(bindingForMapping(mapping)),
      editable: true,
    },
    branch: { versionId: null, editable: true, storage: 'COUCHDB' },
  };
}

function normalizeTestPath(value) {
  let path;
  try { path = normalizeSourcePath(value); } catch (error) { throw new CdeApiError('PLAYWRIGHT_PATH_INVALID', error.message, 422); }
  if (!path.startsWith('tests/')) path = `tests/${path}`;
  if (!TEST_FILE_PATTERN.test(path)) throw new CdeApiError('PLAYWRIGHT_FILE_TYPE_INVALID', 'Playwright package files must be spec.ts, spec.js, ts, js, json, or md.', 422);
  return path;
}

async function writeTestFile(req, applicationId, body, existingId) {
  assertAutomatedTestAccess(req);
  assertCsrf(req);
  const prisma = getPrismaClient();
  let existing = null;
  if (existingId) {
    existing = await prisma.playwrightTestFile.findFirst({ where: { id: existingId, applicationId: String(applicationId), source: 'COUCHDB' } });
    if (!existing?.couchDocumentId) throw new CdeApiError('PLAYWRIGHT_FILE_NOT_FOUND', 'CouchDB Playwright file was not found.', 404);
  }
  const targetPath = normalizeTestPath(body.path || existing?.remotePath || existing?.fullPath || '');
  const source = String(body.script ?? body.code ?? '');
  if (!source.trim()) throw new CdeApiError('PLAYWRIGHT_SCRIPT_REQUIRED', 'Playwright source is required.', 422);
  if (Buffer.byteLength(source) > 2 * 1024 * 1024) throw new CdeApiError('PLAYWRIGHT_FILE_TOO_LARGE', 'Playwright file exceeds two MiB.', 413);
  const mapping = await mappingForApplication(req, applicationId);
  const cdeBinding = bindingForMapping(mapping);
  const fingerprint = bindingFingerprint(cdeBinding);
  const lockIdentity = hash(`couchdb\0${applicationId}\0${fingerprint}\0${targetPath.toLocaleLowerCase('en-US')}`);
  const release = await acquireCdeWriteLock(lockIdentity, 60_000);
  if (!release) throw new CdeApiError('COUCHDB_WRITE_BUSY', 'Another save is already updating this Playwright path.', 409);
  try {
    const documents = await projectTestDocuments(applicationId, mapping);
    const previousPath = existing?.remotePath || existing?.fullPath || null;
    const collision = documents.find(document => document.path.toLocaleLowerCase('en-US') === targetPath.toLocaleLowerCase('en-US') && document._id !== existing?.couchDocumentId);
    if (collision) throw new CdeApiError('PLAYWRIGHT_TEST_FILE_ALREADY_EXISTS', 'A Playwright file already exists at this CouchDB path.', 409);
    const indexedCollision = await prisma.playwrightTestFile.findFirst({
      where: { applicationId: String(applicationId), fullPath: { equals: targetPath, mode: 'insensitive' }, ...(existing ? { id: { not: existing.id } } : {}) },
    });
    if (indexedCollision) throw new CdeApiError('PLAYWRIGHT_TEST_FILE_ALREADY_EXISTS', 'A legacy or CouchDB file already uses this path.', 409);
    let saved;
    if (existing) {
      const current = await getCouchTestDocument(existing.couchDocumentId, { applicationId: String(applicationId), bindingFingerprint: fingerprint });
      if (!current) throw new CdeApiError('PLAYWRIGHT_FILE_NOT_FOUND', 'The CouchDB Playwright document no longer exists.', 404);
      saved = await updateCouchTestDocument(current, {
        path: targetPath,
        script: source,
        description: body.description ? String(body.description).slice(0, 700) : null,
        userId: req.utmsContext.userId,
        expectedRevision: body.expectedRevision || body.expectedVersionId,
      });
    } else {
      saved = await createCouchTestDocument({
        applicationId: String(applicationId),
        path: targetPath,
        script: source,
        description: body.description ? String(body.description).slice(0, 700) : null,
        userId: req.utmsContext.userId,
        cdeBinding,
      });
    }
    const verified = await getCouchTestDocument(saved._id, { applicationId: String(applicationId), bindingFingerprint: fingerprint });
    if (!verified || verified._rev !== saved._rev || hash(verified.script) !== hash(source)) {
      throw new CdeApiError('COUCHDB_WRITE_CONFLICT', 'The saved Playwright document could not be verified.', 409, { savedRevision: saved._rev });
    }
    const refreshedDocuments = await projectTestDocuments(applicationId, mapping);
    const rows = await syncCouchTestFiles(req, applicationId, mapping, refreshedDocuments);
    const row = rows.find(item => item.remotePath === targetPath);
    if (!row) throw new CdeApiError('COUCHDB_WRITE_FAILED', 'Saved file metadata could not be synchronized.', 502);
    await prisma.auditLog.create({
      data: {
        userId: req.utmsContext.userId,
        applicationId: String(applicationId),
        entityType: 'PLAYWRIGHT_TEST_FILE',
        entityId: row.id,
        action: existing ? 'UPDATE' : 'CREATE',
        previousValue: existing ? JSON.stringify({ path: previousPath, hash: existing.sourceHash, revision: existing.couchRevision }) : null,
        newValue: JSON.stringify({ path: targetPath, hash: hash(source), revision: verified._rev }),
        metadata: { storage: 'COUCHDB', documentId: verified._id, cdeBinding, bindingFingerprint: fingerprint },
      },
    });
    return testFileDto(await prisma.playwrightTestFile.findUnique({ where: { id: row.id }, include: { createdBy: true } }));
  } finally {
    await release();
  }
}

function validateEnvironmentUrl(value, required) {
  const text = String(value || '').trim();
  if (!text && !required) return null;
  let url;
  try { url = new URL(text); } catch { throw new CdeApiError('ENVIRONMENT_URL_INVALID', 'Environment URL is invalid.', 400); }
  if (url.username || url.password || url.hash) throw new CdeApiError('ENVIRONMENT_URL_INVALID', 'Environment URL must not contain credentials or fragments.', 400);
  if (url.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && url.protocol === 'http:')) {
    throw new CdeApiError('ENVIRONMENT_URL_INVALID', 'Environment URL must use HTTPS.', 400);
  }
  return url.toString().replace(/\/$/, '');
}

function isCdeEditorUrl(value) {
  let url;
  try { url = new URL(String(value || '')); } catch { return false; }
  if (url.origin !== CDE_EDITOR_ORIGIN) return false;
  return /^\/(?:front\/directory|dservice\/directory|back)(?:\/|$)/i.test(url.pathname);
}

function assertRunnableEnvironmentUrl(value) {
  if (isCdeEditorUrl(value)) {
    throw new CdeApiError(
      'PLAYWRIGHT_ENVIRONMENT_EDITOR_URL',
      'The Web base URL points to a CDE source editor. Configure the deployed or preview runtime URL instead.',
      422,
    );
  }
}

const STANDARD_ENVIRONMENT_NAMES = new Set([
  'dev', 'develop', 'development', 'توسعه',
  'test', 'testing', 'qa', 'تست',
  'stage', 'staging', 'preproduction', 'پیشانتشار',
  'prod', 'production', 'تولید',
]);

function normalizedEnvironmentName(value) {
  return String(value || '').trim().toLocaleLowerCase('fa-IR').replace(/[\s_-]+/g, '');
}

function isStandardEnvironmentName(value) {
  return STANDARD_ENVIRONMENT_NAMES.has(normalizedEnvironmentName(value));
}

function parseOptionalEnvironmentDate(value, fieldName) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new CdeApiError('ENVIRONMENT_AVAILABILITY_INVALID', `${fieldName} must be a valid date and time.`, 400);
  }
  return date;
}

function validateEnvironmentAvailability(availableFromValue, availableUntilValue) {
  const availableFrom = parseOptionalEnvironmentDate(availableFromValue, 'availableFrom');
  const availableUntil = parseOptionalEnvironmentDate(availableUntilValue, 'availableUntil');
  if (availableFrom && availableUntil && availableUntil <= availableFrom) {
    throw new CdeApiError(
      'ENVIRONMENT_AVAILABILITY_INVALID',
      'availableUntil must be later than availableFrom.',
      400,
    );
  }
  return { availableFrom, availableUntil };
}

function environmentAvailableNow(row, now = new Date()) {
  if (!row.enabled) return false;
  if (row.availableFrom && row.availableFrom > now) return false;
  if (row.availableUntil && row.availableUntil <= now) return false;
  return true;
}

function environmentAvailabilityWhere(now = new Date()) {
  return {
    enabled: true,
    AND: [
      { OR: [{ availableFrom: null }, { availableFrom: { lte: now } }] },
      { OR: [{ availableUntil: null }, { availableUntil: { gt: now } }] },
    ],
  };
}

function serializeEnvironment(row, includeSecretReferences = false) {
  const serialized = {
    id: row.id,
    applicationId: row.applicationId,
    name: row.name,
    webBaseUrl: row.webBaseUrl,
    apiBaseUrl: row.apiBaseUrl,
    gatewayBaseUrl: row.gatewayBaseUrl,
    enabled: row.enabled,
    availableFrom: row.availableFrom?.toISOString() || null,
    availableUntil: row.availableUntil?.toISOString() || null,
    availableNow: environmentAvailableNow(row),
  };
  if (includeSecretReferences) {
    serialized.secretReferences = row.secretReferences && typeof row.secretReferences === 'object'
      ? row.secretReferences
      : {};
  }
  return serialized;
}

async function environments(req, applicationId) {
  assertApplicationScope(req, applicationId);
  const includeDisabled = new URL(req.url, 'http://localhost').searchParams.get('includeDisabled') === 'true';
  if (includeDisabled) assertSystemAdmin(req);
  return (await getPrismaClient().applicationEnvironment.findMany({
    where: {
      applicationId: String(applicationId),
      ...(includeDisabled ? {} : environmentAvailabilityWhere()),
    },
    orderBy: { name: 'asc' },
  })).map(row => serializeEnvironment(row, includeDisabled));
}

async function saveEnvironment(req, applicationId, body, environmentId) {
  assertSystemAdmin(req);
  assertCsrf(req);
  const prisma = getPrismaClient();
  let existing = null;
  if (environmentId) {
    existing = await prisma.applicationEnvironment.findUnique({ where: { id: String(environmentId) } });
    if (!existing || existing.applicationId !== String(applicationId)) {
      throw new CdeApiError('ENVIRONMENT_NOT_FOUND', 'Environment profile was not found for this Application.', 404);
    }
  }
  const availability = validateEnvironmentAvailability(
    body.availableFrom === undefined ? existing?.availableFrom : body.availableFrom,
    body.availableUntil === undefined ? existing?.availableUntil : body.availableUntil,
  );
  const data = {
    applicationId: String(applicationId),
    name: String(body.name === undefined ? existing?.name || '' : body.name).trim().slice(0, 120),
    webBaseUrl: validateEnvironmentUrl(body.webBaseUrl === undefined ? existing?.webBaseUrl : body.webBaseUrl, true),
    apiBaseUrl: validateEnvironmentUrl(body.apiBaseUrl === undefined ? existing?.apiBaseUrl : body.apiBaseUrl, false),
    gatewayBaseUrl: validateEnvironmentUrl(body.gatewayBaseUrl === undefined ? existing?.gatewayBaseUrl : body.gatewayBaseUrl, false),
    secretReferences: body.secretReferences && typeof body.secretReferences === 'object'
      ? body.secretReferences
      : existing?.secretReferences || {},
    enabled: body.enabled === undefined ? existing?.enabled !== false : body.enabled !== false,
    ...availability,
  };
  assertRunnableEnvironmentUrl(data.webBaseUrl);
  if (!data.name) throw new CdeApiError('ENVIRONMENT_NAME_REQUIRED', 'Environment name is required.', 400);
  const row = environmentId
    ? await prisma.applicationEnvironment.update({ where: { id: environmentId }, data })
    : await prisma.applicationEnvironment.create({ data });
  return serializeEnvironment(row);
}

async function deleteEnvironment(req, applicationId, environmentId) {
  assertSystemAdmin(req);
  assertCsrf(req);
  const prisma = getPrismaClient();
  const environment = await prisma.applicationEnvironment.findUnique({ where: { id: String(environmentId) } });
  if (!environment || environment.applicationId !== String(applicationId)) {
    throw new CdeApiError('ENVIRONMENT_NOT_FOUND', 'Environment profile was not found for this Application.', 404);
  }
  if (isStandardEnvironmentName(environment.name)) {
    throw new CdeApiError(
      'STANDARD_ENVIRONMENT_DELETE_FORBIDDEN',
      'Standard environments cannot be deleted. Disable them instead.',
      409,
    );
  }
  await prisma.applicationEnvironment.delete({ where: { id: environment.id } });
  return { deleted: true, id: environment.id };
}

async function bulkConfigureEnvironments(req, body) {
  assertSystemAdmin(req);
  assertCsrf(req);
  const prisma = getPrismaClient();
  let applicationIds = Array.from(new Set(
    (Array.isArray(body.applicationIds) ? body.applicationIds : []).map(value => String(value || '').trim()).filter(Boolean),
  ));
  if (body.allMapped === true) {
    applicationIds = (await prisma.application.findMany({
      where: { isActive: true, cdeMapping: { is: { enabled: true } } },
      select: { id: true },
    })).map(application => application.id);
  }
  if (!applicationIds.length || applicationIds.length > 500) {
    throw new CdeApiError('ENVIRONMENT_BULK_TARGETS_INVALID', 'Select between 1 and 500 Applications.', 400);
  }
  const source = await prisma.applicationEnvironment.findFirst({
    where: {
      id: String(body.sourceEnvironmentId || ''),
      applicationId: String(body.sourceApplicationId || ''),
    },
  });
  if (!source) throw new CdeApiError('ENVIRONMENT_NOT_FOUND', 'The source environment profile was not found.', 404);
  const applications = await prisma.application.findMany({
    where: { id: { in: applicationIds }, isActive: true, cdeMapping: { is: { enabled: true } } },
    select: { id: true },
  });
  if (applications.length !== applicationIds.length) {
    throw new CdeApiError(
      'ENVIRONMENT_BULK_TARGETS_INVALID',
      'Every target must be an active Application with an enabled CDE mapping.',
      422,
    );
  }
  const availability = validateEnvironmentAvailability(body.availableFrom, body.availableUntil);
  const existingRows = await prisma.applicationEnvironment.findMany({
    where: { applicationId: { in: applicationIds }, name: source.name },
  });
  const existingByApplication = new Map(existingRows.map(row => [row.applicationId, row]));
  const createMissing = body.createMissing === true;
  const overwriteUrls = body.overwriteUrls === true;
  const operations = [];
  let updated = 0;
  let created = 0;
  let skipped = 0;
  for (const applicationId of applicationIds) {
    const existing = existingByApplication.get(applicationId);
    if (existing) {
      operations.push(prisma.applicationEnvironment.update({
        where: { id: existing.id },
        data: {
          enabled: body.enabled !== false,
          ...availability,
          ...(overwriteUrls ? {
            webBaseUrl: source.webBaseUrl,
            apiBaseUrl: source.apiBaseUrl,
            gatewayBaseUrl: source.gatewayBaseUrl,
            secretReferences: source.secretReferences,
          } : {}),
        },
      }));
      updated += 1;
    } else if (createMissing) {
      operations.push(prisma.applicationEnvironment.create({
        data: {
          applicationId,
          name: source.name,
          webBaseUrl: source.webBaseUrl,
          apiBaseUrl: source.apiBaseUrl,
          gatewayBaseUrl: source.gatewayBaseUrl,
          secretReferences: source.secretReferences,
          enabled: body.enabled !== false,
          ...availability,
        },
      }));
      created += 1;
    } else {
      skipped += 1;
    }
  }
  if (operations.length) await prisma.$transaction(operations);
  return { updated, created, skipped, total: applicationIds.length };
}

function sourceRoot(repositoryType) {
  return REPOSITORY_CONFIG[repositoryType]?.root || String(repositoryType).toLowerCase();
}

function snapshotFilePath(repositoryType, packId, branch, file) {
  if (repositoryType === 'TESTS') return normalizeSourcePath(`tests/${String(file.path).replace(/^tests\//, '')}`);
  const normalizedPack = normalizeSourcePath(packId);
  if (repositoryType === 'API_MODULE') {
    const label = branch.selector.kind === 'PUBLIC'
      ? 'public'
      : `personal-${branch.selector.randId || branch.selector.index}`;
    return normalizeSourcePath(`${sourceRoot(repositoryType)}/${normalizedPack}/${label}.js`);
  }
  return normalizeSourcePath(`${sourceRoot(repositoryType)}/${normalizedPack}/${file.path}`);
}

async function snapshotRepository(req, applicationId, mapping, repositoryType, bundleFiles, manifestPackages) {
  const repository = await repositoryList(req, mapping, repositoryType);
  if (!repository) return;
  for (const summary of repository.packages) {
    const item = await loadPackageItem(req, mapping, repositoryType, repository.repoName, summary.id);
    const branch = await resolveBranch(req, String(applicationId), repositoryType, repository.repoName, summary.id, item, null);
    const remoteFiles = normalizeRemoteFiles(branch, repositoryType, summary.id);
    const fileManifest = remoteFiles.map(file => {
      const path = snapshotFilePath(repositoryType, summary.id, branch, file);
      const sourceHash = hash(file.code);
      bundleFiles.push({ path, code: file.code, sourceHash, readOnly: true });
      return { path, sourceHash };
    });
    manifestPackages.push({
      repositoryType,
      repoName: repository.repoName,
      packId: summary.id,
      selector: branch.selector,
      versionId: branch.versionId || null,
      files: fileManifest,
    });
  }
}

function couchRevisionManifest(documents, mapping) {
  return {
    provider: 'COUCHDB',
    database: couchStoreDescriptor().database,
    projectKey: mapping.projectKey,
    bindingFingerprint: bindingFingerprint(bindingForMapping(mapping)),
    documents: documents.map(document => ({
      id: document._id,
      revision: document._rev,
      path: document.path,
      sourceHash: document.sourceHash || hash(document.script || ''),
    })).sort((left, right) => left.id.localeCompare(right.id)),
  };
}

function sameCouchRevisionManifest(left, right) {
  const canonical = value => ({
    provider: String(value?.provider || ''),
    database: String(value?.database || ''),
    projectKey: String(value?.projectKey || ''),
    bindingFingerprint: String(value?.bindingFingerprint || ''),
    documents: (Array.isArray(value?.documents) ? value.documents : []).map(document => ({
      id: String(document?.id || ''),
      revision: String(document?.revision || ''),
      path: String(document?.path || ''),
      sourceHash: String(document?.sourceHash || ''),
    })).sort((leftDocument, rightDocument) =>
      leftDocument.id.localeCompare(rightDocument.id) || leftDocument.path.localeCompare(rightDocument.path)
    ),
  });
  return hash(JSON.stringify(canonical(left))) === hash(JSON.stringify(canonical(right)));
}

async function materializeSnapshot(req, applicationId, environment, options = {}) {
  const mapping = await mappingForApplication(req, applicationId);
  const files = [];
  const packages = [];
  for (const repositoryType of ['WEB_UI', 'DATA_SERVICE', 'API_MODULE', 'MESSAGE_CONSUMER']) {
    await snapshotRepository(req, applicationId, mapping, repositoryType, files, packages);
  }
  const testDocuments = await projectTestDocuments(applicationId, mapping);
  const testRevisionManifest = couchRevisionManifest(testDocuments, mapping);
  if (options.expectedTestManifest && !sameCouchRevisionManifest(testRevisionManifest, options.expectedTestManifest)) {
    throw new CdeApiError('COUCHDB_SNAPSHOT_CONFLICT', 'Playwright files changed while the run snapshot was queued. Start the run again.', 409, {
      currentRevisionManifest: testRevisionManifest,
    });
  }
  const testFiles = testDocuments.map(document => {
    const path = snapshotFilePath('TESTS', `playwright/${mapping.projectKey}`, null, { path: document.path });
    const sourceHash = document.sourceHash || hash(document.script || '');
    files.push({ path, code: String(document.script || ''), sourceHash, readOnly: true });
    return { path, sourceHash };
  });
  packages.push({
    repositoryType: 'TESTS',
    storage: 'COUCHDB',
    repoName: couchStoreDescriptor().database,
    packId: `playwright/${mapping.projectKey}`,
    selector: { kind: 'COUCHDB', bindingFingerprint: testRevisionManifest.bindingFingerprint },
    versionId: hash(JSON.stringify(testRevisionManifest.documents)),
    files: testFiles,
  });
  const folded = new Set();
  for (const file of files) {
    const key = file.path.toLocaleLowerCase('en-US');
    if (folded.has(key)) throw new CdeApiError('CDE_PATH_COLLISION', `Snapshot path collision: ${file.path}`, 422);
    folded.add(key);
  }
  files.sort((left, right) => left.path.localeCompare(right.path));
  const manifest = {
    format: 2,
    serviceId: 'cde.edus.ir',
    applicationId: String(applicationId),
    projectKey: mapping.projectKey,
    capturedAt: new Date().toISOString(),
    environment: {
      id: environment.id,
      name: environment.name,
      webBaseUrl: environment.webBaseUrl,
      apiBaseUrl: environment.apiBaseUrl,
      gatewayBaseUrl: environment.gatewayBaseUrl,
    },
    packages,
    playwrightStore: testRevisionManifest,
    fileCount: files.length,
  };
  const contentHash = hash(JSON.stringify({ manifest, files }));
  return { manifest: { ...manifest, contentHash }, files, contentHash };
}

function internalJobAuthorized(req) {
  const configured = process.env.UTMS_INTERNAL_JOB_TOKEN || (process.env.NODE_ENV === 'production' ? '' : 'utms-development-jobs');
  const supplied = String(req.headers['x-utms-job-token'] || '');
  if (!configured || !supplied) return false;
  const expectedHash = Buffer.from(hash(configured), 'hex');
  const suppliedHash = Buffer.from(hash(supplied), 'hex');
  return timingSafeEqual(expectedHash, suppliedHash);
}

async function requestForInitiatingSession(sessionId) {
  const prisma = getPrismaClient();
  const session = await prisma.userSession.findFirst({
    where: { id: String(sessionId), revokedAt: null, expiresAt: { gt: new Date() }, user: { isActive: true } },
    include: { user: true, assignment: true },
  });
  if (!session) throw new CdeApiError('CDE_RECONNECT_REQUIRED', 'The initiating UTMS/CDE session is no longer available.', 409);
  return {
    headers: {},
    utmsSession: session,
    utmsContext: await sessionContext(prisma, session),
    utmsCsrfToken: null,
  };
}

function serializeRun(row) {
  const { snapshot, environmentProfile, testFile, ...safeRow } = row;
  return {
    ...safeRow,
    snapshot: snapshot ? {
      id: snapshot.id,
      status: snapshot.status,
      manifest: snapshot.manifest,
      contentHash: snapshot.contentHash,
      errorCode: snapshot.errorCode,
      errorMessage: snapshot.errorMessage,
      expiresAt: snapshot.expiresAt.toISOString(),
      purgedAt: snapshot.purgedAt?.toISOString(),
    } : undefined,
    environmentProfile: environmentProfile ? serializeEnvironment(environmentProfile) : undefined,
    testFile: testFile ? {
      id: testFile.id,
      fullPath: testFile.fullPath,
      remotePath: testFile.remotePath,
      remoteVersionId: testFile.remoteVersionId,
      couchDocumentId: testFile.couchDocumentId,
      couchRevision: testFile.couchRevision,
      cdeBinding: testFile.cdeBinding,
      sourceHash: testFile.sourceHash,
    } : undefined,
    requestedAt: row.requestedAt?.toISOString(),
    dispatchedAt: row.dispatchedAt?.toISOString(),
    lastHeartbeatAt: row.lastHeartbeatAt?.toISOString(),
    startedAt: row.startedAt?.toISOString(),
    completedAt: row.completedAt?.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    triggeredBy: row.triggeredBy ? {
      id: row.triggeredBy.id,
      fullName: row.triggeredBy.fullName,
      phoneNumber: row.triggeredBy.phoneNumber,
    } : undefined,
  };
}

function runWhereForContext(context) {
  return context.role === 'SYSTEM_ADMIN' ? {} : { applicationId: { in: context.scopeApplicationIds || [] } };
}

async function listRuns(req, parsedUrl) {
  const context = assertAutomatedTestAccess(req);
  const applicationId = parsedUrl.searchParams.get('applicationId');
  if (applicationId) assertApplicationScope(req, applicationId);
  const page = Math.max(1, Number(parsedUrl.searchParams.get('page') || 1));
  const limit = Math.min(100, Math.max(1, Number(parsedUrl.searchParams.get('limit') || 20)));
  const where = { ...runWhereForContext(context), ...(applicationId ? { applicationId } : {}) };
  const prisma = getPrismaClient();
  const [rows, total] = await prisma.$transaction([
    prisma.playwrightRun.findMany({
      where,
      include: { triggeredBy: true, snapshot: true, environmentProfile: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.playwrightRun.count({ where }),
  ]);
  return { data: rows.map(serializeRun), page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

async function getRun(req, runId) {
  const context = assertAutomatedTestAccess(req);
  const row = await getPrismaClient().playwrightRun.findFirst({
    where: { id: String(runId), ...runWhereForContext(context) },
    include: { triggeredBy: true, snapshot: true, environmentProfile: true, testFile: true },
  });
  if (!row) throw new CdeApiError('PLAYWRIGHT_RUN_NOT_FOUND', 'Playwright run was not found.', 404);
  return serializeRun(row);
}

async function createRun(req, body) {
  const context = assertAutomatedTestAccess(req);
  assertCsrf(req);
  const applicationId = String(body.applicationId || '');
  assertApplicationScope(req, applicationId);
  const mapping = await mappingForApplication(req, applicationId);
  const prisma = getPrismaClient();
  const environment = await prisma.applicationEnvironment.findFirst({
    where: {
      id: String(body.environmentProfileId || ''),
      applicationId,
      ...environmentAvailabilityWhere(),
    },
  });
  if (!environment) throw new CdeApiError('PLAYWRIGHT_ENVIRONMENT_REQUIRED', 'Select an enabled environment within its availability window.', 422);
  assertRunnableEnvironmentUrl(environment.webBaseUrl);
  const testFile = await prisma.playwrightTestFile.findFirst({
    where: { id: String(body.testFileId || ''), applicationId, source: 'COUCHDB' },
  });
  if (!testFile?.couchDocumentId) throw new CdeApiError('PLAYWRIGHT_TEST_FILE_REQUIRED', 'Select a CouchDB-backed Playwright test file.', 422);
  const binding = bindingForMapping(mapping);
  const fingerprint = bindingFingerprint(binding);
  const documents = await projectTestDocuments(applicationId, mapping);
  const selectedDocument = documents.find(document => document._id === testFile.couchDocumentId);
  if (!selectedDocument || selectedDocument.bindingFingerprint !== fingerprint) {
    throw new CdeApiError('COUCHDB_PROJECT_BINDING_MISMATCH', 'The selected Playwright file is not mapped to the current CDE project.', 409);
  }
  if (!RUNNABLE_PLAYWRIGHT_FILE_PATTERN.test(selectedDocument.path)) {
    throw new CdeApiError(
      'PLAYWRIGHT_TEST_FILE_NOT_RUNNABLE',
      'Select a runnable Playwright file ending in .js, .spec.js, .test.js, .spec.ts, or .test.ts.',
      422,
    );
  }
  const requestedTests = couchRevisionManifest(documents, mapping);
  const projects = Array.from(new Set(Array.isArray(body.projects) ? body.projects : ['chromium']))
    .filter(project => ['chromium', 'firefox', 'webkit'].includes(project));
  if (!projects.length) throw new CdeApiError('PLAYWRIGHT_PROJECT_REQUIRED', 'Select at least one browser project.', 422);
  const workers = String(body.workers || '1');
  if (!/^\d{1,2}$/.test(workers) || Number(workers) < 1 || Number(workers) > 16) {
    throw new CdeApiError('PLAYWRIGHT_WORKERS_INVALID', 'Workers must be between 1 and 16.', 422);
  }
  const retries = Math.min(3, Math.max(0, Number(body.retries || 0)));
  const timeoutSeconds = Math.min(3600, Math.max(30, Number(body.timeoutSeconds || 600)));
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const created = await prisma.$transaction(async transaction => {
    const snapshot = await transaction.cdeSourceSnapshot.create({
      data: {
        applicationId,
        requestedById: context.userId,
        initiatingSessionId: req.utmsSession.id,
        status: 'PENDING',
        manifest: { requestedTests },
        expiresAt,
      },
    });
    const run = await transaction.playwrightRun.create({
      data: {
        applicationId,
        environmentProfileId: environment.id,
        snapshotId: snapshot.id,
        testFileId: testFile.id,
        testFilePath: selectedDocument.path,
        environment: environment.name,
        projects,
        headed: false,
        workers,
        retries,
        maxFailures: body.maxFailures ? String(body.maxFailures) : null,
        trace: ['off', 'on', 'retain-on-failure', 'on-first-retry'].includes(body.trace) ? body.trace : 'retain-on-failure',
        reporter: 'json',
        status: 'PREPARING',
        queueStatus: 'QUEUED',
        timeoutSeconds,
        requestedAt: new Date(),
        triggeredById: context.userId,
        idempotencyKey: body.idempotencyKey ? String(body.idempotencyKey).slice(0, 255) : null,
        correlationId: body.correlationId ? String(body.correlationId).slice(0, 255) : null,
      },
      include: { triggeredBy: true, snapshot: true, environmentProfile: true },
    });
    return { run, snapshot };
  });
  try {
    await enqueueSnapshot(created.snapshot.id, created.run.id);
  } catch (error) {
    await prisma.$transaction([
      prisma.cdeSourceSnapshot.update({ where: { id: created.snapshot.id }, data: { status: 'FAILED', errorCode: 'SNAPSHOT_QUEUE_UNAVAILABLE', errorMessage: error.message } }),
      prisma.playwrightRun.update({ where: { id: created.run.id }, data: { status: 'ERROR', queueStatus: 'FAILED', logs: 'Snapshot queue was unavailable.', completedAt: new Date() } }),
    ]);
    throw new CdeApiError('PLAYWRIGHT_QUEUE_UNAVAILABLE', 'The snapshot queue is unavailable.', 503);
  }
  return serializeRun(created.run);
}

async function cancelRun(req, runId) {
  assertAutomatedTestAccess(req);
  assertCsrf(req);
  const current = await getRun(req, runId);
  if (['PASSED', 'FAILED', 'ERROR', 'CANCELLED'].includes(current.status)) return current;
  await cancelQueuedRun(current.id, current.snapshotId);
  const row = await getPrismaClient().playwrightRun.update({
    where: { id: current.id },
    data: { status: 'CANCELLED', queueStatus: 'DONE', completedAt: new Date(), logs: `${current.logs || ''}\nCancellation requested.`.trim() },
    include: { triggeredBy: true, snapshot: true, environmentProfile: true },
  });
  return serializeRun(row);
}

async function materializeSnapshotJob(req, snapshotId) {
  if (!internalJobAuthorized(req)) throw new CdeApiError('INTERNAL_AUTH_FAILED', 'Internal job authentication failed.', 401);
  const prisma = getPrismaClient();
  const snapshot = await prisma.cdeSourceSnapshot.findUnique({
    where: { id: String(snapshotId) },
    include: { application: true, playwrightRuns: { include: { environmentProfile: true } } },
  });
  if (!snapshot) throw new CdeApiError('SNAPSHOT_NOT_FOUND', 'Snapshot was not found.', 404);
  const run = snapshot.playwrightRuns[0];
  if (!run?.environmentProfile) throw new CdeApiError('PLAYWRIGHT_ENVIRONMENT_REQUIRED', 'Snapshot run environment is unavailable.', 409);
  if (run.status === 'CANCELLED') return { cancelled: true };
  await prisma.cdeSourceSnapshot.update({ where: { id: snapshot.id }, data: { status: 'MATERIALIZING' } });
  try {
    const internalRequest = await requestForInitiatingSession(snapshot.initiatingSessionId);
    const bundle = await materializeSnapshot(internalRequest, snapshot.applicationId, run.environmentProfile, {
      expectedTestManifest: snapshot.manifest?.requestedTests || null,
    });
    const objectKey = `snapshots/${snapshot.applicationId}/${snapshot.id}.json.enc`;
    await putEncryptedObject(objectKey, Buffer.from(JSON.stringify(bundle)), 'application/json');
    await prisma.$transaction([
      prisma.cdeSourceSnapshot.update({
        where: { id: snapshot.id },
        data: { status: 'READY', objectKey, manifest: bundle.manifest, contentHash: bundle.contentHash, initiatingSessionId: null },
      }),
      prisma.playwrightRun.update({
        where: { id: run.id },
        data: { status: 'QUEUED', queueStatus: 'QUEUED', completedAt: null, logs: null },
      }),
    ]);
    await enqueueRun(run.id, snapshot.id);
    return { snapshotId: snapshot.id, runId: run.id, contentHash: bundle.contentHash };
  } catch (error) {
    const errorCode = error.category || 'SNAPSHOT_FAILED';
    const errorMessage = String(error.message || 'Snapshot failed.').slice(0, 4000);
    const terminalClientError = Number(error.statusCode) >= 400 && Number(error.statusCode) < 500;
    await prisma.$transaction([
      prisma.cdeSourceSnapshot.update({
        where: { id: snapshot.id },
        data: {
          status: 'FAILED',
          errorCode,
          errorMessage,
          ...(terminalClientError ? { initiatingSessionId: null } : {}),
        },
      }),
      prisma.playwrightRun.update({
        where: { id: run.id },
        data: {
          status: 'ERROR',
          queueStatus: 'FAILED',
          completedAt: new Date(),
          logs: `Snapshot materialization failed [${errorCode}]: ${errorMessage}`,
        },
      }),
    ]);
    throw error;
  }
}

async function purgeExpiredSnapshots(req) {
  if (!internalJobAuthorized(req)) throw new CdeApiError('INTERNAL_AUTH_FAILED', 'Internal job authentication failed.', 401);
  const prisma = getPrismaClient();
  const expired = await prisma.cdeSourceSnapshot.findMany({
    where: { expiresAt: { lte: new Date() }, purgedAt: null, objectKey: { not: null } },
    take: 100,
  });
  let purged = 0;
  for (const snapshot of expired) {
    try {
      await deleteObject(snapshot.objectKey);
      await prisma.cdeSourceSnapshot.update({
        where: { id: snapshot.id },
        data: { status: 'PURGED', purgedAt: new Date(), objectKey: null },
      });
      purged += 1;
    } catch {
      // The next cleanup pass retries transient object-storage failures.
    }
  }
  return { purged };
}

function routeMatch(pathname, expression) {
  return pathname.match(expression);
}

function canHandleCde(pathname) {
  return pathname.startsWith('/api/cde/') || pathname.startsWith('/api/playwright/') ||
    pathname.startsWith('/api/internal/playwright/') || /^\/api\/applications\/[^/]+\/(?:cde|playwright|environments)/.test(pathname);
}

async function handleCde(req, parsedUrl, body) {
  const pathname = parsedUrl.pathname;
  let match = routeMatch(pathname, /^\/api\/internal\/playwright\/snapshots\/([^/]+)\/materialize$/);
  if (match && req.method === 'POST') return materializeSnapshotJob(req, decodeURIComponent(match[1]));
  if (pathname === '/api/internal/playwright/snapshots/purge' && req.method === 'POST') return purgeExpiredSnapshots(req);
  if (pathname === '/api/playwright/runs' && req.method === 'GET') return listRuns(req, parsedUrl);
  if (pathname === '/api/playwright/runs' && req.method === 'POST') return createRun(req, body);
  match = routeMatch(pathname, /^\/api\/playwright\/runs\/([^/]+)$/);
  if (match && req.method === 'GET') return getRun(req, decodeURIComponent(match[1]));
  match = routeMatch(pathname, /^\/api\/playwright\/runs\/([^/]+)\/cancel$/);
  if (match && req.method === 'POST') return cancelRun(req, decodeURIComponent(match[1]));
  if (pathname === '/api/cde/session' && req.method === 'GET') return cdeStatus(req);
  if (pathname === '/api/cde/session/start' && req.method === 'POST') return startCdeLogin(req, body);
  if (pathname === '/api/cde/session/password' && req.method === 'POST') return finishCdePassword(req, body);
  if (pathname === '/api/cde/session' && req.method === 'DELETE') return disconnectCde(req);
  if (pathname === '/api/cde/projects' && req.method === 'GET') return browseProjects(req);
  match = routeMatch(pathname, /^\/api\/cde\/projects\/([^/]+)\/catalog$/);
  if (match && req.method === 'GET') return browseProjectCatalog(req, decodeURIComponent(match[1]));
  match = routeMatch(pathname, /^\/api\/cde\/projects\/([^/]+)\/package$/);
  if (match && req.method === 'POST') return browseProjectPackage(req, decodeURIComponent(match[1]), body);
  if (pathname === '/api/cde/applications' && req.method === 'GET') return visibleApplications(req);

  if (pathname === '/api/applications/bulk/environments' && req.method === 'POST') {
    return bulkConfigureEnvironments(req, body);
  }

  match = routeMatch(pathname, /^\/api\/applications\/([^/]+)\/cde\/mapping$/);
  if (match && req.method === 'GET') return getMapping(req, decodeURIComponent(match[1]));
  if (match && req.method === 'PUT') return putMapping(req, decodeURIComponent(match[1]), body);
  match = routeMatch(pathname, /^\/api\/applications\/([^/]+)\/cde\/mapping\/validate$/);
  if (match && req.method === 'POST') return validateMapping(req, decodeURIComponent(match[1]));
  match = routeMatch(pathname, /^\/api\/applications\/([^/]+)\/cde\/catalog$/);
  if (match && req.method === 'GET') return catalog(req, decodeURIComponent(match[1]));
  match = routeMatch(pathname, /^\/api\/applications\/([^/]+)\/cde\/package$/);
  if (match && req.method === 'POST') return packageContent(req, decodeURIComponent(match[1]), body);
  match = routeMatch(pathname, /^\/api\/applications\/([^/]+)\/cde\/branch-selection$/);
  if (match && req.method === 'PUT') return saveBranchSelection(req, decodeURIComponent(match[1]), body);

  match = routeMatch(pathname, /^\/api\/applications\/([^/]+)\/playwright\/files$/);
  if (match && req.method === 'GET') return listTestFiles(req, decodeURIComponent(match[1]), parsedUrl);
  if (match && req.method === 'POST') return writeTestFile(req, decodeURIComponent(match[1]), body, null);
  match = routeMatch(pathname, /^\/api\/applications\/([^/]+)\/playwright\/files\/([^/]+)$/);
  if (match && req.method === 'PATCH') return writeTestFile(req, decodeURIComponent(match[1]), body, decodeURIComponent(match[2]));

  match = routeMatch(pathname, /^\/api\/applications\/([^/]+)\/environments$/);
  if (match && req.method === 'GET') return environments(req, decodeURIComponent(match[1]));
  if (match && req.method === 'POST') return saveEnvironment(req, decodeURIComponent(match[1]), body, null);
  match = routeMatch(pathname, /^\/api\/applications\/([^/]+)\/environments\/([^/]+)$/);
  if (match && req.method === 'PATCH') return saveEnvironment(req, decodeURIComponent(match[1]), body, decodeURIComponent(match[2]));
  if (match && req.method === 'DELETE') return deleteEnvironment(req, decodeURIComponent(match[1]), decodeURIComponent(match[2]));

  throw new CdeApiError('CDE_ENDPOINT_NOT_FOUND', 'CDE endpoint not found.', 404);
}

module.exports = {
  CdeApiError,
  branchSummaries,
  canHandleCde,
  catalog,
  derivedTestFolders,
  handleCde,
  environmentAvailableNow,
  isStandardEnvironmentName,
  normalizeTestPath,
  normalizeRemoteFiles,
  materializeSnapshot,
  sameCouchRevisionManifest,
  isCdeEditorUrl,
  normalizeCdeLoginName,
  projectDescriptor,
  projectRepositoryName,
  requireCdePasswordStep,
  repositoryBranches,
  selectorMatches,
  serializeEnvironment,
  validateEnvironmentAvailability,
};
