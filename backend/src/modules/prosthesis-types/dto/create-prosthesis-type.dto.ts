import { IsNotEmpty, IsOptional, IsString, MaxLength, MinLength, IsUUID, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateProsthesisTypeDto {
  @ApiProperty({
    example: 'Zirconia Crown',
    description: 'Name of the prosthesis/work type',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({
    example: 'High strength, aesthetic zirconia crown restoration',
    description: 'Detailed description of the prosthesis/work type',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Branch ID this prosthesis type is assigned to (optional, auto-forced for Admin)',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  branchId?: string;

  @ApiProperty({
    example: ['123e4567-e89b-12d3-a456-426614174001', '123e4567-e89b-12d3-a456-426614174002'],
    description: 'Ordered list of process IDs to assign to this prosthesis type',
    required: false,
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  processIds?: string[];
}
