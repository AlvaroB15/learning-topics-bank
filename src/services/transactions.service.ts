import { PoolClient } from 'pg';
import { withTransaction } from '../config/db';
import { AccountsRepository } from '../repositories/accounts.repository';
import { TransactionsRepository } from '../repositories/transactions.repository';
import { Transaction } from '../models/types';
import {
  AccountNotFoundError,
  AccountBlockedError,
  InsufficientFundsError,
  DailyLimitExceededError,
  SameAccountError,
  CurrencyMismatchError,
  DuplicateTransactionError,
  ForbiddenError,
} from '../errors/BankingError';

export interface TransferParams {
  sourceAccountId:      string;
  destinationAccountId: string;
  amount:               string;
  description?:         string;
  idempotencyKey?:      string;
  requestingUserId:     string;
  ipAddress?:           string;
  userAgent?:           string;
}

export interface DepositParams {
  destinationAccountId: string;
  amount:               string;
  description?:         string;
  requestingUserId:     string;
  ipAddress?:           string;
}

export class TransactionsService {
  constructor(
    private readonly accounts:     AccountsRepository,
    private readonly transactions: TransactionsRepository,
  ) {}

  // ────────────────────────────────────────────────────────────
  // TRANSFERENCIA
  // ────────────────────────────────────────────────────────────
  async transfer(params: TransferParams): Promise<Transaction> {
    // Idempotencia: si la clave ya fue procesada, devolvemos el resultado anterior
    if (params.idempotencyKey) {
      const existing = await this.transactions.findByIdempotencyKey(params.idempotencyKey);
      if (existing) {
        if (existing.status === 'completed') return existing;
        throw new DuplicateTransactionError(params.idempotencyKey);
      }
    }

    if (params.sourceAccountId === params.destinationAccountId) {
      throw new SameAccountError();
    }

    return withTransaction(async (client: PoolClient) => {
      // — 1. Bloqueo atómico de ambas cuentas (orden determinístico = sin deadlock) ——
      const locked = await this.accounts.lockForUpdate(
        [params.sourceAccountId, params.destinationAccountId],
        client,
      );

      const source = locked.find((a) => a.id === params.sourceAccountId);
      const dest   = locked.find((a) => a.id === params.destinationAccountId);

      if (!source) throw new AccountNotFoundError(params.sourceAccountId);
      if (!dest)   throw new AccountNotFoundError(params.destinationAccountId);

      // —— 2. Validaciones de negocio ——
      if (source.status !== 'active') throw new AccountBlockedError(source.status);
      if (dest.status   !== 'active') throw new AccountBlockedError(dest.status);
      if (source.currency !== dest.currency) throw new CurrencyMismatchError();

      // El customer solo puede mover dinero de sus propias cuentas
      if (source.userId !== params.requestingUserId) throw new ForbiddenError();

      const amountNum      = Number.parseFloat(params.amount);
      const balanceNum     = Number.parseFloat(source.balance);
      const dailyLimitNum  = Number.parseFloat(source.dailyLimit);

      if (balanceNum < amountNum) throw new InsufficientFundsError();

      // — 3. Límite diario (acumula y valida dentro de la transacción) ——
      const newDailyTotal = await this.accounts.accumulateDailyTotal(
        params.sourceAccountId,
        params.amount,
        client,
      );
      if (Number.parseFloat(newDailyTotal) > dailyLimitNum) {
        throw new DailyLimitExceededError(source.dailyLimit, source.currency);
      }

      // —— 4. Movimientos contables ——
      await this.accounts.debit(params.sourceAccountId, params.amount, client);
      await this.accounts.credit(params.destinationAccountId, params.amount, client);

      // —— 5. Registro de la transacción ——
      const txn = await this.transactions.create(
        {
          idempotencyKey:       params.idempotencyKey,
          type:                 'transfer',
          sourceAccountId:      params.sourceAccountId,
          destinationAccountId: params.destinationAccountId,
          amount:               params.amount,
          currency:             source.currency,
          description:          params.description,
        },
        client,
      );

      // —— 6. Audit log ——
      await this.transactions.insertAuditLog(
        {
          userId:     params.requestingUserId,
          action:     'TRANSFER',
          entityType: 'transaction',
          entityId:   txn.id,
          oldValues:  { sourceBalance: source.balance, destBalance: dest.balance },
          newValues:  {
            sourceBalance: String(balanceNum - amountNum),
            destBalance:   String(Number.parseFloat(dest.balance) + amountNum),
          },
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
        },
        client,
      );

      return txn;
    });
  }

  // ────────────────────────────────────────────────────────────
  // DEPÓSITO (teller / admin)
  // ────────────────────────────────────────────────────────────
  async deposit(params: DepositParams): Promise<Transaction> {
    return withTransaction(async (client: PoolClient) => {
      const locked = await this.accounts.lockForUpdate([params.destinationAccountId], client);
      const dest = locked[0];
      if (!dest) throw new AccountNotFoundError(params.destinationAccountId);
      if (dest.status !== 'active') throw new AccountBlockedError(dest.status);

      await this.accounts.credit(params.destinationAccountId, params.amount, client);

      const txn = await this.transactions.create(
        {
          type:                 'deposit',
          destinationAccountId: params.destinationAccountId,
          amount:               params.amount,
          currency:             dest.currency,
          description:          params.description,
        },
        client,
      );

      await this.transactions.insertAuditLog(
        {
          userId:     params.requestingUserId,
          action:     'DEPOSIT',
          entityType: 'transaction',
          entityId:   txn.id,
          newValues:  { amount: params.amount, destinationAccount: params.destinationAccountId },
          ipAddress:  params.ipAddress,
        },
        client,
      );

      return txn;
    });
  }

  // ────────────────────────────────────────────────────────────
  // CONSULTA DE HISTORIAL
  // ────────────────────────────────────────────────────────────
  async getHistory(
    accountId:        string,
    requestingUserId: string,
    isAdmin:          boolean,
    limit:            number,
    offset:           number,
  ): Promise<Transaction[]> {
    // Verificamos ownership a través de los repositorios sin bloqueo
    const account = await this.accounts.findById(accountId);
    if (!account) throw new AccountNotFoundError(accountId);
    if (!isAdmin && account.userId !== requestingUserId) throw new ForbiddenError();

    return this.transactions.findByAccountId(accountId, limit, offset);
  }

  async getById(id: string): Promise<Transaction | null> {
    return this.transactions.findById(id);
  }
}
