import { IsNumber, IsOptional, IsString, IsDate } from 'class-validator';
import { Type } from 'class-transformer';
import { OperationType } from '../models/culqi-log';

export class CulqiLogCreatePayload {
  @IsString()
  tracking_id: string

  @IsString()
  culqi_version: string

  operation: OperationType

  @IsString()
  url: string

  @IsOptional()
  @IsString()
  browser?: string

  @IsOptional()
  @IsString()
  ip_address?: string

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  http_code?: number

  @IsDate()
  @IsOptional()
  start_date_utc?: Date

  @IsDate()
  @IsOptional()
  end_date_utc?: Date

  @IsOptional()
  request?: Record<string, unknown>

  response: Record<string, unknown>
}
