import { IsNotEmpty, IsArray, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReorderProcessesDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'ID of the prosthesis type',
  })
  @IsUUID()
  @IsNotEmpty()
  prosthesisTypeId: string;

  @ApiProperty({
    example: ['123e4567-e89b-12d3-a456-426614174001', '123e4567-e89b-12d3-a456-426614174002'],
    description: 'Ordered list of process IDs',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  processIds: string[];
}
