import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
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
}
