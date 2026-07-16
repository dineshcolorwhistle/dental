import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class StartVerificationDto {
  @ApiProperty({ example: 'https://smiledental.com', description: 'The unique URL of the clinic' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  clinicUrl: string;

  @ApiProperty({ example: 'doctor-uuid-in-lab-database', description: 'Database ID of the doctor' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  doctorId: string;

  @ApiProperty({ example: 'work-order-uuid-in-lab-database', description: 'Database ID of the work order' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  workOrderId: string;
}
