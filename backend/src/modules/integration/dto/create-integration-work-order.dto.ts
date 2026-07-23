import { IsNotEmpty, IsString, IsOptional, IsEmail, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateIntegrationWorkOrderDto {
  @ApiProperty({ example: 'https://smiledental.com', description: 'The unique URL of the clinic' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  clinicUrl: string;

  @ApiProperty({ example: 'Dr. Jane Doe', description: 'The name of the doctor' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  doctorName: string;

  @ApiProperty({ example: 'jane.doe@example.com', description: 'The doctor email address', required: false })
  @IsEmail()
  @IsOptional()
  doctorEmail?: string;

  @ApiProperty({ example: '+1234567890', description: 'The doctor phone number', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(30)
  doctorPhone?: string;

  @ApiProperty({ example: '123 Main St, Suite 4B', description: 'The doctor address', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  doctorAddress?: string;

  @ApiProperty({ example: 'John Smith', description: 'Patient name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  patient: string;

  @ApiProperty({ example: 'uuid-of-prosthesis-type', description: 'Database ID of the prosthesis type' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  prosthesisTypeId: string;

  @ApiProperty({ example: 'Box 105', description: 'Box number', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  boxNumber?: string;

  @ApiProperty({ example: 'White', description: 'Color specification', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  color?: string;

  @ApiProperty({ example: 'Please finish before Saturday.', description: 'Additional doctor notes', required: false })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ example: 'Full anatomical crown', description: 'Specification details', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  specification?: string;

  @ApiProperty({ example: 'FILE-101', description: 'File number', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  fileNumber?: string;
}
