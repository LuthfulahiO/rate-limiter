import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('clients')
export class Client {
  @PrimaryColumn()
  clientId: string;

  @Column()
  limitPerSecond: number;

  @Column()
  limitPerMonth: number;
}
