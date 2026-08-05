import { IsArray, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateClinicProsthesisTypesDto {
  @ApiProperty({
    example: ['uuid-1', 'uuid-2'],
    description: 'List of prosthesis type IDs permitted for this clinic',
  })
  @IsArray()
  @IsString({ each: true })
  prosthesisTypeIds: string[];
}
