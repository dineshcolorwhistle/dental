import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ConfigureIntegrationDto {
  @ApiProperty({ example: 'https://smiledental.com', description: 'The unique URL of the clinic' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  clinicUrl: string;

  @ApiProperty({ example: 'Smile Dental Clinic', description: 'The clinic name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  clinicName: string;
}
