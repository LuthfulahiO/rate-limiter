import { Test, TestingModule } from '@nestjs/testing';
import { RateLimitMiddleware } from './rate-limit.middleware';
import { Redis } from 'ioredis';
import { ClientService } from '../client/client.service';
import { Client } from '../client/entities/client.entity';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';

class MockRedis extends Redis {
  incr() {
    return Promise.resolve(1);
  }

  expire() {
    return Promise.resolve(1);
  }

  get() {
    return Promise.resolve('1');
  }

  disconnect() {
    return Promise.resolve(true);
  }
}

const mockClientRepository: Partial<Repository<Client>> = {
  findOne: () => Promise.resolve(new Client()),
};

describe('RateLimitMiddleware', () => {
  let rateLimitMiddleware: RateLimitMiddleware;
  let redisClient: Redis;
  let clientService: ClientService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateLimitMiddleware,
        {
          provide: Redis,
          useValue: new MockRedis(),
        },
        ClientService,
        {
          provide: getRepositoryToken(Client),
          useValue: mockClientRepository,
        },
      ],
    }).compile();

    rateLimitMiddleware = module.get<RateLimitMiddleware>(RateLimitMiddleware);
    redisClient = module.get<Redis>(Redis);
    clientService = module.get<ClientService>(ClientService);
  });

  afterEach(() => {
    redisClient.disconnect();
  });

  it('should be defined', () => {
    expect(rateLimitMiddleware).toBeDefined();
  });

  describe('when request exceeds allowed limits', () => {
    let req: any;
    let res: any;
    let next: any;

    beforeEach(() => {
      req = {
        header: jest.fn().mockReturnValue('client-id'),
      };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        header: jest.fn().mockReturnThis(),
      };
      next = jest.fn();
    });

    it('should return 429 with message "Global Request Limit Exceeded" when global limit is exceeded', async () => {
      jest.spyOn(redisClient, 'get').mockResolvedValue('1001');
      const handler = rateLimitMiddleware.handler();
      await handler(req, res, next);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Global Request Limit Exceeded',
      });
    });

    it('should return 429 with message "Too Many Requests per Second" when second limit is exceeded', async () => {
      jest.spyOn(clientService, 'findOne').mockResolvedValue({
        clientId: 'client-id',
        limitPerSecond: 1,
        limitPerMonth: 1000,
      });
      const handler = rateLimitMiddleware.handler();
      await handler(req, res, next);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Too Many Requests per Second',
      });
    });

    it('should return 429 with message "Monthly Request Limit Exceeded" when month limit is exceeded', async () => {
      jest.spyOn(clientService, 'findOne').mockResolvedValue({
        clientId: 'client-id',
        limitPerSecond: 1000,
        limitPerMonth: 1,
      });
      const handler = rateLimitMiddleware.handler();
      await handler(req, res, next);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Monthly Request Limit Exceeded',
      });
    });
  });
});
