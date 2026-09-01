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
  IsInt,
  Min,
  Max,
  IsIn,
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
    description: 'Reminder date (start date for recurring, required for ONE_TIME)',
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

  // ── Recurrence configuration fields ──────────────────────

  @ApiProperty({ example: 1, description: 'Repeat every N units', required: false })
  @IsInt()
  @Min(1)
  @IsOptional()
  repeatInterval?: number;

  @ApiProperty({ example: 'NEVER', description: 'End type: ON_DATE, AFTER, or NEVER', required: false })
  @IsIn(['ON_DATE', 'AFTER', 'NEVER'])
  @IsOptional()
  endType?: string;

  @ApiProperty({ example: '2027-01-01T12:00:00.000Z', description: 'End date for ON_DATE end type', required: false })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiProperty({ example: 10, description: 'End after N occurrences', required: false })
  @IsInt()
  @Min(1)
  @Max(365)
  @IsOptional()
  endAfterOccurrences?: number;

  @ApiProperty({ example: [1, 3, 5], description: 'Weekly days (0=Sun..6=Sat)', required: false })
  @IsArray()
  @IsOptional()
  weeklyDays?: number[];

  @ApiProperty({ example: 'DAY_OF_MONTH', description: 'Monthly pattern type', required: false })
  @IsIn(['DAY_OF_MONTH', 'POSITIONAL_WEEKDAY'])
  @IsOptional()
  monthlyPattern?: string;

  @ApiProperty({ example: 15, description: 'Day of month for DAY_OF_MONTH pattern', required: false })
  @IsInt()
  @Min(1)
  @Max(31)
  @IsOptional()
  monthlyDayOfMonth?: number;

  @ApiProperty({ example: 'LAST', description: 'Week position for POSITIONAL_WEEKDAY pattern', required: false })
  @IsIn(['FIRST', 'SECOND', 'THIRD', 'FOURTH', 'LAST'])
  @IsOptional()
  monthlyWeekPosition?: string;

  @ApiProperty({ example: 1, description: 'Weekday for POSITIONAL_WEEKDAY pattern (0=Sun..6=Sat)', required: false })
  @IsInt()
  @Min(0)
  @Max(6)
  @IsOptional()
  monthlyWeekDay?: number;

  // ── Assignees & Branch ───────────────────────────────────

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
