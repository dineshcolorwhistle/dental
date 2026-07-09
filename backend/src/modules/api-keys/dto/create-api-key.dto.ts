import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateApiKeyDto {
  @ApiProperty({
    example: 'Doctor Portal Key',
    description: 'A friendly name to identify this API key',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;
}
