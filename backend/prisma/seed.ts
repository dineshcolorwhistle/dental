import { PrismaClient, UserRole, UserStatus, TenantStatus } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Starting database seed...');

  const passwordHash = await bcrypt.hash('Admin@123456', 12);

  // 1. Create Super Admin
  const saEmail = 'admin@dental.com';
  const existingSuperAdmin = await prisma.user.findFirst({
    where: { email: saEmail },
  });

  if (!existingSuperAdmin) {
    await prisma.user.create({
      data: {
        email: saEmail,
        passwordHash,
        firstName: 'Super',
        lastName: 'Admin',
        role: UserRole.SUPER_ADMIN,
        status: UserStatus.ACTIVE,
        tenantId: null,
        branchId: null,
      },
    });
    console.log(`✅ Super Admin created: ${saEmail}`);
  } else {
    console.log('ℹ️ Super Admin already exists.');
  }

  // 2. Create Default Tenant
  const tenantName = 'Smile Dental Lab';
  const subdomain = 'smile';
  let tenant = await prisma.tenant.findUnique({
    where: { subdomain },
  });

  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: tenantName,
        subdomain,
        status: TenantStatus.ACTIVE,
        contactEmail: 'owner@dental.com',
      },
    });
    console.log(`✅ Default Tenant created: ${tenantName} (${subdomain})`);

    // Create Tenant Settings
    await prisma.tenantSettings.create({
      data: {
        tenantId: tenant.id,
        features: {
          qrWorkflow: true,
          deliveryModule: true,
          doctorPortal: true,
        },
      },
    });
    console.log('✅ Default Tenant Settings created.');
  } else {
    console.log('ℹ️ Default Tenant already exists.');
  }

  // 3. Create default Branch
  let branch = await prisma.branch.findFirst({
    where: { tenantId: tenant.id, code: 'MAIN' },
  });

  if (!branch) {
    branch = await prisma.branch.create({
      data: {
        tenantId: tenant.id,
        name: 'Main Branch',
        code: 'MAIN',
        isActive: true,
      },
    });
    console.log('✅ Default Branch created: Main Branch (MAIN)');
  } else {
    console.log('ℹ️ Default Branch already exists.');
  }

  // 4. Create Owner user
  const ownerEmail = 'owner@dental.com';
  const existingOwner = await prisma.user.findFirst({
    where: { email: ownerEmail },
  });

  if (!existingOwner) {
    await prisma.user.create({
      data: {
        tenantId: tenant.id,
        branchId: null,
        email: ownerEmail,
        passwordHash,
        firstName: 'John',
        lastName: 'Owner',
        role: UserRole.OWNER,
        status: UserStatus.ACTIVE,
      },
    });
    console.log(`✅ Default Owner created: ${ownerEmail}`);
  } else {
    console.log('ℹ️ Default Owner already exists.');
  }

  // 5. Create Admin user
  const adminEmail = 'admin-branch@dental.com';
  const existingAdmin = await prisma.user.findFirst({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        email: adminEmail,
        passwordHash,
        firstName: 'Sarah',
        lastName: 'Admin',
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
      },
    });
    console.log(`✅ Default Admin created: ${adminEmail}`);
  } else {
    console.log('ℹ️ Default Admin already exists.');
  }

  // 6. Create Technician user
  const techEmail = 'technician@dental.com';
  let tech = await prisma.user.findFirst({
    where: { email: techEmail },
  });

  if (!tech) {
    tech = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        email: techEmail,
        passwordHash,
        firstName: 'Alex',
        lastName: 'Technician',
        role: UserRole.TECHNICIAN,
        status: UserStatus.ACTIVE,
      },
    });
    console.log(`✅ Default Technician created: ${techEmail}`);
  } else {
    console.log('ℹ️ Default Technician already exists.');
  }

  // 7. Create default Doctor
  const doctorEmail = 'drsmith@dental.com';
  let doctor = await prisma.doctor.findFirst({
    where: { tenantId: tenant.id, email: doctorEmail },
  });

  if (!doctor) {
    doctor = await prisma.doctor.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        name: 'Dr. Robert Smith',
        clinicName: 'Robert Smile Dental',
        email: doctorEmail,
        phone: '9876543210',
        isActive: true,
      },
    });
    console.log(`✅ Default Doctor created: Dr. Robert Smith`);
  } else {
    console.log('ℹ️ Default Doctor already exists.');
  }

  // 8. Create default Prosthesis Type
  let prosthesisType = await prisma.prosthesisType.findFirst({
    where: { tenantId: tenant.id, name: 'Zirconia Crown' },
  });

  if (!prosthesisType) {
    prosthesisType = await prisma.prosthesisType.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        name: 'Zirconia Crown',
        description: 'Premium aesthetic multi-layered zirconia crown',
      },
    });
    console.log(`✅ Default Prosthesis Type created: Zirconia Crown`);
  } else {
    console.log('ℹ️ Default Prosthesis Type already exists.');
  }

  // 9. Create default workflow stages (Processes)
  const baseProcesses = [
    { name: 'Scanning', area: 'Scanning', seq: 0 },
    { name: 'Design', area: 'Design', seq: 1 },
    { name: 'Milling', area: 'Milling', seq: 2 },
    { name: 'Finishing', area: 'Finishing', seq: 3 },
    { name: 'QC', area: 'QC', seq: 4 },
  ];

  for (const bp of baseProcesses) {
    let proc = await prisma.process.findFirst({
      where: { tenantId: tenant.id, name: bp.name },
    });

    if (!proc) {
      proc = await prisma.process.create({
        data: {
          tenantId: tenant.id,
          branchId: branch.id,
          name: bp.name,
          processArea: bp.area,
          defaultTechnicianId: tech.id,
        },
      });
      console.log(`✅ Base Process created: ${bp.name}`);
    }

    // Link to Prosthesis Type if not already linked
    const existingLink = await prisma.prosthesisTypeProcess.findFirst({
      where: { prosthesisTypeId: prosthesisType.id, processId: proc.id },
    });

    if (!existingLink) {
      await prisma.prosthesisTypeProcess.create({
        data: {
          prosthesisTypeId: prosthesisType.id,
          processId: proc.id,
          sequence: bp.seq,
        },
      });
      console.log(`🔗 Linked process ${bp.name} to Zirconia Crown sequence ${bp.seq}`);
    }
  }

  console.log('');
  console.log('🔑 DEFAULT LOGIN CREDENTIALS:');
  console.log('----------------------------------------------------');
  console.log('👑 Super Admin:  admin@dental.com         | Admin@123456');
  console.log('🏢 Owner:        owner@dental.com         | Admin@123456');
  console.log('💼 Lab Admin:     admin-branch@dental.com  | Admin@123456');
  console.log('🔧 Technician:   technician@dental.com    | Admin@123456');
  console.log('----------------------------------------------------');
  console.log('🌱 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
