import { Module } from '@nestjs/common';
import { IntegrationController } from './integration.controller';
import { ConnectedClinicsController } from './connected-clinics.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { WorkOrdersModule } from '../work-orders/work-orders.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [NotificationsModule, WorkOrdersModule, MailModule],
  controllers: [IntegrationController, ConnectedClinicsController],
})
export class IntegrationModule {}

