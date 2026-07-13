import {
  IsString,
  IsNotEmpty,
  IsArray,
  ArrayMinSize,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateGroupDto {
  @ApiProperty({ description: 'Group name', example: 'Morning Shift Team' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'Array of user IDs to add as group members',
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(2)
  @IsUUID('4', { each: true })
  memberIds: string[];
}
