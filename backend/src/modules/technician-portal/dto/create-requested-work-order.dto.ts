import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRequestedWorkOrderDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'ID of the doctor/clinic',
  })
  @IsUUID()
  @IsNotEmpty()
  doctorId: string;

  @ApiProperty({ example: 'John Doe', description: 'Patient name (optional)', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  patient?: string;

  @ApiProperty({
    example: 'BOX-42',
    description: 'Box number',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  boxNumber?: string;

  @ApiProperty({
    example: 'FILE-101',
    description: 'File number (optional)',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  fileNumber?: string;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'ID of the prosthesis type',
  })
  @IsUUID()
  @IsNotEmpty()
  prosthesisTypeId: string;

  @ApiProperty({ description: 'Specification details', required: false })
  @IsString()
  @IsOptional()
  specification?: string;

  @ApiProperty({ description: 'Color details' })
  @IsString()
  @IsNotEmpty()
  color: string;

  @ApiProperty({ description: 'Additional notes', required: false })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ example: '2026-08-15T00:00:00.000Z', description: 'Target delivery date', required: false })
  @IsString()
  @IsOptional()
  deliveryDate?: string;
}
