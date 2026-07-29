import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEmail,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum InterestRequestStatus {
  PENDING = 'PENDING',
  CONTACTED = 'CONTACTED',
  CONVERTED = 'CONVERTED',
  DISCARDED = 'DISCARDED',
}

export class CreateInterestRequestDto {
  @ApiProperty({
    example: 'John Doe',
    description: 'Name of the interested person',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @ApiProperty({ example: 'john@example.com', description: 'Email address' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: '+1234567890', description: 'Phone number' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  phone: string;

  @ApiProperty({
    example: 'uuid-of-tenant',
    description: 'Tenant ID the request belongs to',
  })
  @IsUUID()
  @IsNotEmpty()
  tenantId: string;

  @ApiProperty({
    example: 'uuid-of-work-order',
    description: 'Linked Work Order ID',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  workOrderId?: string;

  @ApiProperty({
    example: 'I am interested in your services.',
    description: 'Optional message/notes',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  notes?: string;
}
