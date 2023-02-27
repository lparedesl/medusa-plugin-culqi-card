import { MigrationInterface, QueryRunner } from 'typeorm';

export class CulqiLogTable1676247873951 implements MigrationInterface {

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = "operation_type_enum") THEN
              CREATE TYPE "operation_type_enum" AS ENUM('create_token', 'list_tokens', 'get_token', 'update_token', 'create_charge', 'list_charges', 'get_charge', 'update_charge', 'capture_charge', 'create_refund', 'list_refunds', 'get_refund', 'update_refund', 'create_customer', 'list_customers', 'get_customer', 'update_customer', 'delete_customer', 'create_card', 'list_cards', 'get_card', 'update_card', 'delete_card', 'create_plan', 'list_plans', 'get_plan', 'update_plan', 'delete_plan', 'create_subscription', 'list_subscriptions', 'get_subscription', 'update_subscription', 'delete_subscription', 'create_order', 'list_orders', 'confirm_order', 'confirm_order_type', 'get_order', 'update_order', 'delete_order');
          END IF;
      END$$;
    `);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "culqi_log" ("id" character varying NOT NULL, "tracking_id" character varying NOT NULL, "culqi_version" character varying NOT NULL, "operation" "operation_type_enum" NOT NULL, "url" character varying NOT NULL, "browser" character varying, "ip_address" character varying, "http_code" integer, "start_date_utc" TIMESTAMP WITH TIME ZONE, "end_date_utc" TIMESTAMP WITH TIME ZONE, "request" jsonb, "response" jsonb NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_culqi_log" PRIMARY KEY ("id"))`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "culqi_log"`);
    await queryRunner.query(`DROP TYPE "operation_type_enum"`);
  }

}
