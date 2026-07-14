import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: 'Invalid email address' })
  email: string;

  @ApiProperty({ example: 'happy-dental', required: false })
  @IsString()
  @IsOptional()
  subdomain?: string;
}
