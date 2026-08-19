import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  IsUUID,
  IsEnum,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ProcessType } from '@prisma/client';

export class CreateProcessDto {
  @ApiProperty({
    example: 'CAD Design Stage',
    description: 'Name of the process/stage',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({
    enum: ProcessType,
    example: 'PRODUCTION',
    description:
      'Type of process (PRODUCTION, INTERNAL_VERIFICATION, EXTERNAL_VERIFICATION)',
    required: false,
  })
  @IsEnum(ProcessType)
  @IsOptional()
  type?: ProcessType;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Process Area ID',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  processAreaId?: string;

  @ApiProperty({
    example: 'Design',
    description: 'Legacy process area name (optional)',
    required: false,
  })
  @IsString()
  @IsOptional()
  processArea?: string;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'ID of the pre-assigned default technician or admin',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  defaultTechnicianId?: string;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description:
      'Branch ID this process is assigned to (optional, auto-forced for Admin)',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  branchId?: string;
}
