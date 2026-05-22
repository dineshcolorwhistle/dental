import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDoctorDto, UpdateDoctorDto } from './dto';

@Injectable()
export class DoctorsService {
  private readonly logger = new Logger(DoctorsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, branchIdContext: string | null, userRole: string, dto: CreateDoctorDto) {
    const { name, clinicName, email, phone, address, branchId } = dto;

    // If logged in as ADMIN, force their branch context
    let finalBranchId = branchId;
    if (userRole === 'ADMIN') {
      if (!branchIdContext) {
        throw new BadRequestException('Branch context is required for administrators.');
      }
      finalBranchId = branchIdContext;
    }

    // Verify branch belongs to the tenant if provided
    if (finalBranchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: finalBranchId, tenantId },
      });
      if (!branch) {
        throw new NotFoundException(`Branch with ID "${finalBranchId}" does not exist in your organization.`);
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

    this.logger.log(`Doctor created: ${doctor.name} (${doctor.id}) for tenant ${tenantId}`);
    return doctor;
  }

  async findAll(tenantId: string, branchIdFilter?: string) {
    return this.prisma.doctor.findMany({
      where: {
        tenantId,
        ...(branchIdFilter && branchIdFilter !== 'ALL' && { branchId: branchIdFilter }),
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

  async update(tenantId: string, id: string, dto: UpdateDoctorDto, branchIdContext?: string | null) {
    // Verify existence
    await this.findOne(tenantId, id, branchIdContext);

    const { name, clinicName, email, phone, address, branchId, isActive } = dto;

    if (branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: branchId, tenantId },
      });
      if (!branch) {
        throw new NotFoundException(`Branch with ID "${branchId}" does not exist in your organization.`);
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
}
