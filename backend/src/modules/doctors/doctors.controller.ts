import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { DoctorsService } from './doctors.service';
import { CreateDoctorDto, UpdateDoctorDto } from './dto';
import { Roles, CurrentUser } from '../../common/decorators';

@ApiTags('Doctors')
@ApiBearerAuth()
@Controller('doctors')
@Roles(UserRole.ADMIN, UserRole.OWNER)
export class DoctorsController {
  constructor(private readonly doctorsService: DoctorsService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new doctor/clinic record' })
  async create(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('branchId') branchIdContext: string | null,
    @CurrentUser('role') userRole: string,
    @Body() dto: CreateDoctorDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    return this.doctorsService.create(tenantId, branchIdContext, userRole, dto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.TECHNICIAN)
  @ApiOperation({ summary: 'List all doctors/clinics' })
  async findAll(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('branchId') branchIdContext: string | null,
    @CurrentUser('role') userRole: string,
    @Query('branchId') branchIdFilter?: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }

    // For branch admin or technician, implicitly force branch scoping
    if (userRole === 'ADMIN' || userRole === 'TECHNICIAN') {
      return this.doctorsService.findAll(
        tenantId,
        branchIdContext || undefined,
      );
    }

    // For owner, use query filter if provided
    return this.doctorsService.findAll(tenantId, branchIdFilter);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details of a specific doctor/clinic' })
  async findOne(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('branchId') branchIdContext: string | null,
    @CurrentUser('role') userRole: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    const branchContext = userRole === 'ADMIN' ? branchIdContext : null;
    return this.doctorsService.findOne(
      tenantId,
      id,
      branchContext || undefined,
    );
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Update a specific doctor/clinic's details" })
  async update(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('branchId') branchIdContext: string | null,
    @CurrentUser('role') userRole: string,
    @Param('id') id: string,
    @Body() dto: UpdateDoctorDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    const branchContext = userRole === 'ADMIN' ? branchIdContext : null;
    return this.doctorsService.update(
      tenantId,
      id,
      dto,
      branchContext || undefined,
    );
  }

  @Delete(':id')
  @Roles(UserRole.OWNER, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a doctor/clinic record' })
  async remove(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('branchId') branchIdContext: string | null,
    @CurrentUser('role') userRole: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    const branchContext = userRole === 'ADMIN' ? branchIdContext : null;
    return this.doctorsService.remove(tenantId, id, branchContext || undefined);
  }
}
