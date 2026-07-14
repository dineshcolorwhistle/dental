import { IsString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProcessAreaDto {
  @ApiProperty({ description: 'Name of the process area' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Description of the process area' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Assigned branch ID (optional, defaults to administrator branch context)' })
  @IsUUID()
  @IsOptional()
  branchId?: string;
}
