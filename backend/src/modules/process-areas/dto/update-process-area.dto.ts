import { PartialType } from '@nestjs/swagger';
import { CreateProcessAreaDto } from './create-process-area.dto';

export class UpdateProcessAreaDto extends PartialType(CreateProcessAreaDto) {}
