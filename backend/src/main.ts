// Normalize server timezone to UTC regardless of VPS location (Boston/US Eastern).
// Must be set BEFORE any imports to ensure all Date operations use UTC.
process.env.TZ = 'UTC';

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');
  // Reload Process Verification DTO & Service Update v2

  // Global prefix
  app.setGlobalPrefix('api');

  // Security
  app.use(helmet());
  app.use(cookieParser());

  // CORS
  const corsOrigin = configService.get('CORS_ORIGIN', 'http://localhost:5173');
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: any) => void,
    ) => {
      // Allow requests with no origin (like mobile apps, node-fetch, postman)
      if (!origin) {
        callback(null, true);
        return;
      }

      try {
        const originUrl = new URL(origin);
        const hostname = originUrl.hostname;

        // Allow localhost and any of its subdomains (e.g., smile.localhost)
        if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
          callback(null, origin);
          return;
        }

        // Allow configured CORS_ORIGIN domain and its subdomains
        const baseOriginUrl = new URL(corsOrigin);
        const baseHostname = baseOriginUrl.hostname;
        if (
          hostname === baseHostname ||
          hostname.endsWith('.' + baseHostname)
        ) {
          callback(null, origin);
          return;
        }
      } catch {
        // Fallback if URL parsing fails
      }

      if (origin === corsOrigin || origin === 'http://localhost:5173') {
        callback(null, origin);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: true,
  });

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Dental Lab Management System')
    .setDescription('API documentation for the Dental Lab Management System')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  // Start server
  const port = configService.get('PORT', 3000);
  await app.listen(port);

  logger.log(`🚀 Server running on http://localhost:${port}`);
  logger.log(`📚 Swagger docs at http://localhost:${port}/api/docs`);
}

void bootstrap();

// Server initialized cleanly with doctor_lists SQL service reload
