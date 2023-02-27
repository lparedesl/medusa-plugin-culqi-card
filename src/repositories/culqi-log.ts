import { EntityRepository, Repository } from 'typeorm';
import { CulqiLog } from '../models/culqi-log';

@EntityRepository(CulqiLog)
export class CulqiLogRepository extends Repository<CulqiLog> {
}
