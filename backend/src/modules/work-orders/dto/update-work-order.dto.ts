import { PartialType, OmitType, ApiProperty } from '@nestjs/swagger';
import { CreateWorkOrderDto } from './create-work-order.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { WorkOrderStatus } from '@prisma/client';

export class UpdateWorkOrderDto extends PartialType(
  OmitType(CreateWorkOrderDto, ['action'] as const),
) {
  @ApiProperty({
    enum: WorkOrderStatus,
    description: 'Updated overall status of the work order',
    required: false,
  })
  @IsEnum(WorkOrderStatus)
  @IsOptional()
  status?: WorkOrderStatus;
}
