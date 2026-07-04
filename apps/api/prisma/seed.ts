import { PrismaClient, RoleName } from '@prisma/client';

/**
 * Idempotent seed: ensures the base roles exist. Safe to run repeatedly
 * (uses upsert), so it can run on every deploy.
 */
const prisma = new PrismaClient();

async function main(): Promise<void> {
  const roles: { name: RoleName; description: string }[] = [
    { name: RoleName.STUDENT, description: 'Default role for students.' },
    { name: RoleName.ADMIN, description: 'Manages content, users, and analytics.' },
    { name: RoleName.SUPER_ADMIN, description: 'Full platform administration.' },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description },
      create: role,
    });
  }

  // eslint-disable-next-line no-console
  console.log(`Seeded ${roles.length} roles.`);
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
