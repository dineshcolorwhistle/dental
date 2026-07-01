import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTenantDto {
  @ApiProperty({
    example: 'Smile Dental Lab',
    description: 'Name of the dental lab / tenant organization',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  tenantName: string;

  @ApiProperty({
    example: 'John Doe',
    description: 'Full name of the lab owner',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  ownerName: string;

  @ApiProperty({
    example: 'Main Branch',
    description: 'Name of the default branch',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  branchName?: string;

  @ApiProperty({
    example: 'owner@smilelab.com',
    description: 'Email address for the lab owner (used for login)',
  })
  @IsEmail()
  @IsNotEmpty()
  ownerEmail: string;

  @ApiProperty({
    example: 1,
    description: 'Maximum number of owners allowed for the tenant',
  })
  @IsInt()
  @IsNotEmpty()
  @Min(1)
  maxOwners: number;

  @ApiProperty({
    example: 3,
    description: 'Maximum number of Lab Administrators allowed for the tenant',
  })
  @IsInt()
  @IsNotEmpty()
  @Min(0)
  maxAdmins: number;

  @ApiProperty({
    example: 6,
    description: 'Maximum number of Lab Technicians allowed for the tenant',
  })
  @IsInt()
  @IsNotEmpty()
  @Min(0)
  maxTechnicians: number;
}
