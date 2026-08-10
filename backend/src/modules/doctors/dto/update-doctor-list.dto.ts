import { PartialType } from '@nestjs/swagger';
import { CreateDoctorListDto } from './create-doctor-list.dto';

export class UpdateDoctorListDto extends PartialType(CreateDoctorListDto) {}
