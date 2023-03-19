import { Injectable } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RateLimiter } from '../utils/RateLimiter';
import { Redis } from 'ioredis';
import { ClientService } from '../client/client.service';

@Injectable()
export class RateLimitMiddleware {
  private readonly rateLimiter: RateLimiter;

  constructor(
    redisClient: Redis,
    private readonly clientService: ClientService,
  ) {
    // NOTE(@Luthfulahi): This is a global request limit for the entire system should be determined based on the number of clients, capacity of the server and desired performance
    const globalRequestLimit = 1000;
    this.rateLimiter = new RateLimiter(redisClient, globalRequestLimit);
  }

  handler() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const clientId = req.header('x-client-id');

      if (!clientId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      const client = await this.clientService.findOne(clientId);

      if (!client) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      const requestTimestamp = Date.now();
      const { allowed, limitType, retryAfter } =
        await this.rateLimiter.isRequestAllowed(client, requestTimestamp);

      if (allowed) {
        next();
      } else {
        let message;
        switch (limitType) {
          case 'global':
            message = 'Global Request Limit Exceeded';
            break;
          case 'second':
            message = 'Too Many Requests per Second';
            break;
          case 'month':
            message = 'Monthly Request Limit Exceeded';
            break;
        }
        res
          .status(429)
          .header(
            'Retry-After',
            retryAfter ? Math.ceil(retryAfter / 1000).toString() : undefined,
          )
          .json({ message });
      }
    };
  }
}
