import { IsNotEmpty, IsString, MaxLength, MinLength, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateExpenseCategoryDto {
  @ApiProperty({
    example: 'Office Supplies',
    description: 'Name of the expense category',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(50)
  name: string;

  @ApiProperty({
    example: 'Expenses related to office supplies and stationery',
    description: 'Description of the category',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(300)
  description?: string;
}
