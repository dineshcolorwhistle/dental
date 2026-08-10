import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsUUID,
  IsDateString,
  Matches,
  ArrayMinSize,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ReminderPriority, ReminderRecurrence } from '@prisma/client';

export class CreateReminderDto {
  @ApiProperty({
    example: 'Follow-up with patient',
    description: 'Title of the reminder',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    example: 'Optional details about this reminder',
    description: 'Description of the reminder',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    example: 'Cleaning',
    description: 'Category tag for the reminder',
    required: false,
  })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiProperty({
    enum: ReminderPriority,
    example: 'MEDIUM',
    description: 'Priority level',
  })
  @IsEnum(ReminderPriority)
  @IsOptional()
  priority?: ReminderPriority;

  @ApiProperty({
    example: '2026-08-15T00:00:00.000Z',
    description: 'Reminder date (required only for ONE_TIME recurrence)',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  reminderDate?: string;

  @ApiProperty({
    example: '14:30',
    description: 'Reminder time in HH:mm format',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/, {
    message: 'reminderTime must be in HH:mm format (e.g. 14:30)',
  })
  reminderTime: string;

  @ApiProperty({
    enum: ReminderRecurrence,
    example: 'ONE_TIME',
    description: 'Recurrence pattern',
  })
  @IsEnum(ReminderRecurrence)
  @IsOptional()
  recurrence?: ReminderRecurrence;

  @ApiProperty({
    example: ['uuid-1', 'uuid-2'],
    description: 'Array of user IDs to assign to this reminder',
    required: true,
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMinSize(1, { message: 'At least one assignee is required' })
  assigneeIds: string[];

  @ApiProperty({
    example: 'uuid-of-branch',
    description: 'Branch ID (optional, resolves from user if ADMIN)',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  branchId?: string;
}
