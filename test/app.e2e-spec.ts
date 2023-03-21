import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ClientService } from '../src/client/client.service';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { RateLimitMiddleware } from '../src/middleware/rate-limit.middleware';

describe('AppController (e2e)', () => {
  let app: INestApplication;
  let clientService: ClientService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    clientService = moduleFixture.get(ClientService);

    const redisService = app.get(RedisService);
    const redisClient = redisService.getClient();

    const rateLimitMiddleware = new RateLimitMiddleware(
      redisClient,
      clientService,
    );

    app.use('/notifications', rateLimitMiddleware.handler());

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return 401 Unauthorized when no x-client-id is provided', () => {
    return request(app.getHttpServer())
      .post('/notifications')
      .expect(401)
      .expect({ message: 'Unauthorized' });
  });

  it('should return 201 when a valid x-client-id is provided and within rate limits', async () => {
    const client = await clientService.create({
      clientId: 'test-client-1',
      limitPerSecond: 5,
      limitPerMonth: 1000,
    });

    return request(app.getHttpServer())
      .post('/notifications')
      .set('x-client-id', client.clientId)
      .expect(201);
  });
  it('should return 429 with message "Too Many Requests per Second" when second limit is exceeded', async () => {
    const client = await clientService.create({
      clientId: 'test-client-2',
      limitPerSecond: 1,
      limitPerMonth: 1000,
    });

    await request(app.getHttpServer())
      .post('/notifications')
      .set('x-client-id', client.clientId)
      .expect(201);

    return request(app.getHttpServer())
      .post('/notifications')
      .set('x-client-id', client.clientId)
      .expect(429)
      .expect((res) => {
        expect(res.body.message).toBe('Too Many Requests per Second');
        expect(res.header['retry-after']).toBeDefined();
      });
  });

  it('should return 429 with message "Monthly Request Limit Exceeded" when monthly limit is exceeded', async () => {
    const client = await clientService.create({
      clientId: 'test-client-3',
      limitPerSecond: 1000,
      limitPerMonth: 1,
    });

    await request(app.getHttpServer())
      .post('/notifications')
      .set('x-client-id', client.clientId)
      .expect(201);

    return request(app.getHttpServer())
      .post('/notifications')
      .set('x-client-id', client.clientId)
      .expect(429)
      .expect((res) => {
        expect(res.body.message).toBe('Monthly Request Limit Exceeded');
        expect(res.header['retry-after']).toBeDefined();
      });
  });

  it('should return 201 when a valid x-client-id is provided and within rate limits after retry-after time', async () => {
    const client = await clientService.create({
      clientId: 'test-client-4',
      limitPerSecond: 1,
      limitPerMonth: 1000,
    });

    await request(app.getHttpServer())
      .post('/notifications')
      .set('x-client-id', client.clientId)
      .expect(201);

    const response = await request(app.getHttpServer())
      .post('/notifications')
      .set('x-client-id', client.clientId)
      .expect(429);

    const retryAfter = parseInt(response.header['retry-after'], 10);

    await new Promise((resolve) =>
      setTimeout(resolve, (retryAfter + 1) * 1000),
    );

    await request(app.getHttpServer())
      .post('/notifications')
      .set('x-client-id', client.clientId)
      .expect(201);
  });

  it('should return 429 with message "Global Request Limit Exceeded" when global limit is exceeded', async () => {
    const client1 = await clientService.create({
      clientId: 'test-client-5',
      limitPerSecond: 1000,
      limitPerMonth: 10000,
    });

    const client2 = await clientService.create({
      clientId: 'test-client-6',
      limitPerSecond: 1000,
      limitPerMonth: 10000,
    });

    const globalRequestLimit = 1000;
    const requests = [];

    for (let i = 0; i < globalRequestLimit / 2; i++) {
      requests.push(
        request(app.getHttpServer())
          .post('/notifications')
          .set('x-client-id', client1.clientId),
      );

      requests.push(
        request(app.getHttpServer())
          .post('/notifications')
          .set('x-client-id', client2.clientId),
      );
    }

    await Promise.allSettled(requests);

    const response = await request(app.getHttpServer())
      .post('/notifications')
      .set('x-client-id', client1.clientId)
      .expect(429);

    expect(response.body.message).toBe('Global Request Limit Exceeded');
    expect(response.header['retry-after']).toBeDefined();
  });
});
