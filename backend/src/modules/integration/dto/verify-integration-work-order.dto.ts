import { IsNotEmpty, IsString, IsOptional, MaxLength } from 'class-validator';
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

  @ApiProperty({ example: 'SUCCESS', description: 'The outcome of doctor verification (SUCCESS or FAILURE)' })
  @IsString()
  @IsNotEmpty()
  outcome: 'SUCCESS' | 'FAILURE';

  @ApiProperty({ example: 'Margin needs adjustment on tooth #14.', description: 'Feedback notes from external doctor (required for FAILURE)', required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}
