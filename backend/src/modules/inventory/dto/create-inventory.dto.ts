import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  IsUUID,
  IsEnum,
  Min,
  IsDateString,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateInventoryDto {
  @ApiProperty({
    example: 'Aesthetic Porcelain Powder',
    description: 'Name of the inventory item',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @ApiProperty({
    example: 'INV-20260707-1234',
    description: 'Unique SKU for the item',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  sku: string;

  @ApiProperty({
    example: 'c2d3e4f5-a1b2-3c4d-5e6f-7a8b9c0d1e2f',
    description: 'ID of the inventory category',
  })
  @IsUUID()
  @IsNotEmpty()
  categoryId: string;

  @ApiProperty({
    example: 'IN_STOCK',
    description: 'Current status of the item',
  })
  @IsString()
  @IsNotEmpty()
  status: string;

  @ApiProperty({
    example: 10,
    description: 'Current quantity in stock',
  })
  @IsNumber()
  @Min(0)
  currentQuantity: number;

  @ApiProperty({
    example: 5,
    description: 'Minimum quantity threshold for alert',
  })
  @IsNumber()
  @Min(0)
  minQuantity: number;

  @ApiProperty({
    example: 150.5,
    description: 'Unit price of the item',
  })
  @IsNumber()
  @Min(0)
  unitPrice: number;

  @ApiProperty({
    example: 'Ivoclar',
    description: 'Brand of the item',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  brand?: string;

  @ApiProperty({
    example: 'Dental Supplies Corp',
    description: 'Supplier of the item',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  supplier?: string;

  @ApiProperty({
    example: '2027-07-07T00:00:00.000Z',
    description: 'Expiry date of the item',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  expiryDate?: string;

  @ApiProperty({
    example: 'High quality porcelain powder for dental crowns',
    description: 'Detailed description of the item',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    example: 'c2d3e4f5-a1b2-3c4d-5e6f-7a8b9c0d1e2f',
    description: 'Branch ID the item belongs to (optional)',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  branchId?: string;
}
