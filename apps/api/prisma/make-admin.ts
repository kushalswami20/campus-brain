/**
 * Promote a user to ADMIN (or SUPER_ADMIN) by email.
 *
 *   npm run make-admin -- you@example.com
 *   npm run make-admin -- you@example.com SUPER_ADMIN
 */
import { PrismaClient, RoleName } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const email = process.argv[2];
  const roleArg = (process.argv[3] ?? 'ADMIN').toUpperCase();

  if (!email) {
    throw new Error('Usage: npm run make-admin -- <email> [ADMIN|SUPER_ADMIN]');
  }
  if (roleArg !== 'ADMIN' && roleArg !== 'SUPER_ADMIN') {
    throw new Error('Role must be ADMIN or SUPER_ADMIN.');
  }

  const user = await prisma.user.findFirst({ where: { email, deletedAt: null } });
  if (!user) throw new Error(`No user found with email ${email}.`);

  await prisma.user.update({
    where: { id: user.id },
    data: { role: { connect: { name: roleArg as RoleName } } },
  });

  // eslint-disable-next-line no-console
  console.log(`Promoted ${email} to ${roleArg}. Re-login to refresh the token.`);
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
