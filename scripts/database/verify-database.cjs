const fs = require('fs');
const path = require('path');

const schemaPath = path.join(process.cwd(), 'database', 'prisma', 'schema.prisma');

if (!fs.existsSync(schemaPath)) {
  console.error('Missing database/prisma/schema.prisma');
  process.exit(1);
}

console.log('Database structure verified.');
