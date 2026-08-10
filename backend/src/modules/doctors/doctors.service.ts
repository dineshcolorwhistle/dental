import { randomUUID } from 'crypto';
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDoctorDto, UpdateDoctorDto, CreateDoctorListDto, UpdateDoctorListDto } from './dto';

@Injectable()
export class DoctorsService {
  private readonly logger = new Logger(DoctorsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(
    tenantId: string,
    branchIdContext: string | null,
    userRole: string,
    dto: CreateDoctorDto,
  ) {
    const { name, clinicName, email, phone, address, branchId } = dto;

    // If logged in as ADMIN, force their branch context
    let finalBranchId = branchId;
    if (userRole === 'ADMIN') {
      if (!branchIdContext) {
        throw new BadRequestException(
          'Branch context is required for administrators.',
        );
      }
      finalBranchId = branchIdContext;
    }

    // Verify branch belongs to the tenant if provided
    if (finalBranchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: finalBranchId, tenantId },
      });
      if (!branch) {
        throw new NotFoundException(
          `Branch with ID "${finalBranchId}" does not exist in your organization.`,
        );
      }
    }

    const doctor = await this.prisma.doctor.create({
      data: {
        tenantId,
        branchId: finalBranchId || null,
        name,
        clinicName,
        email,
        phone,
        address,
      },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    this.logger.log(
      `Doctor created: ${doctor.name} (${doctor.id}) for tenant ${tenantId}`,
    );
    return doctor;
  }

  async findAll(tenantId: string, branchIdFilter?: string) {
    return this.prisma.doctor.findMany({
      where: {
        tenantId,
        ...(branchIdFilter &&
          branchIdFilter !== 'ALL' && { branchId: branchIdFilter }),
      },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string, branchIdContext?: string | null) {
    const doctor = await this.prisma.doctor.findFirst({
      where: {
        id,
        tenantId,
        ...(branchIdContext && { branchId: branchIdContext }),
      },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    if (!doctor) {
      throw new NotFoundException(`Doctor with ID "${id}" not found.`);
    }

    return doctor;
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateDoctorDto,
    branchIdContext?: string | null,
  ) {
    // Verify existence
    await this.findOne(tenantId, id, branchIdContext);

    const { name, clinicName, email, phone, address, branchId, isActive } = dto;

    if (branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: branchId, tenantId },
      });
      if (!branch) {
        throw new NotFoundException(
          `Branch with ID "${branchId}" does not exist in your organization.`,
        );
      }
    }

    const updated = await this.prisma.doctor.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(clinicName !== undefined && { clinicName }),
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone }),
        ...(address !== undefined && { address }),
        ...(branchId !== undefined && { branchId }),
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    this.logger.log(`Doctor updated: ${updated.name} (${updated.id})`);
    return updated;
  }

  async remove(tenantId: string, id: string, branchIdContext?: string | null) {
    // Verify existence
    await this.findOne(tenantId, id, branchIdContext);

    await this.prisma.doctor.delete({
      where: { id },
    });

    this.logger.log(`Doctor deleted: ${id} inside tenant ${tenantId}`);
    return { success: true };
  }

  // ─── Doctor Lists Management (SQL Query Implementation) ─────

  async findAllLists(tenantId: string, branchIdFilter?: string) {
    let whereClause = `WHERE dl.tenant_id = '${tenantId}'`;
    if (branchIdFilter && branchIdFilter !== 'ALL') {
      whereClause += ` AND dl.branch_id = '${branchIdFilter}'`;
    }

    const lists: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT 
        dl.id,
        dl.tenant_id AS "tenantId",
        dl.branch_id AS "branchId",
        dl.name,
        dl.description,
        dl.created_at AS "createdAt",
        dl.updated_at AS "updatedAt",
        CASE WHEN b.id IS NOT NULL THEN json_build_object('id', b.id, 'name', b.name, 'code', b.code) ELSE NULL END AS "branch"
      FROM "doctor_lists" dl
      LEFT JOIN "branches" b ON b.id = dl.branch_id
      ${whereClause}
      ORDER BY dl.created_at DESC
    `);

    if (lists.length === 0) return [];

    const listIds = lists.map((l) => `'${l.id}'`).join(',');
    const members: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT 
        dlm.id,
        dlm.list_id AS "listId",
        dlm.doctor_id AS "doctorId",
        dlm.created_at AS "createdAt",
        json_build_object(
          'id', d.id,
          'name', d.name,
          'clinicName', d.clinic_name,
          'email', d.email,
          'phone', d.phone
        ) AS "doctor"
      FROM "doctor_list_members" dlm
      JOIN "doctors" d ON d.id = dlm.doctor_id
      WHERE dlm.list_id IN (${listIds})
    `);

    const membersByListId: Record<string, any[]> = {};
    for (const m of members) {
      if (!membersByListId[m.listId]) membersByListId[m.listId] = [];
      membersByListId[m.listId].push(m);
    }

    return lists.map((l) => ({
      ...l,
      members: membersByListId[l.id] || [],
    }));
  }

  async findListById(
    tenantId: string,
    id: string,
    branchIdContext?: string | null,
  ) {
    let whereClause = `WHERE dl.id = '${id}' AND dl.tenant_id = '${tenantId}'`;
    if (branchIdContext) {
      whereClause += ` AND dl.branch_id = '${branchIdContext}'`;
    }

    const lists: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT 
        dl.id,
        dl.tenant_id AS "tenantId",
        dl.branch_id AS "branchId",
        dl.name,
        dl.description,
        dl.created_at AS "createdAt",
        dl.updated_at AS "updatedAt",
        CASE WHEN b.id IS NOT NULL THEN json_build_object('id', b.id, 'name', b.name, 'code', b.code) ELSE NULL END AS "branch"
      FROM "doctor_lists" dl
      LEFT JOIN "branches" b ON b.id = dl.branch_id
      ${whereClause}
    `);

    if (!lists || lists.length === 0) {
      throw new NotFoundException(`Doctor list with ID "${id}" not found.`);
    }

    const list = lists[0];
    const members: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT 
        dlm.id,
        dlm.list_id AS "listId",
        dlm.doctor_id AS "doctorId",
        dlm.created_at AS "createdAt",
        json_build_object(
          'id', d.id,
          'name', d.name,
          'clinicName', d.clinic_name,
          'email', d.email,
          'phone', d.phone
        ) AS "doctor"
      FROM "doctor_list_members" dlm
      JOIN "doctors" d ON d.id = dlm.doctor_id
      WHERE dlm.list_id = '${id}'
    `);

    list.members = members || [];
    return list;
  }

  async createList(
    tenantId: string,
    branchIdContext: string | null,
    userRole: string,
    dto: CreateDoctorListDto,
  ) {
    const { name, description, branchId, doctorIds = [] } = dto;

    let finalBranchId = branchId;
    if (userRole === 'ADMIN') {
      if (!branchIdContext) {
        throw new BadRequestException(
          'Branch context is required for administrators.',
        );
      }
      finalBranchId = branchIdContext;
    }

    if (finalBranchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: finalBranchId, tenantId },
      });
      if (!branch) {
        throw new NotFoundException(
          `Branch with ID "${finalBranchId}" does not exist in your organization.`,
        );
      }
    }

    const listId = randomUUID();
    const branchVal = finalBranchId ? `'${finalBranchId}'` : 'NULL';
    const descVal = description ? `'${description.replace(/'/g, "''")}'` : 'NULL';
    const safeName = name.replace(/'/g, "''");

    await this.prisma.$executeRawUnsafe(`
      INSERT INTO "doctor_lists" ("id", "tenant_id", "branch_id", "name", "description", "created_at", "updated_at")
      VALUES ('${listId}', '${tenantId}', ${branchVal}, '${safeName}', ${descVal}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    if (doctorIds.length > 0) {
      for (const doctorId of doctorIds) {
        const memberId = randomUUID();
        await this.prisma.$executeRawUnsafe(`
          INSERT INTO "doctor_list_members" ("id", "list_id", "doctor_id", "created_at")
          VALUES ('${memberId}', '${listId}', '${doctorId}', CURRENT_TIMESTAMP)
          ON CONFLICT DO NOTHING
        `);
      }
    }

    this.logger.log(`Doctor list created: ${name} (${listId})`);
    return this.findListById(tenantId, listId, branchIdContext);
  }

  async updateList(
    tenantId: string,
    id: string,
    dto: UpdateDoctorListDto,
    branchIdContext?: string | null,
  ) {
    await this.findListById(tenantId, id, branchIdContext);

    const { name, description, branchId, doctorIds } = dto;

    if (branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: branchId, tenantId },
      });
      if (!branch) {
        throw new NotFoundException(
          `Branch with ID "${branchId}" does not exist in your organization.`,
        );
      }
    }

    const setFields: string[] = ['"updated_at" = CURRENT_TIMESTAMP'];
    if (name) {
      setFields.push(`"name" = '${name.replace(/'/g, "''")}'`);
    }
    if (description !== undefined) {
      setFields.push(description ? `"description" = '${description.replace(/'/g, "''")}'` : `"description" = NULL`);
    }
    if (branchId !== undefined) {
      setFields.push(branchId ? `"branch_id" = '${branchId}'` : `"branch_id" = NULL`);
    }

    await this.prisma.$executeRawUnsafe(`
      UPDATE "doctor_lists"
      SET ${setFields.join(', ')}
      WHERE "id" = '${id}'
    `);

    if (doctorIds !== undefined) {
      await this.prisma.$executeRawUnsafe(`
        DELETE FROM "doctor_list_members" WHERE "list_id" = '${id}'
      `);
      if (doctorIds.length > 0) {
        for (const doctorId of doctorIds) {
          const memberId = randomUUID();
          await this.prisma.$executeRawUnsafe(`
            INSERT INTO "doctor_list_members" ("id", "list_id", "doctor_id", "created_at")
            VALUES ('${memberId}', '${id}', '${doctorId}', CURRENT_TIMESTAMP)
            ON CONFLICT DO NOTHING
          `);
        }
      }
    }

    this.logger.log(`Doctor list updated: ${id}`);
    return this.findListById(tenantId, id, branchIdContext);
  }

  async deleteList(
    tenantId: string,
    id: string,
    branchIdContext?: string | null,
  ) {
    await this.findListById(tenantId, id, branchIdContext);

    await this.prisma.$executeRawUnsafe(`
      DELETE FROM "doctor_lists" WHERE "id" = '${id}'
    `);

    this.logger.log(`Doctor list deleted: ${id}`);
    return { success: true };
  }
}
