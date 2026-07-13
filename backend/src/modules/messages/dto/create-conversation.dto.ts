import { IsString, IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateConversationDto {
  @ApiProperty({ description: 'Target user ID for 1:1 conversation' })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  targetUserId: string;
}
