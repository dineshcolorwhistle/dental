const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const token = await prisma.passwordResetToken.findFirst({
    orderBy: { createdAt: 'desc' }
  });
  console.log('RESET_TOKEN=' + token?.token);
}

main().finally(() => prisma.$disconnect());
