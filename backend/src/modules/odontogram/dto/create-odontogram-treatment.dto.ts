import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsUUID,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOdontogramTreatmentDto {
  @ApiProperty({
    description: 'Name of the treatment',
    example: 'Composite Filling',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    description: 'Description of the treatment',
    example: 'Tooth-colored resin filling',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Hex color representation for odontogram mapping',
    example: '#3B82F6',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, {
    message: 'Color must be a valid hex color code (e.g., #3B82F6)',
  })
  color: string;

  @ApiProperty({
    description:
      'Whether the treatment applies to the whole tooth instead of individual surfaces',
    example: false,
  })
  @IsBoolean()
  appliesToWholeTooth: boolean;

  @ApiPropertyOptional({
    description: 'Branch ID scope (optional, for owners/super-admins)',
  })
  @IsOptional()
  @IsUUID()
  branchId?: string;
}

