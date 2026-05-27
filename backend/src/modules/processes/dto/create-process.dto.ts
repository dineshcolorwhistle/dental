import { IsNotEmpty, IsOptional, IsString, MaxLength, MinLength, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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
    example: 'Design',
    description: 'Workflow execution category/area (e.g. Scanning, Design, Milling, QC)',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  processArea: string;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'ID of the pre-assigned default technician',
  })
  @IsUUID()
  @IsNotEmpty()
  defaultTechnicianId: string;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Branch ID this process is assigned to (optional, auto-forced for Admin)',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  branchId?: string;
}
