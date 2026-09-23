import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

// Fixed id so local/manual testing can always send the same X-User-Id header.
// Not a real credential: replaced once the Auth step adds real registration
// and password hashing.
const DEV_USER_ID = '00000000-0000-4000-8000-000000000001';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const user = await prisma.user.upsert({
    where: { id: DEV_USER_ID },
    update: {},
    create: {
      id: DEV_USER_ID,
      email: 'dev@example.com',
      passwordHash: 'seed-placeholder-not-a-real-hash',
    },
  });

  console.log(`Seeded dev user ${user.id} (${user.email}) — use this id as the X-User-Id header.`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
