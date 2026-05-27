import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  IsNumber,
  IsEnum,
  IsArray,
  ValidateNested,
  IsBoolean,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class WorkOrderProcessItemDto {
  @ApiProperty({ example: 'CAD Design', description: 'Name of the process step' })
  @IsString()
  @IsNotEmpty()
  processName: string;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'ID of the assigned technician',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  technicianId?: string;

  @ApiProperty({ example: 0, description: 'Sequence/order of this process step' })
  @IsNumber()
  @Min(0)
  sequence: number;

  @ApiProperty({ example: false, description: 'Whether this is a verification step', required: false })
  @IsBoolean()
  @IsOptional()
  isVerification?: boolean;

  @ApiProperty({
    enum: ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED'],
    description: 'Status of this process step',
    required: false,
    default: 'NOT_STARTED',
  })
  @IsEnum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED'])
  @IsOptional()
  status?: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
}

export class CreateWorkOrderDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'ID of the doctor/clinic',
  })
  @IsUUID()
  @IsNotEmpty()
  doctorId: string;

  @ApiProperty({ example: 'John Doe', description: 'Patient name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  patient: string;

  @ApiProperty({ example: 'BOX-42', description: 'Box number', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  boxNumber?: string;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'ID of the prosthesis type',
  })
  @IsUUID()
  @IsNotEmpty()
  prosthesisTypeId: string;

  @ApiProperty({ description: 'Specification details' })
  @IsString()
  @IsNotEmpty()
  specification: string;

  @ApiProperty({ description: 'Additional notes', required: false })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ example: 5000, description: 'Total quote amount' })
  @IsNumber()
  @IsNotEmpty()
  @Min(0.01)
  totalQuote: number;

  @ApiProperty({ example: 2000, description: 'Initial payment amount', required: false })
  @IsNumber()
  @IsOptional()
  @Min(0)
  initialPayment?: number;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Branch ID (optional, auto-forced for Admin)',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  branchId?: string;

  @ApiProperty({
    enum: ['create', 'createAndAssign'],
    description: 'Action to perform: create only or create and assign',
  })
  @IsEnum(['create', 'createAndAssign'])
  @IsNotEmpty()
  action: 'create' | 'createAndAssign';

  @ApiProperty({
    type: [WorkOrderProcessItemDto],
    description: 'List of process steps for this work order',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkOrderProcessItemDto)
  processes: WorkOrderProcessItemDto[];
}
