import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateWorkOrderDto } from './create-work-order.dto';

export class UpdateWorkOrderDto extends PartialType(
  OmitType(CreateWorkOrderDto, ['action'] as const),
) {}
