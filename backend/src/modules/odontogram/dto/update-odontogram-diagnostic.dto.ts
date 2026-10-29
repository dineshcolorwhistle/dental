import { PartialType } from '@nestjs/swagger';
import { CreateOdontogramDiagnosticDto } from './create-odontogram-diagnostic.dto';

export class UpdateOdontogramDiagnosticDto extends PartialType(
  CreateOdontogramDiagnosticDto,
) {}

