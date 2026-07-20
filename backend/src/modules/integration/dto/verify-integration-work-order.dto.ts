import { IsNotEmpty, IsString, IsOptional, IsArray, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyIntegrationWorkOrderDto {
  @ApiProperty({ example: 'https://smiledental.com', description: 'The unique URL of the clinic' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  clinicUrl: string;

  @ApiProperty({ example: 'doctor-uuid-in-lab-database', description: 'Database ID of the doctor', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  doctorId?: string;

  @ApiProperty({ example: 'uuid-or-folio', description: 'The work order ID or Folio Number' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  workOrderId: string;

  @ApiProperty({ example: 'SUCCESS', description: 'The outcome of verification (SUCCESS, REWORK, or REPETITION)' })
  @IsString()
  @IsNotEmpty()
  outcome: 'SUCCESS' | 'REWORK' | 'REPETITION';

  @ApiProperty({ example: ['Scanning', 'Design'], description: 'List of process names to rework', required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  reworkProcessNames?: string[];

  @ApiProperty({ example: 'Approved, looks great.', description: 'Optional feedback notes', required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}
