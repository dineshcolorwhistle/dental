import { IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
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
}
