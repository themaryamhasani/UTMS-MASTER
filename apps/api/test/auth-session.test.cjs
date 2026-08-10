const assert = require('node:assert/strict');
const test = require('node:test');

const { sessionContext } = require('../src/modules/auth/auth-session-server.cjs');

function application(id, createdAt) {
  return {
    id,
    name: `Application ${id}`,
    code: id.toUpperCase(),
    description: null,
    workflowPolicyId: null,
    isActive: true,
    createdAt,
    updatedAt: createdAt,
  };
}

function session(scope) {
  const timestamp = new Date('2026-01-01T00:00:00.000Z');
  return {
    contextId: 'context:user-admin:SYSTEM_ADMIN:assignment-admin',
    userId: 'user-admin',
    user: {
      id: 'user-admin',
      nationalCode: null,
      phoneNumber: '09120000000',
      fullName: 'System Admin',
      email: null,
      isActive: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    assignmentId: 'assignment-admin',
    assignment: { role: 'SYSTEM_ADMIN' },
    role: 'SYSTEM_ADMIN',
    scope,
    applicationId: 'app-existing',
    scopeApplicationIds: ['app-existing'],
  };
}

test('APP sessions include applications created after the session was issued', async () => {
  const timestamp = new Date('2026-01-01T00:00:00.000Z');
  let receivedWhere;
  const prisma = {
    application: {
      findMany: async query => {
        receivedWhere = query.where;
        return [application('app-existing', timestamp), application('app-new', timestamp)];
      },
    },
  };

  const context = await sessionContext(prisma, session('APP'));

  assert.deepEqual(receivedWhere, { isActive: true });
  assert.equal(context.applicationId, 'ALL');
  assert.deepEqual(context.scopeApplicationIds, ['app-existing', 'app-new']);
  assert.deepEqual(context.applications.map(item => item.id), ['app-existing', 'app-new']);
});

test('SYSTEMS sessions retain their assigned application filter', async () => {
  const prisma = {
    application: {
      findMany: async query => {
        assert.deepEqual(query.where, { id: { in: ['app-existing'] }, isActive: true });
        return [application('app-existing', new Date('2026-01-01T00:00:00.000Z'))];
      },
    },
  };

  const context = await sessionContext(prisma, session('SYSTEMS'));
  assert.deepEqual(context.scopeApplicationIds, ['app-existing']);
});
