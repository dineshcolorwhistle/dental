import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsArray,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateDoctorListDto {
  @ApiProperty({
    example: 'VIP Doctors',
    description: 'Name of the doctor group list',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({
    example: 'Priority list for active VIP doctors',
    description: 'Optional description of the doctor group list',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  description?: string;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Branch ID this list is associated with',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  branchId?: string;

  @ApiProperty({
    example: ['doctor-uuid-1', 'doctor-uuid-2'],
    description: 'Array of doctor IDs to assign to this list',
    required: false,
  })
  @IsArray()
  @IsUUID('all', { each: true })
  @IsOptional()
  doctorIds?: string[];
}
