import { PartialType } from '@nestjs/swagger';
import { CreateDoctorDto } from './create-doctor.dto';
import { IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateDoctorDto extends PartialType(CreateDoctorDto) {
  @ApiProperty({
    example: true,
    description: 'Is the doctor active',
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
