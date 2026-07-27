import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailModule } from '../mail/mail.module';
import { EmailQueueProcessor } from './email-queue.processor';
import { PushNotificationQueueProcessor } from './push-notification-queue.processor';

@Global()
@Module({
  imports: [
    MailModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get('REDIS_HOST') || '127.0.0.1',
          port: parseInt(configService.get('REDIS_PORT') || '6379', 10),
          password: configService.get('REDIS_PASSWORD') || undefined,
          maxRetriesPerRequest: null,
          enableOfflineQueue: true,
          retryStrategy: (times: number) => {
            if (times > 5) return null;
            return 1000;
          },
        },
      }),
    }),
    BullModule.registerQueue({
      name: 'email-queue',
    }),
    BullModule.registerQueue({
      name: 'push-notification-queue',
    }),
  ],
  providers: [EmailQueueProcessor, PushNotificationQueueProcessor],
  exports: [BullModule],
})
export class QueuesModule {}
