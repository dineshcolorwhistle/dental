import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsUUID,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOdontogramDiagnosticDto {
  @ApiProperty({
    description: 'Name of the diagnostic entry',
    example: 'Dental Caries',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    description: 'Description of the diagnostic',
    example: 'Tooth decay on enamel or dentin',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Hex color representation for odontogram mapping',
    example: '#EF4444',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, {
    message: 'Color must be a valid hex color code (e.g., #EF4444)',
  })
  color: string;

  @ApiProperty({
    description:
      'Whether the diagnostic applies to the whole tooth instead of individual surfaces',
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
