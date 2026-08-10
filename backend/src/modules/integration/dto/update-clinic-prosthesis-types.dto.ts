import { IsArray, IsString, IsOptional, ValidateNested, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ClinicProsthesisItemDto {
  @ApiProperty({ description: 'Prosthesis type ID' })
  @IsString()
  prosthesisTypeId: string;

  @ApiPropertyOptional({ description: 'Clinic-specific custom price' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;
}

export class UpdateClinicProsthesisTypesDto {
  @ApiPropertyOptional({
    example: ['uuid-1', 'uuid-2'],
    description: 'List of prosthesis type IDs permitted for this clinic',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  prosthesisTypeIds?: string[];

  @ApiPropertyOptional({
    type: [ClinicProsthesisItemDto],
    description: 'List of prosthesis types with custom prices',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ClinicProsthesisItemDto)
  items?: ClinicProsthesisItemDto[];
}
