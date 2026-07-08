import { IsNotEmpty, IsString, IsNumber, IsOptional, IsUUID, IsDateString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateExpenseDto {
  @ApiProperty({
    example: 'Office Rent July',
    description: 'Title of the expense',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    example: 'Monthly rent for the branch premises',
    description: 'Detailed description of the expense',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    example: 1250.50,
    description: 'Amount spent',
  })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({
    example: '2026-07-07T00:00:00.000Z',
    description: 'Date the expense occurred',
  })
  @IsDateString()
  date: string;

  @ApiProperty({
    example: 'Credit Card',
    description: 'Payment method used',
  })
  @IsString()
  @IsNotEmpty()
  paymentMethod: string;

  @ApiProperty({
    example: 'uuid-of-category',
    description: 'Category ID of the expense',
  })
  @IsUUID()
  @IsNotEmpty()
  categoryId: string;

  @ApiProperty({
    example: 'uuid-of-branch',
    description: 'Branch ID (optional, resolves from user if ADMIN)',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  branchId?: string;
}
