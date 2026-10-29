import { PartialType } from '@nestjs/swagger';
import { CreateOdontogramTreatmentDto } from './create-odontogram-treatment.dto';

export class UpdateOdontogramTreatmentDto extends PartialType(
  CreateOdontogramTreatmentDto,
) {}

