import { IsNotEmpty, IsString, MaxLength, MinLength, IsOptional, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCategoryDto {
  @ApiProperty({
    example: 'Material',
    description: 'Name of the category',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(50)
  name: string;

  @ApiProperty({
    example: 'Raw materials used for dental crown production',
    description: 'Description of the category',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(300)
  description?: string;

  @ApiProperty({
    example: 'active',
    description: 'Status of the category (active or inactive)',
    required: false,
    default: 'active',
  })
  @IsString()
  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: string;

  @ApiProperty({
    example: 'for_use',
    description: 'Product type (for_use or for_sale)',
    required: false,
    default: 'for_use',
  })
  @IsString()
  @IsOptional()
  @IsIn(['for_use', 'for_sale'])
  productType?: string;
}
