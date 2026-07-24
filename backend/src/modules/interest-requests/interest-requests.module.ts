import { Module } from '@nestjs/common';
import { InterestRequestsService } from './interest-requests.service';
import { InterestRequestsController } from './interest-requests.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [InterestRequestsController],
  providers: [InterestRequestsService],
  exports: [InterestRequestsService],
})
export class InterestRequestsModule {}
