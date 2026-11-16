require('../backend/node_modules/dotenv').config({ path: 'backend/.env' });
const { PrismaClient } = require('../backend/node_modules/@prisma/client');
const db = new PrismaClient();
db.websiteDonationSettings.count()
  .then(count => console.log('Donation table accessible; configured institutions:', count))
  .catch(error => { console.error(error.message); process.exitCode = 1; })
  .finally(() => db.$disconnect());
