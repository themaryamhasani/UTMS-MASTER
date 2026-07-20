const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const DEFAULT_DATABASE_URL = 'postgresql://postgres:1234@localhost:5432/UTMS?schema=public';

let pool;
let prisma;

function getDatabaseUrl() {
  return process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
}

function getPrismaClient() {
  if (prisma) return prisma;

  pool = new Pool({ connectionString: getDatabaseUrl() });
  prisma = new PrismaClient({
    adapter: new PrismaPg(pool),
  });
  return prisma;
}

async function disconnectPrismaClient() {
  if (prisma) {
    await prisma.$disconnect();
    prisma = undefined;
  }
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

module.exports = {
  DEFAULT_DATABASE_URL,
  disconnectPrismaClient,
  getDatabaseUrl,
  getPrismaClient,
};
