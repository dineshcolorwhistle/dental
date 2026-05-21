import { IsEmail, IsOptional, IsString, MaxLength, MinLength, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateBranchDto {
  @ApiPropertyOptional({
    example: 'Downtown Branch Pro',
    description: 'Name of the branch',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    example: 'DOWNTOWN',
    description: 'Unique branch code',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(10)
  code?: string;

  @ApiPropertyOptional({
    example: '123 Main Street, Suite 400',
    description: 'Physical address of the branch',
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({
    example: '+919876543210',
    description: 'Contact phone number',
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    example: 'downtown@smilelab.com',
    description: 'Contact email address',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Is the branch active',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
