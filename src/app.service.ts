import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  sendNotification(): string {
    return 'Notification sent!';
  }
}
