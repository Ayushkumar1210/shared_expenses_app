import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Clear existing records
  await prisma.anomaly.deleteMany();
  await prisma.importJob.deleteMany();
  await prisma.expenseShare.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.settlement.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.exchangeRate.deleteMany();
  await prisma.group.deleteMany();
  await prisma.user.deleteMany();

  // Create default exchange rates
  await prisma.exchangeRate.create({
    data: {
      fromCurrency: 'USD',
      toCurrency: 'INR',
      rate: 83.00,
    },
  });

  // Hash password for all default users
  const passwordHash = await bcrypt.hash('password123', 10);

  // Create Users
  const userAisha = await prisma.user.create({
    data: { email: 'aisha@example.com', name: 'Aisha', passwordHash },
  });
  const userRohan = await prisma.user.create({
    data: { email: 'rohan@example.com', name: 'Rohan', passwordHash },
  });
  const userPriya = await prisma.user.create({
    data: { email: 'priya@example.com', name: 'Priya', passwordHash },
  });
  const userMeera = await prisma.user.create({
    data: { email: 'meera@example.com', name: 'Meera', passwordHash },
  });
  const userDev = await prisma.user.create({
    data: { email: 'dev@example.com', name: 'Dev', passwordHash },
  });
  const userSam = await prisma.user.create({
    data: { email: 'sam@example.com', name: 'Sam', passwordHash },
  });

  // Create Group
  const group = await prisma.group.create({
    data: {
      name: 'Cozy Flat',
      description: 'Shared flat expenses for Aisha, Rohan, Priya, Meera, Dev, and Sam',
    },
  });

  // Create Memberships
  // Aisha, Rohan, Priya joined Jan 1, 2026, never left
  await prisma.membership.create({
    data: {
      userId: userAisha.id,
      groupId: group.id,
      joinedAt: new Date('2026-01-01T00:00:00Z'),
      leftAt: null,
    },
  });
  await prisma.membership.create({
    data: {
      userId: userRohan.id,
      groupId: group.id,
      joinedAt: new Date('2026-01-01T00:00:00Z'),
      leftAt: null,
    },
  });
  await prisma.membership.create({
    data: {
      userId: userPriya.id,
      groupId: group.id,
      joinedAt: new Date('2026-01-01T00:00:00Z'),
      leftAt: null,
    },
  });

  // Meera: Jan 1, 2026 to Mar 31, 2026
  await prisma.membership.create({
    data: {
      userId: userMeera.id,
      groupId: group.id,
      joinedAt: new Date('2026-01-01T00:00:00Z'),
      leftAt: new Date('2026-03-31T23:59:59Z'),
    },
  });

  // Dev: Mar 1, 2026 to Mar 15, 2026 (Dev joined only for a trip)
  await prisma.membership.create({
    data: {
      userId: userDev.id,
      groupId: group.id,
      joinedAt: new Date('2026-03-01T00:00:00Z'),
      leftAt: new Date('2026-03-15T23:59:59Z'),
    },
  });

  // Sam: Apr 15, 2026, never left
  await prisma.membership.create({
    data: {
      userId: userSam.id,
      groupId: group.id,
      joinedAt: new Date('2026-04-15T00:00:00Z'),
      leftAt: null,
    },
  });

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
