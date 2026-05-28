import { Module } from '@nestjs/common';
import { TechnicianPortalController } from './technician-portal.controller';
import { TechnicianPortalService } from './technician-portal.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [TechnicianPortalController],
  providers: [TechnicianPortalService],
  exports: [TechnicianPortalService],
})
export class TechnicianPortalModule {}
