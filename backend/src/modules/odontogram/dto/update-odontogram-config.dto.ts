import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TeethModel } from '@prisma/client';

export class UpdateOdontogramConfigDto {
  @ApiProperty({
    enum: TeethModel,
    description: 'Default teeth model for the odontogram (ADULT or CHILD)',
    example: TeethModel.ADULT,
  })
  @IsEnum(TeethModel)
  defaultTeethModel: TeethModel;

  @ApiPropertyOptional({
    description: 'Branch ID (optional, defaults to user context branch)',
  })
  @IsOptional()
  @IsUUID()
  branchId?: string;
}

