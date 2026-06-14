import { Pool, PoolClient } from 'pg';
import { Transaction, TransactionType } from '../models/types';

function mapRow(row: Record<string, unknown>): Transaction {
  return {
    id:                   row.id as string,
    idempotencyKey:       row.idempotency_key as string | undefined,
    type:                 row.type as Transaction['type'],
    status:               row.status as Transaction['status'],
    sourceAccountId:      row.source_account_id as string | undefined,
    destinationAccountId: row.destination_account_id as string | undefined,
    amount:               row.amount as string,
    currency:             row.currency as Transaction['currency'],
    description:          row.description as string | undefined,
    metadata:             row.metadata as Record<string, unknown> | undefined,
    createdAt:            row.created_at as Date,
    updatedAt:            row.updated_at as Date,
  };
}

export interface CreateTransactionParams {
  idempotencyKey?:      string;
  type:                 TransactionType;
  sourceAccountId?:     string;
  destinationAccountId?: string;
  amount:               string;
  currency:             string;
  description?:         string;
  metadata?:            Record<string, unknown>;
}

export class TransactionsRepository {
  constructor(private readonly db: Pool) {}

  async findByIdempotencyKey(key: string): Promise<Transaction | null> {
    const { rows } = await this.db.query(
      'SELECT * FROM transactions WHERE idempotency_key = $1',
      [key],
    );
    return rows[0] ? mapRow(rows[0]) : null;
  }

  async findById(id: string): Promise<Transaction | null> {
    const { rows } = await this.db.query(
      'SELECT * FROM transactions WHERE id = $1',
      [id],
    );
    return rows[0] ? mapRow(rows[0]) : null;
  }

  async findByAccountId(
    accountId: string,
    limit = 20,
    offset = 0,
  ): Promise<Transaction[]> {
    const { rows } = await this.db.query(
      `SELECT * FROM transactions
       WHERE source_account_id = $1 OR destination_account_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [accountId, limit, offset],
    );
    return rows.map(mapRow);
  }

  async create(params: CreateTransactionParams, client: PoolClient): Promise<Transaction> {
    const { rows } = await client.query(
      `INSERT INTO transactions
         (idempotency_key, type, status,
          source_account_id, destination_account_id,
          amount, currency, description, metadata)
       VALUES ($1, $2, 'completed', $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        params.idempotencyKey ?? null,
        params.type,
        params.sourceAccountId ?? null,
        params.destinationAccountId ?? null,
        params.amount,
        params.currency,
        params.description ?? null,
        params.metadata ? JSON.stringify(params.metadata) : null,
      ],
    );
    return mapRow(rows[0]);
  }

  async insertAuditLog(
    {
      userId,
      action,
      entityType,
      entityId,
      oldValues,
      newValues,
      ipAddress,
      userAgent,
    }: {
      userId?:     string;
      action:      string;
      entityType:  string;
      entityId?:   string;
      oldValues?:  Record<string, unknown>;
      newValues?:  Record<string, unknown>;
      ipAddress?:  string;
      userAgent?:  string;
    },
    client: PoolClient,
  ): Promise<void> {
    await client.query(
      `INSERT INTO audit_log
         (user_id, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7::inet, $8)`,
      [
        userId    ?? null,
        action,
        entityType,
        entityId  ?? null,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        ipAddress ?? null,
        userAgent ?? null,
      ],
    );
  }
}
