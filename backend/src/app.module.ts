import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { MailModule } from './modules/mail/mail.module';
import { BranchesModule } from './modules/branches/branches.module';
import { AdminsModule } from './modules/admins/admins.module';
import { DoctorsModule } from './modules/doctors/doctors.module';
import { TechniciansModule } from './modules/technicians/technicians.module';
import { ProsthesisTypesModule } from './modules/prosthesis-types/prosthesis-types.module';
import { ProcessesModule } from './modules/processes/processes.module';
import { WorkOrdersModule } from './modules/work-orders/work-orders.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { TechnicianPortalModule } from './modules/technician-portal/technician-portal.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { FinanceModule } from './modules/finance/finance.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { WebsocketsModule } from './modules/websockets/websockets.module';
import { QueuesModule } from './modules/queues/queues.module';

@Module({
  imports: [
    // Global config from .env
    ConfigModule.forRoot({ isGlobal: true }),

    // Database
    PrismaModule,

    // Global Audit Logging
    AuditLogsModule,

    // Global Websockets & Queues
    WebsocketsModule,
    QueuesModule,

    // Feature modules
    AuthModule,
    TenantsModule,
    MailModule,
    BranchesModule,
    AdminsModule,
    DoctorsModule,
    TechniciansModule,
    ProsthesisTypesModule,
    ProcessesModule,
    WorkOrdersModule,
    NotificationsModule,
    TechnicianPortalModule,
    FinanceModule,
    InventoryModule,
    ExpensesModule,
  ],
  providers: [
    // Global JWT guard — all routes require auth by default
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Global RBAC guard — checks @Roles() decorator
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
