import { IsNotEmpty, IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyIntegrationWorkOrderDto {
  @ApiProperty({ example: 'https://smiledental.com', description: 'The unique URL of the clinic' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  clinicUrl: string;

  @ApiProperty({ example: 'uuid-or-folio', description: 'The work order ID or Folio Number' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  workOrderId: string;

  @ApiProperty({ example: 'SUCCESS', description: 'The outcome of verification (SUCCESS, REWORK, or REPETITION)' })
  @IsString()
  @IsNotEmpty()
  outcome: 'SUCCESS' | 'REWORK' | 'REPETITION';

  @ApiProperty({ example: 'Approved, looks great.', description: 'Optional feedback notes', required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}
