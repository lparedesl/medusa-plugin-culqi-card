import { BeforeInsert, Column, Entity } from 'typeorm';
import { BaseEntity, DbAwareColumn, resolveDbType } from '@medusajs/medusa';
import { generateEntityId } from '@medusajs/medusa/dist/utils';

export enum OperationType {
  CREATE_TOKEN = 'create_token',
  LIST_TOKENS = 'list_tokens',
  GET_TOKEN = 'get_token',
  UPDATE_TOKEN = 'update_token',

  CREATE_CHARGE = 'create_charge',
  LIST_CHARGES = 'list_charges',
  GET_CHARGES = 'get_charge',
  UPDATE_CHARGE = 'update_charge',
  CAPTURE_CHARGE = 'capture_charge',

  CREATE_REFUND = 'create_refund',
  LIST_REFUNDS = 'list_refunds',
  GET_REFUND = 'get_refund',
  UPDATE_REFUND = 'update_refund',

  CREATE_CUSTOMER = 'create_customer',
  LIST_CUSTOMERS = 'list_customers',
  GET_CUSTOMER = 'get_customer',
  UPDATE_CUSTOMER = 'update_customer',
  DELETE_CUSTOMER = 'delete_customer',

  CREATE_CARD = 'create_card',
  LIST_CARDS = 'list_cards',
  GET_CARD = 'get_card',
  UPDATE_CARD = 'update_card',
  DELETE_CARD = 'delete_card',

  CREATE_PLAN = 'create_plan',
  LIST_PLANS = 'list_plans',
  GET_PLAN = 'get_plan',
  UPDATE_PLAN = 'update_plan',
  DELETE_PLAN = 'delete_plan',

  CREATE_SUBSCRIPTION = 'create_subscription',
  LIST_SUBSCRIPTIONS = 'list_subscriptions',
  GET_SUBSCRIPTION = 'get_subscription',
  UPDATE_SUBSCRIPTION = 'update_subscription',
  DELETE_SUBSCRIPTION = 'delete_subscription',

  CREATE_ORDER = 'create_order',
  LIST_ORDERS = 'list_orders',
  CONFIRM_ORDER = 'confirm_order',
  CONFIRM_ORDER_TYPE = 'confirm_order_type',
  GET_ORDER = 'get_order',
  UPDATE_ORDER = 'update_order',
  DELETE_ORDER = 'delete_order',
}

@Entity()
export class CulqiLog extends BaseEntity {
  @Column({ type: 'varchar' })
  tracking_id: string;

  @Column({ type: 'varchar' })
  culqi_version: string;

  @DbAwareColumn({ type: 'enum', enum: OperationType })
  operation: OperationType;

  @Column({ type: 'varchar' })
  url: string;

  @Column({ type: 'varchar', nullable: true })
  browser?: string | null;

  @Column({ type: 'varchar', nullable: true })
  ip_address?: string | null;

  @Column({ type: 'integer', nullable: true })
  http_code?: number | null;

  @Column({ type: resolveDbType('timestamptz'), nullable: true })
  start_date_utc?: Date | null;

  @Column({ type: resolveDbType('timestamptz'), nullable: true })
  end_date_utc?: Date | null;

  @DbAwareColumn({ type: 'jsonb', nullable: true })
  request?: Record<string, unknown>;

  @DbAwareColumn({ type: 'jsonb' })
  response: Record<string, unknown>;

  @BeforeInsert()
  private beforeInsert(): void {
    this.id = generateEntityId(this.id, 'culqilog');
  }
}
