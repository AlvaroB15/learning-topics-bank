import { Pool, PoolClient } from 'pg';
import { Account } from '../models/types';

function mapRow(row: Record<string, unknown>): Account {
  return {
    id:            row.id as string,
    userId:        row.user_id as string,
    accountNumber: row.account_number as string,
    type:          row.type as Account['type'],
    balance:       row.balance as string,
    currency:      row.currency as Account['currency'],
    status:        row.status as Account['status'],
    dailyLimit:    row.daily_limit as string,
    version:       row.version as number,
    createdAt:     row.created_at as Date,
    updatedAt:     row.updated_at as Date,
  };
}

export class AccountsRepository {
  constructor(private readonly db: Pool) {}

  async findById(id: string): Promise<Account | null> {
    const { rows } = await this.db.query(
      'SELECT * FROM accounts WHERE id = $1',
      [id],
    );
    return rows[0] ? mapRow(rows[0]) : null;
  }

  async findByUserId(userId: string): Promise<Account[]> {
    const { rows } = await this.db.query(
      'SELECT * FROM accounts WHERE user_id = $1 ORDER BY created_at ASC',
      [userId],
    );
    return rows.map(mapRow);
  }

  /**
   * Bloquea las cuentas con SELECT FOR UPDATE.
   * Se ordenan por ID para prevenir deadlocks cuando dos transferencias
   * tocan las mismas cuentas en sentido inverso simultáneamente.
   */
  async lockForUpdate(ids: string[], client: PoolClient): Promise<Account[]> {
    const { rows } = await client.query(
      `SELECT * FROM accounts
       WHERE id = ANY($1::uuid[])
       ORDER BY id  -- orden determinístico: previene deadlock
       FOR UPDATE`,
      [ids],
    );
    return rows.map(mapRow);
  }

  async debit(id: string, amount: string, client: PoolClient): Promise<void> {
    await client.query(
      `UPDATE accounts
       SET balance = balance - $1, version = version + 1
       WHERE id = $2`,
      [amount, id],
    );
  }

  async credit(id: string, amount: string, client: PoolClient): Promise<void> {
    await client.query(
      `UPDATE accounts
       SET balance = balance + $1, version = version + 1
       WHERE id = $2`,
      [amount, id],
    );
  }

  /**
   * Acumula el total de operaciones del día (upsert).
   * Retorna el total actualizado para validar el límite diario.
   */
  async accumulateDailyTotal(
    accountId: string,
    amount: string,
    client: PoolClient,
  ): Promise<string> {
    const { rows } = await client.query(
      `INSERT INTO daily_transaction_totals (account_id, date, total_amount)
       VALUES ($1, CURRENT_DATE, $2)
       ON CONFLICT (account_id, date)
       DO UPDATE SET total_amount = daily_transaction_totals.total_amount + $2
       RETURNING total_amount`,
      [accountId, amount],
    );
    return rows[0].total_amount as string;
  }

  async getDailyTotal(accountId: string): Promise<string> {
    const { rows } = await this.db.query(
      `SELECT COALESCE(total_amount, 0) AS total_amount
       FROM daily_transaction_totals
       WHERE account_id = $1 AND date = CURRENT_DATE`,
      [accountId],
    );
    return (rows[0]?.total_amount ?? '0') as string;
  }
}
