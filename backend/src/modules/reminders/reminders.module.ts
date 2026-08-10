import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { RemindersController } from './reminders.controller';
import { RemindersService } from './reminders.service';
import { RemindersSchedulerService } from './reminders-scheduler.service';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [ScheduleModule.forRoot(), MailModule],
  controllers: [RemindersController],
  providers: [RemindersService, RemindersSchedulerService],
  exports: [RemindersService],
})
export class RemindersModule {}
