import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { MailModule } from './modules/mail/mail.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  imports: [
    // Global config from .env
    ConfigModule.forRoot({ isGlobal: true }),

    // Database
    PrismaModule,

    // Feature modules
    AuthModule,
    TenantsModule,
    MailModule,
  ],
  providers: [
    // Global JWT guard — all routes require auth by default
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Global RBAC guard — checks @Roles() decorator
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
