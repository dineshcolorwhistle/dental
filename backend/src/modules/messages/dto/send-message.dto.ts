import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendMessageDto {
  @ApiProperty({ description: 'Message content', example: 'Hello!' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content: string;
}
