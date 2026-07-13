import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RenameGroupDto {
  @ApiProperty({ description: 'New group name', example: 'Evening Shift Team' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;
}
