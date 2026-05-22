import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateDoctorDto {
  @ApiProperty({
    example: 'Dr. John Watson',
    description: 'Name of the doctor',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({
    example: 'Baker Street Dental Clinic',
    description: 'Name of the clinic/hospital',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  clinicName?: string;

  @ApiProperty({
    example: 'john.watson@example.com',
    description: 'Email address of the doctor',
    required: false,
  })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({
    example: '+919876543210',
    description: 'Contact phone number of the doctor',
    required: false,
  })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({
    example: '221B Baker St, London',
    description: 'Address of the doctor/clinic',
    required: false,
  })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Branch ID this doctor is associated with',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  branchId?: string;
}
