import { Body, Controller, Post } from '@nestjs/common';
import { AppService } from './app.service';
import { ClientService } from './client/client.service';
import { Client } from './client/entities/client.entity';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly clientService: ClientService,
  ) {}

  @Post('notifications')
  sendNotification(): string {
    return this.appService.sendNotification();
  }

  @Post('client')
  async createClient(@Body() client: Client) {
    return await this.clientService.create(client);
  }
}
