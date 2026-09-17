import 'reflect-metadata';
import 'dotenv/config'; // carga .env antes de Sentry.init (ConfigModule corre dentro de create)
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import * as Sentry from '@sentry/nestjs';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  // --- Monitoreo de errores (Fase 5) ---
  // Activo solo si SENTRY_DSN esta definido; sin DSN todo es no-op y el arranque
  // queda identico. Plan gratuito: ~50k eventos/mes, retencion 30 dias.
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV ?? 'development',
      tracesSampleRate: 0.1, // ponytail: muestreo bajo para no quemar el cupo del plan gratis
      integrations: [Sentry.nestIntegration()],
    });
  }

  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    logger: ['error', 'warn', 'log', process.env.NODE_ENV !== 'production' ? 'debug' : 'log'],
  });

  // --- Seguridad basica de cabeceras HTTP ---
  app.use(helmet());

  // --- CORS: solo el panel admin / sitio web deben poder llamar la API ---
  app.enableCors({
    origin: (process.env.WEB_URL ?? 'http://localhost:3000').split(','),
    credentials: true,
  });

  // --- Validacion global de entrada ---
  // whitelist + forbidNonWhitelisted: cualquier campo no declarado en el DTO
  // se rechaza en vez de ignorarse silenciosamente (ver Plan Tecnico, sec. 8).
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  // Nota: rutas versionless (sin prefijo /v1). El frontend (rewrite /api/*),
  // el widget y el README asumen este esquema; mantenerlo asi.

  // --- Documentacion OpenAPI/Swagger ---
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Pro Futbol Antigua - API')
      .setDescription('Reservas, pagos, chatbot web, torneos, academia y reportes')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`API escuchando en http://localhost:${port}`);
  // eslint-disable-next-line no-console
  console.log(`Documentacion Swagger en http://localhost:${port}/api/docs`);
}
bootstrap();
