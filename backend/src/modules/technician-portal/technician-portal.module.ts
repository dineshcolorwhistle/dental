import { Module } from '@nestjs/common';
import { TechnicianPortalController } from './technician-portal.controller';
import { TechnicianPortalService } from './technician-portal.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [PrismaModule, NotificationsModule, MailModule],
  controllers: [TechnicianPortalController],
  providers: [TechnicianPortalService],
  exports: [TechnicianPortalService],
})
export class TechnicianPortalModule {}

