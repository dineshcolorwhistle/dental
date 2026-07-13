import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

@WebSocketGateway({
  cors: {
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Re-use logic matching NestJS main app CORS setup
      if (!origin) {
        callback(null, true);
        return;
      }
      try {
        const originUrl = new URL(origin);
        const hostname = originUrl.hostname;

        // Allow localhost and any of its subdomains
        if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
          callback(null, true);
          return;
        }

        // Allow configured CORS_ORIGIN domain and its subdomains
        const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
        const baseOriginUrl = new URL(corsOrigin);
        const baseHostname = baseOriginUrl.hostname;
        if (
          hostname === baseHostname ||
          hostname.endsWith('.' + baseHostname)
        ) {
          callback(null, true);
          return;
        }
      } catch {
        // Fallback
      }
      callback(null, true);
    },
    credentials: true,
  },
  namespace: '/',
})
@Injectable()
export class WebsocketsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(WebsocketsGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      // 1. Extract token from handshake auth, headers, or query params
      let token = client.handshake.auth?.token;
      if (!token) {
        const authHeader = client.handshake.headers?.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          token = authHeader.split(' ')[1];
        }
      }
      if (!token) {
        token = client.handshake.query?.token as string;
      }

      if (!token) {
        this.logger.warn(
          `Connection rejected: No token provided (Client ID: ${client.id})`,
        );
        client.disconnect();
        return;
      }

      // 2. Verify JWT token
      const secret = this.configService.get<string>('JWT_ACCESS_SECRET');
      const payload = this.jwtService.verify(token, { secret });

      if (!payload || !payload.sub) {
        this.logger.warn(
          `Connection rejected: Invalid token payload (Client ID: ${client.id})`,
        );
        client.disconnect();
        return;
      }

      // 3. Double-check user is active in PostgreSQL
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          status: true,
          tenantId: true,
          branchId: true,
          role: true,
          email: true,
        },
      });

      if (!user || user.status !== 'ACTIVE') {
        this.logger.warn(
          `Connection rejected: User ${payload.sub} inactive or not found`,
        );
        client.disconnect();
        return;
      }

      // 4. Bind validated context details to the socket client metadata
      client.data = {
        userId: user.id,
        tenantId: user.tenantId,
        branchId: user.branchId,
        role: user.role,
        email: user.email,
      };

      // 5. Connect user to targeted room sessions
      // User targeted room for direct notifications
      await client.join(`user:${user.id}`);

      // Tenant targeted room for multi-tenant isolation
      if (user.tenantId) {
        await client.join(`tenant:${user.tenantId}`);

        // Branch targeted room for operational scope isolation
        if (user.branchId) {
          await client.join(`tenant:${user.tenantId}:branch:${user.branchId}`);
        }
      }

      this.logger.log(
        `WebSocket client connected: ${user.email} (ID: ${client.id})`,
      );
    } catch (error) {
      this.logger.error(
        `Handshake verification error (Client ID: ${client.id}):`,
        error.message,
      );
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userEmail = client.data?.email || 'Anonymous';
    this.logger.log(
      `WebSocket client disconnected: ${userEmail} (ID: ${client.id})`,
    );
  }

  // ─── Messaging: Typing Indicator ─────────────────────────

  @SubscribeMessage('typing')
  async handleTyping(
    client: Socket,
    payload: { conversationId: string },
  ) {
    const userId = client.data?.userId;
    if (!userId || !payload?.conversationId) return;

    try {
      // Verify user is a participant
      const participant =
        await this.prisma.conversationParticipant.findUnique({
          where: {
            conversationId_userId: {
              conversationId: payload.conversationId,
              userId,
            },
          },
        });

      if (!participant) return;

      // Get user name for display
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { firstName: true },
      });

      // Notify all other participants
      const participants =
        await this.prisma.conversationParticipant.findMany({
          where: { conversationId: payload.conversationId },
          select: { userId: true },
        });

      for (const p of participants) {
        if (p.userId !== userId) {
          this.sendToUser(p.userId, 'user_typing', {
            conversationId: payload.conversationId,
            userId,
            firstName: user?.firstName || '',
          });
        }
      }
    } catch (error) {
      this.logger.error('Error handling typing event:', error.message);
    }
  }

  // ─── Broadcast Helpers ──────────────────────────────────

  /**
   * Broadcast an event to a specific tenant
   */
  sendToTenant(tenantId: string, event: string, payload: any) {
    if (!this.server) {
      this.logger.warn(
        `Socket.IO Server is not initialized. Cannot broadcast to tenant ${tenantId}`,
      );
      return;
    }
    this.server.to(`tenant:${tenantId}`).emit(event, payload);
  }

  /**
   * Broadcast an event to a specific branch within a tenant
   */
  sendToBranch(
    tenantId: string,
    branchId: string,
    event: string,
    payload: any,
  ) {
    if (!this.server) {
      this.logger.warn(
        `Socket.IO Server is not initialized. Cannot broadcast to branch ${branchId}`,
      );
      return;
    }
    this.server
      .to(`tenant:${tenantId}:branch:${branchId}`)
      .emit(event, payload);
  }

  /**
   * Broadcast an event to a specific user (e.g. notifications)
   */
  sendToUser(userId: string, event: string, payload: any) {
    if (!this.server) {
      this.logger.warn(
        `Socket.IO Server is not initialized. Cannot broadcast to user ${userId}`,
      );
      return;
    }
    this.server.to(`user:${userId}`).emit(event, payload);
  }

  /**
   * Check if a user is currently connected via WebSocket
   */
  isUserOnline(userId: string): boolean {
    if (!this.server) return false;
    return this.server.sockets.adapter.rooms.has(`user:${userId}`);
  }

  /**
   * Get list of online user IDs from a given set
   */
  getOnlineUserIds(userIds: string[]): string[] {
    if (!this.server) return [];
    return userIds.filter((id) =>
      this.server.sockets.adapter.rooms.has(`user:${id}`),
    );
  }
}
