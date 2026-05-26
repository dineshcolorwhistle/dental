import { PartialType } from '@nestjs/swagger';
import { CreateProsthesisTypeDto } from './create-prosthesis-type.dto';

export class UpdateProsthesisTypeDto extends PartialType(CreateProsthesisTypeDto) {}
