import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateClinicDto {
  @ApiPropertyOptional({
    example: 'Smile Dental Clinic Updated',
    description: 'The name of the clinic',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({
    example: 'https://smiledental.com',
    description: 'The website or portal URL of the clinic',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  url?: string;

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
}

