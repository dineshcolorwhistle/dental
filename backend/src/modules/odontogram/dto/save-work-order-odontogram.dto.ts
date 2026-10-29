import { IsEnum, IsOptional, IsString, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TeethModel } from '@prisma/client';

export class SaveWorkOrderOdontogramDto {
  @ApiProperty({
    enum: TeethModel,
    description: 'Active teeth model for the work order (ADULT or CHILD)',
    example: TeethModel.ADULT,
  })
  @IsEnum(TeethModel)
  teethModel: TeethModel;

  @ApiProperty({
    description: 'Structured JSON data of charted teeth, parts, and applied items',
    example: {},
  })
  @IsObject()
  teethData: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Clinical or laboratory notes regarding the odontogram',
    example: 'Tooth 16 requires full metal-porcelain crown.',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

