import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL environment variable is not defined.');
  process.exit(1);
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🏁 Starting Process Area data migration...');
  
  // 1. Get all processes
  const processes = await prisma.process.findMany();
  console.log(`Found ${processes.length} total processes to analyze.`);

  let createdCount = 0;
  let linkedCount = 0;

  for (const process of processes) {
    const { tenantId, branchId, processArea: areaName } = process;
    
    if (!areaName) {
      console.log(`⚠️ Process ${process.id} has no processArea string. Skipping.`);
      continue;
    }

    // 2. Find or create the ProcessArea for this tenant and branch (or global/null branch)
    let processArea = await prisma.processArea.findFirst({
      where: {
        tenantId,
        branchId: branchId || null,
        name: areaName,
      },
    });

    if (!processArea) {
      processArea = await prisma.processArea.create({
        data: {
          tenantId,
          branchId: branchId || null,
          name: areaName,
          description: `Automatically created during migration from process "${process.name}"`,
        },
      });
      createdCount++;
      console.log(`✅ Created ProcessArea "${areaName}" for Tenant ${tenantId}, Branch ${branchId || 'GLOBAL'}`);
    }

    // 3. Update the process's processAreaId
    await prisma.process.update({
      where: { id: process.id },
      data: {
        processAreaId: processArea.id,
      },
    });
    linkedCount++;
  }

  console.log(`🎉 Migration complete!`);
  console.log(`- Created ${createdCount} new ProcessArea records`);
  console.log(`- Linked ${linkedCount} processes to ProcessArea IDs`);
}

main()
  .catch((e) => {
    console.error('❌ Data migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
