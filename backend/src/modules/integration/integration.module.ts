import { Module } from '@nestjs/common';
import { IntegrationController } from './integration.controller';
import { ConnectedClinicsController } from './connected-clinics.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { WorkOrdersModule } from '../work-orders/work-orders.module';
import { MailModule } from '../mail/mail.module';
import { MessagesModule } from '../messages/messages.module';
import { WebsocketsModule } from '../websockets/websockets.module';

@Module({
  imports: [
    NotificationsModule,
    WorkOrdersModule,
    MailModule,
    MessagesModule,
    WebsocketsModule,
  ],
  controllers: [IntegrationController, ConnectedClinicsController],
})
export class IntegrationModule {}


