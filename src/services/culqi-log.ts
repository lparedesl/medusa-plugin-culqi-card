import { TransactionBaseService } from '@medusajs/medusa';
import { EntityManager } from 'typeorm';
import { CulqiLog } from '../models/culqi-log';
import { CulqiLogRepository } from '../repositories/culqi-log';
import { CulqiLogCreatePayload } from '../types/culqi-log';

type InjectedDependencies = {
  manager: EntityManager
  culqiLogRepository: typeof CulqiLogRepository
}

/**
 * Provides layer to manipulate Culqi logs.
 */
class CulqiLogService extends TransactionBaseService {
  protected readonly culqiLogRepository_: typeof CulqiLogRepository;
  protected readonly manager_: EntityManager;
  protected readonly transactionManager_: EntityManager | undefined;

  constructor({
    manager,
    culqiLogRepository,
  }: InjectedDependencies) {
    // eslint-disable-next-line prefer-rest-params
    super(arguments[0]);

    this.manager_ = manager;
    this.culqiLogRepository_ = culqiLogRepository;
  }

  /**
   * Creates a log
   * @param {CulqiLogCreatePayload} log - the log to create
   * @return {Promise} the result of create
   */
  async create(log: CulqiLogCreatePayload): Promise<CulqiLog> {
    return await this.atomicPhase_(async (manager) => {
      const culqiLogRepository = manager.getCustomRepository(
        this.culqiLogRepository_,
      );

      const created = culqiLogRepository.create(log);
      return culqiLogRepository.save(created);
    });
  }
}

export default CulqiLogService;
