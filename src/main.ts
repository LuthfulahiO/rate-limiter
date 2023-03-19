import { NestFactory } from '@nestjs/core';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { RateLimitMiddleware } from './middleware/rate-limit.middleware';
import { AppModule } from './app.module';
import { ClientService } from './client/client.service';

async function bootstrap() {
  const PORT = process.env.PORT || 3000;
  const app = await NestFactory.create(AppModule);

  const redisService = app.get(RedisService);
  const redisClient = redisService.getClient();
  const clientService = app.get(ClientService);

  const rateLimitMiddleware = new RateLimitMiddleware(
    redisClient,
    clientService,
  );

  app.use('/notifications', rateLimitMiddleware.handler());

  await app.listen(PORT);
}
bootstrap();
