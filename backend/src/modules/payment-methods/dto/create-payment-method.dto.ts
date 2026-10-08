import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  MaxLength,
} from 'class-validator';

export class CreatePaymentMethodDto {
  @ApiProperty({
    description: 'Name of the payment method (e.g., Cash, Credit Card, Bank Transfer)',
    example: 'Bank Transfer',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({
    description: 'Optional description or instructions for the payment method',
    example: 'Direct bank transfer to BBVA account',
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description: 'Whether the payment method is active and selectable',
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
