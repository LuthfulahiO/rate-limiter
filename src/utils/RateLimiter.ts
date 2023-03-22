import { Redis } from 'ioredis';
import { Client } from '../client/entities/client.entity';

export class RateLimiter {
  constructor(
    private readonly redisClient: Redis,
    private readonly globalRequestLimit: number,
  ) {}

  async getClientLimits(client: Client): Promise<{
    requestPerSecond: number;
    requestPerMonth: number;
  }> {
    const { limitPerSecond, limitPerMonth } = client;
    return {
      requestPerSecond: limitPerSecond,
      requestPerMonth: limitPerMonth,
    };
  }

  async isRequestAllowed(
    client: Client,
    requestTimestamp: number,
  ): Promise<{
    allowed: boolean;
    limitType: string | null;
    retryAfter?: number;
    throttleType?: 'soft' | 'hard';
  }> {
    const clientId = client.clientId;

    const globalKey = `rate_limit:global:${Math.floor(
      requestTimestamp / 1000,
    )}`;
    const currentGlobalRequestCount = await this.redisClient.get(globalKey);

    if (currentGlobalRequestCount === null) {
      this.redisClient.set(globalKey, '1', 'EX', 1);
    } else if (parseInt(currentGlobalRequestCount) < this.globalRequestLimit) {
      this.redisClient.incr(globalKey);
    } else {
      const retryAfter = 1000 - (requestTimestamp % 1000);
      return {
        allowed: false,
        limitType: 'global',
        retryAfter,
        throttleType: 'soft',
      };
    }

    const { requestPerSecond, requestPerMonth } = await this.getClientLimits(
      client,
    );

    const secondKey = `rate_limit:second:${clientId}:${Math.floor(
      requestTimestamp / 1000,
    )}`;
    const currentSecondRequestCount = await this.redisClient.get(secondKey);

    if (currentSecondRequestCount === null) {
      this.redisClient.set(secondKey, '1', 'EX', 1);
    } else if (parseInt(currentSecondRequestCount) < requestPerSecond) {
      this.redisClient.incr(secondKey);
    } else {
      const retryAfter = 1000 - (requestTimestamp % 1000);
      return {
        allowed: false,
        limitType: 'second',
        retryAfter,
        throttleType: 'soft',
      };
    }

    const monthKey = `rate_limit:month:${clientId}:${Math.floor(
      requestTimestamp / (1000 * 60 * 60 * 24 * 30),
    )}`;
    const currentMonthRequestCount = await this.redisClient.get(monthKey);

    if (currentMonthRequestCount === null) {
      this.redisClient.set(monthKey, '1', 'EX', 30 * 24 * 60 * 60);
    } else if (parseInt(currentMonthRequestCount) < requestPerMonth) {
      this.redisClient.incr(monthKey);
    } else {
      const currentMonth = new Date(requestTimestamp).getMonth();
      const nextMonth = new Date(requestTimestamp);
      nextMonth.setMonth(currentMonth + 1);
      nextMonth.setDate(1);
      nextMonth.setHours(0, 0, 0, 0);
      const retryAfter = nextMonth.getTime() - requestTimestamp;
      return {
        allowed: false,
        limitType: 'month',
        retryAfter,
        throttleType: 'soft',
      };
    }

    //Return throttleType: 'hard' if client keeps making more request after the soft throttle for a certain number of time.

    return { allowed: true, limitType: null };
  }
}
