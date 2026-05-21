import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBranchDto {
  @ApiProperty({
    example: 'Downtown Branch',
    description: 'Name of the branch',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({
    example: 'DOWNTOWN',
    description: 'Unique branch code (alphanumeric, auto-generated if empty)',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(10)
  code?: string;

  @ApiProperty({
    example: '123 Main Street, Suite 400',
    description: 'Physical address of the branch',
    required: false,
  })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({
    example: '+919876543210',
    description: 'Contact phone number',
    required: false,
  })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({
    example: 'downtown@smilelab.com',
    description: 'Contact email address',
    required: false,
  })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({
    example: true,
    description: 'Is the branch active',
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
