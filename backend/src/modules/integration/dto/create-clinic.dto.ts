import { IsNotEmpty, IsOptional, IsString, MaxLength, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateClinicDto {
  @ApiProperty({
    example: 'Smile Dental Clinic',
    description: 'The name of the clinic',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @ApiProperty({
    example: 'https://smiledental.com',
    description: 'The website or portal URL of the clinic',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  url: string;

  @ApiPropertyOptional({
    example: 'Av. Reforma 123, Col. Centro, CDMX',
    description: 'Physical address of the clinic',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiPropertyOptional({
    example: '+52 55 1234 5678',
    description: 'Contact phone number of the clinic',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  phone?: string;

  @ApiPropertyOptional({
    example: 'c1b48b64-2db2-488b-a496-52c6f376cfd8',
    description: 'Branch ID associated with this clinic. Optional if user has default branch context.',
  })
  @IsOptional()
  @IsUUID()
  branchId?: string;
}

