const { createHash, timingSafeEqual } = require('crypto');
const { getPrismaClient } = require('../../database/prisma-client.cjs');
const { assertCsrf, requireUtmsSession, sessionContext } = require('../auth/auth-session-server.cjs');
const {
  CoreClientError,
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
const { CdeCompileError, compileDataServiceBranchContent, normalizeSourcePath } = require('./data-service-compiler.cjs');
const { deleteObject, putEncryptedObject } = require('../playwright/object-store.cjs');
const { cancelQueuedRun, enqueueRun, enqueueSnapshot } = require('../playwright/playwright-queue.cjs');

const REPOSITORY_CONFIG = {
  WEB_UI: { mappingField: 'webUiRepoName', key: 'cde/repository/web-ui/list/fetch', root: 'web-ui', suffix: 'web-ui' },
  DATA_SERVICE: { mappingField: 'dataServiceRepoName', key: 'cde/repository/data-service/list/fetch', root: 'data-service', suffix: 'data-service' },
  API_MODULE: { mappingField: 'apiModuleRepoName', key: 'cde/repository/api-module/list/fetch', root: 'api-module', suffix: 'api-module' },
  MESSAGE_CONSUMER: { mappingField: 'messageConsumerRepoName', key: 'cde/repository/message-consumer/list/fetch', root: 'message-consumer', suffix: 'message-consumer' },
  TESTS: { mappingField: 'testRepoName', key: 'cde/repository/data-service/list/fetch', root: 'tests', suffix: 'data-service' },
};
const BROWSABLE_REPOSITORY_TYPES = ['WEB_UI', 'DATA_SERVICE', 'API_MODULE', 'MESSAGE_CONSUMER'];
const TEST_FILE_PATTERN = /\.(?:spec\.(?:ts|js)|ts|js|json|md)$/i;

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

async function callForm(req, formId, data, options = {}) {
  const state = options.state || await loadCdeState(req);
  const callResult = await storeFormData(state, formId, data);
  const response = await persistCoreResult(req, callResult);
  assertLogicalSuccess(response);
  if (options.requireLogin === true && resultOf(response).IsUserLogin === false) {
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
  const userLoginName = String(body.userLoginName || '').trim();
  if (!/^\d{10,13}$/.test(userLoginName)) {
    throw new CdeApiError('CDE_LOGIN_NAME_INVALID', 'Enter the cellphone format accepted by CDE.', 400);
  }
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
  await setCdeSession(session.id, callResult.state, 5 * 60);
  return {
    connected: false,
    nextStep: resultOf(callResult.response).nextStep || 'password',
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
  assertLogicalSuccess(callResult.response);
  callResult = await getDataSource(callResult.state, 'pages-app/who-am-i', {});
  const result = resultOf(callResult.response);
  if (!result.IsUserLogin) {
    await deleteCdeSession(session.id);
    throw new CdeApiError('CDE_LOGIN_FAILED', 'CDE did not establish an authenticated session.', 401);
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
  return {
    projectKey,
    repositories: Object.fromEntries(BROWSABLE_REPOSITORY_TYPES.map(repositoryType => [
      repositoryType,
      projectRepositoryName(projectKey, repositoryType),
    ])),
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
    include: { cdeMapping: true, applicationEnvironments: { where: { enabled: true }, orderBy: { name: 'asc' } } },
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
      tests: application.cdeMapping.testRepoName,
    },
    environments: application.applicationEnvironments.map(serializeEnvironment),
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
    repoName: mapping.testRepoName,
    packages: [{ id: mapping.testPackId, branches: [{
      selector: { kind: 'PERSONAL', ...(mapping.testBranchRandId ? { randId: mapping.testBranchRandId } : {}), ...(Number.isInteger(mapping.testBranchIndex) ? { index: mapping.testBranchIndex } : {}) },
      configured: true,
    }] }],
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
  return {
    applicationId,
    repositoryType,
    repoName,
    packId,
    branch: { selector: branch.selector, versionId: branch.versionId, editable: branch.editable, meta: branch.meta },
    files: normalizeRemoteFiles(branch, repositoryType, packId),
  };
}

async function saveBranchSelection(req, applicationId, body) {
  assertCsrf(req);
  await mappingForApplication(req, applicationId);
  const repositoryType = String(body.repositoryType || '');
  const config = REPOSITORY_CONFIG[repositoryType];
  if (!config) throw new CdeApiError('CDE_REPOSITORY_TYPE_INVALID', 'Repository type is invalid.', 400);
  const mapping = await getPrismaClient().cdeApplicationMapping.findUnique({ where: { applicationId: String(applicationId) } });
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
  const testPackId = String(body.testPackId || '').trim();
  if (!testPackId.startsWith('dservice/package/') || testPackId.includes('..')) {
    throw new CdeApiError('CDE_MAPPING_INVALID', 'Playwright package must be a Data Service package ID.', 400);
  }
  if (!body.testBranchRandId && !Number.isInteger(body.testBranchIndex)) {
    throw new CdeApiError('CDE_MAPPING_INVALID', 'An explicit personal Playwright branch selector is required.', 400);
  }
  return {
    applicationId: String(applicationId),
    serviceId: 'cde.edus.ir',
    projectKey,
    webUiRepoName: repo(body.webUiRepoName || `${projectKey}/web-ui`, 'web-ui'),
    dataServiceRepoName: repo(body.dataServiceRepoName || `${projectKey}/data-service`, 'data-service'),
    apiModuleRepoName: repo(body.apiModuleRepoName || `${projectKey}/api-module`, 'api-module'),
    messageConsumerRepoName: repo(body.messageConsumerRepoName, 'message-consumer'),
    testRepoName: repo(body.testRepoName, 'data-service', true),
    testPackId,
    testBranchRandId: body.testBranchRandId ? String(body.testBranchRandId) : null,
    testBranchIndex: Number.isInteger(body.testBranchIndex) ? body.testBranchIndex : null,
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
  return prisma.cdeApplicationMapping.upsert({
    where: { applicationId: String(applicationId) },
    create: data,
    update: data,
  });
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
    const pack = await loadPackageItem(req, mapping, 'TESTS', mapping.testRepoName, mapping.testPackId);
    const selector = { kind: 'PERSONAL', ...(mapping.testBranchRandId ? { randId: mapping.testBranchRandId } : {}), ...(Number.isInteger(mapping.testBranchIndex) ? { index: mapping.testBranchIndex } : {}) };
    const branch = repositoryBranches(pack, 'TESTS').find(candidate => selectorMatches(candidate, selector));
    if (!branch) throw new CdeApiError('CDE_TEST_BRANCH_NOT_FOUND', 'Configured Playwright branch was not found.', 404);
    if (!branch.editable) throw new CdeApiError('CDE_TEST_BRANCH_READ_ONLY', 'Configured Playwright branch is not editable.', 409);
    if (branch.value?.content?.type !== 'JS') throw new CdeApiError('CDE_TEST_PACKAGE_INVALID', 'Configured Playwright package is not a JS Data Service package.', 409);
    await prisma.cdeApplicationMapping.update({
      where: { applicationId: String(applicationId) },
      data: { lastValidationStatus: 'HEALTHY', lastValidatedAt: new Date() },
    });
    return { valid: true, versionId: branch.versionId, editable: true };
  } catch (error) {
    await prisma.cdeApplicationMapping.update({
      where: { applicationId: String(applicationId) },
      data: { lastValidationStatus: error.category || 'FAILED', lastValidatedAt: new Date() },
    });
    throw error;
  }
}

function configuredTestSelector(mapping) {
  return {
    kind: 'PERSONAL',
    ...(mapping.testBranchRandId ? { randId: mapping.testBranchRandId } : {}),
    ...(Number.isInteger(mapping.testBranchIndex) ? { index: mapping.testBranchIndex } : {}),
  };
}

async function loadTestBranch(req, applicationId, options = {}) {
  const mapping = options.mapping || await mappingForApplication(req, applicationId);
  const pack = await loadPackageItem(req, mapping, 'TESTS', mapping.testRepoName, mapping.testPackId);
  const selector = configuredTestSelector(mapping);
  const branch = repositoryBranches(pack, 'TESTS').find(candidate => selectorMatches(candidate, selector));
  if (!branch) throw new CdeApiError('CDE_TEST_BRANCH_NOT_FOUND', 'Configured Playwright branch was not found.', 404);
  if (branch.value?.content?.type !== 'JS') throw new CdeApiError('CDE_TEST_PACKAGE_INVALID', 'Playwright package must be a JS Data Service package.', 409);
  return { mapping, pack, branch };
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

async function syncTestFiles(req, applicationId, mapping, branch) {
  const prisma = getPrismaClient();
  const remoteFiles = normalizeRemoteFiles(branch, 'TESTS', mapping.testPackId);
  const synced = [];
  for (const remote of remoteFiles) {
    if (!TEST_FILE_PATTERN.test(remote.path)) continue;
    const fullPath = testDisplayPath(remote.path);
    const slash = fullPath.lastIndexOf('/');
    const folderPath = slash >= 0 ? fullPath.slice(0, slash) : 'tests';
    const fileName = slash >= 0 ? fullPath.slice(slash + 1) : fullPath;
    const row = await prisma.playwrightTestFile.upsert({
      where: { applicationId_fullPath: { applicationId: String(applicationId), fullPath } },
      create: {
        applicationId: String(applicationId),
        rootKind: 'TESTS',
        rootUrl: `cde://${mapping.testRepoName}/${mapping.testPackId}`,
        source: 'CDE',
        folderPath,
        relativeFolderPath: folderPath.replace(/^tests\/?/, ''),
        fileName,
        fullPath,
        script: remote.code,
        createdById: req.utmsContext.userId,
        remoteRepoName: mapping.testRepoName,
        remotePackId: mapping.testPackId,
        remoteBranchKind: 'PERSONAL',
        remoteBranchRandId: branch.selector.randId || null,
        remoteBranchIndex: Number.isInteger(branch.selector.index) ? branch.selector.index : null,
        remoteVersionId: branch.versionId,
        remotePath: remote.path,
        sourceHash: hash(remote.code),
        syncedAt: new Date(),
      },
      update: {
        rootKind: 'TESTS',
        rootUrl: `cde://${mapping.testRepoName}/${mapping.testPackId}`,
        source: 'CDE',
        folderPath,
        relativeFolderPath: folderPath.replace(/^tests\/?/, ''),
        fileName,
        script: remote.code,
        remoteRepoName: mapping.testRepoName,
        remotePackId: mapping.testPackId,
        remoteBranchKind: 'PERSONAL',
        remoteBranchRandId: branch.selector.randId || null,
        remoteBranchIndex: Number.isInteger(branch.selector.index) ? branch.selector.index : null,
        remoteVersionId: branch.versionId,
        remotePath: remote.path,
        sourceHash: hash(remote.code),
        syncedAt: new Date(),
      },
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
  const loaded = await loadTestBranch(req, applicationId);
  const remoteRows = await syncTestFiles(req, applicationId, loaded.mapping, loaded.branch);
  const remotePaths = new Set(remoteRows.map(row => row.fullPath));
  const legacy = await getPrismaClient().playwrightTestFile.findMany({
    where: { applicationId: String(applicationId), source: { in: ['MANAGED', 'DISCOVERED'] } },
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
    branch: { selector: loaded.branch.selector, versionId: loaded.branch.versionId, editable: loaded.branch.editable },
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
    existing = await prisma.playwrightTestFile.findFirst({ where: { id: existingId, applicationId: String(applicationId), source: 'CDE' } });
    if (!existing) throw new CdeApiError('PLAYWRIGHT_FILE_NOT_FOUND', 'CDE Playwright file was not found.', 404);
  }
  const targetPath = normalizeTestPath(body.path || existing?.remotePath || existing?.fullPath || '');
  const source = String(body.script ?? body.code ?? '');
  if (!source.trim()) throw new CdeApiError('PLAYWRIGHT_SCRIPT_REQUIRED', 'Playwright source is required.', 422);
  if (Buffer.byteLength(source) > 2 * 1024 * 1024) throw new CdeApiError('PLAYWRIGHT_FILE_TOO_LARGE', 'Playwright file exceeds two MiB.', 413);
  const mapping = await mappingForApplication(req, applicationId);
  const lockIdentity = hash(`${mapping.testRepoName}\0${mapping.testPackId}\0${mapping.testBranchRandId || mapping.testBranchIndex}`);
  const release = await acquireCdeWriteLock(lockIdentity, 60_000);
  if (!release) throw new CdeApiError('CDE_WRITE_BUSY', 'Another save is already updating this CDE branch.', 409);
  try {
    const loaded = await loadTestBranch(req, applicationId, { mapping });
    if (!loaded.branch.editable) throw new CdeApiError('CDE_TEST_BRANCH_READ_ONLY', 'Configured Playwright branch is not editable.', 409);
    const expectedVersionId = String(body.expectedVersionId || '');
    if (!expectedVersionId || expectedVersionId !== String(loaded.branch.versionId || '')) {
      throw new CdeApiError('CDE_WRITE_CONFLICT', 'The CDE branch changed. Reload it before saving.', 409, { currentVersionId: loaded.branch.versionId });
    }
    const personal = JSON.parse(JSON.stringify(loaded.branch.value));
    const files = personal.content.content.map(file => ({ ...file, name: normalizeSourcePath(file.name) }));
    const previousPath = existing?.remotePath || null;
    const collision = files.find(file => file.name.toLowerCase() === targetPath.toLowerCase() && file.name !== previousPath);
    if (collision) throw new CdeApiError('PLAYWRIGHT_TEST_FILE_ALREADY_EXISTS', 'A CDE file already exists at this path.', 409);
    let replaced = false;
    const nextFiles = files.map(file => {
      if (previousPath && file.name === previousPath) {
        replaced = true;
        return { name: targetPath, code: source, oppend: false };
      }
      return file;
    });
    if (!replaced) nextFiles.push({ name: targetPath, code: source, oppend: false });
    personal.content = compileDataServiceBranchContent({ ...personal.content, content: nextFiles });
    const saveResponse = await callForm(req, 'cde/package/any/personal/save', {
      personal,
      _id: loaded.pack._id || mapping.testPackId,
      packType: 'data-service',
      commitDesc: String(body.commitDesc || `UTMS: ${existing ? 'update' : 'create'} ${targetPath}`).slice(0, 500),
    }, { requireLogin: true });
    const savedVersionId = resultOf(saveResponse).versionId;
    if (!savedVersionId) throw new CdeApiError('CDE_WRITE_FAILED', 'CDE did not return a version after saving.', 502);
    const verified = await loadTestBranch(req, applicationId, { mapping });
    if (String(verified.branch.versionId || '') !== String(savedVersionId) || String(savedVersionId) === expectedVersionId) {
      throw new CdeApiError('CDE_WRITE_CONFLICT', 'The CDE version returned by save did not match the refetched branch.', 409, {
        expectedVersionId,
        savedVersionId,
        currentVersionId: verified.branch.versionId,
      });
    }
    const verifiedFile = normalizeRemoteFiles(verified.branch, 'TESTS', mapping.testPackId).find(file => file.path === targetPath);
    if (!verifiedFile || hash(verifiedFile.code) !== hash(source)) {
      throw new CdeApiError('CDE_WRITE_CONFLICT', 'The saved CDE source could not be verified.', 409, { savedVersionId });
    }
    const rows = await syncTestFiles(req, applicationId, mapping, verified.branch);
    const row = rows.find(item => item.remotePath === targetPath);
    if (!row) throw new CdeApiError('CDE_WRITE_FAILED', 'Saved file metadata could not be synchronized.', 502);
    if (body.description !== undefined) {
      await prisma.playwrightTestFile.update({ where: { id: row.id }, data: { description: String(body.description || '').slice(0, 700) || null } });
    }
    await prisma.auditLog.create({
      data: {
        userId: req.utmsContext.userId,
        applicationId: String(applicationId),
        entityType: 'PLAYWRIGHT_TEST_FILE',
        entityId: row.id,
        action: existing ? 'UPDATE' : 'CREATE',
        previousValue: existing ? JSON.stringify({ path: existing.remotePath, hash: existing.sourceHash, versionId: existing.remoteVersionId }) : null,
        newValue: JSON.stringify({ path: targetPath, hash: hash(source), versionId: verified.branch.versionId }),
        metadata: { repoName: mapping.testRepoName, packId: mapping.testPackId, branch: verified.branch.selector },
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

function serializeEnvironment(row) {
  return {
    id: row.id,
    applicationId: row.applicationId,
    name: row.name,
    webBaseUrl: row.webBaseUrl,
    apiBaseUrl: row.apiBaseUrl,
    gatewayBaseUrl: row.gatewayBaseUrl,
    enabled: row.enabled,
  };
}

async function environments(req, applicationId) {
  assertApplicationScope(req, applicationId);
  return (await getPrismaClient().applicationEnvironment.findMany({
    where: { applicationId: String(applicationId), enabled: true },
    orderBy: { name: 'asc' },
  })).map(serializeEnvironment);
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
  const data = {
    applicationId: String(applicationId),
    name: String(body.name || '').trim().slice(0, 120),
    webBaseUrl: validateEnvironmentUrl(body.webBaseUrl, true),
    apiBaseUrl: validateEnvironmentUrl(body.apiBaseUrl, false),
    gatewayBaseUrl: validateEnvironmentUrl(body.gatewayBaseUrl, false),
    secretReferences: body.secretReferences && typeof body.secretReferences === 'object'
      ? body.secretReferences
      : existing?.secretReferences || {},
    enabled: body.enabled !== false,
  };
  if (!data.name) throw new CdeApiError('ENVIRONMENT_NAME_REQUIRED', 'Environment name is required.', 400);
  const row = environmentId
    ? await prisma.applicationEnvironment.update({ where: { id: environmentId }, data })
    : await prisma.applicationEnvironment.create({ data });
  return serializeEnvironment(row);
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

async function materializeSnapshot(req, applicationId, environment) {
  const mapping = await mappingForApplication(req, applicationId);
  const files = [];
  const packages = [];
  for (const repositoryType of ['WEB_UI', 'DATA_SERVICE', 'API_MODULE', 'MESSAGE_CONSUMER']) {
    await snapshotRepository(req, applicationId, mapping, repositoryType, files, packages);
  }
  const tests = await loadTestBranch(req, applicationId, { mapping });
  const testRemoteFiles = normalizeRemoteFiles(tests.branch, 'TESTS', mapping.testPackId);
  const testFiles = testRemoteFiles.map(file => {
    const path = snapshotFilePath('TESTS', mapping.testPackId, tests.branch, file);
    const sourceHash = hash(file.code);
    files.push({ path, code: file.code, sourceHash, readOnly: true });
    return { path, sourceHash };
  });
  packages.push({
    repositoryType: 'TESTS',
    repoName: mapping.testRepoName,
    packId: mapping.testPackId,
    selector: tests.branch.selector,
    versionId: tests.branch.versionId || null,
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
    format: 1,
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
  await mappingForApplication(req, applicationId);
  const prisma = getPrismaClient();
  const environment = await prisma.applicationEnvironment.findFirst({
    where: { id: String(body.environmentProfileId || ''), applicationId, enabled: true },
  });
  if (!environment) throw new CdeApiError('PLAYWRIGHT_ENVIRONMENT_REQUIRED', 'Select an enabled deployed environment.', 422);
  const testFile = await prisma.playwrightTestFile.findFirst({
    where: { id: String(body.testFileId || ''), applicationId, source: 'CDE' },
  });
  if (!testFile?.remotePath) throw new CdeApiError('PLAYWRIGHT_TEST_FILE_REQUIRED', 'Select a CDE-backed Playwright test file.', 422);
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
        manifest: {},
        expiresAt,
      },
    });
    const run = await transaction.playwrightRun.create({
      data: {
        applicationId,
        environmentProfileId: environment.id,
        snapshotId: snapshot.id,
        testFileId: testFile.id,
        testFilePath: testFile.remotePath,
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
    const bundle = await materializeSnapshot(internalRequest, snapshot.applicationId, run.environmentProfile);
    const objectKey = `snapshots/${snapshot.applicationId}/${snapshot.id}.json.enc`;
    await putEncryptedObject(objectKey, Buffer.from(JSON.stringify(bundle)), 'application/json');
    await prisma.$transaction([
      prisma.cdeSourceSnapshot.update({
        where: { id: snapshot.id },
        data: { status: 'READY', objectKey, manifest: bundle.manifest, contentHash: bundle.contentHash, initiatingSessionId: null },
      }),
      prisma.playwrightRun.update({
        where: { id: run.id },
        data: { status: 'QUEUED', queueStatus: 'QUEUED' },
      }),
    ]);
    await enqueueRun(run.id, snapshot.id);
    return { snapshotId: snapshot.id, runId: run.id, contentHash: bundle.contentHash };
  } catch (error) {
    await prisma.$transaction([
      prisma.cdeSourceSnapshot.update({ where: { id: snapshot.id }, data: { status: 'FAILED', errorCode: error.category || 'SNAPSHOT_FAILED', errorMessage: String(error.message || 'Snapshot failed.').slice(0, 4000), initiatingSessionId: null } }),
      prisma.playwrightRun.update({ where: { id: run.id }, data: { status: 'ERROR', queueStatus: 'FAILED', completedAt: new Date(), logs: 'CDE snapshot materialization failed.' } }),
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

  throw new CdeApiError('CDE_ENDPOINT_NOT_FOUND', 'CDE endpoint not found.', 404);
}

module.exports = {
  CdeApiError,
  canHandleCde,
  catalog,
  handleCde,
  normalizeRemoteFiles,
  materializeSnapshot,
  projectRepositoryName,
  repositoryBranches,
  selectorMatches,
};
