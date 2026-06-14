import { Context } from 'koa';
import { TransactionsService } from '../services/transactions.service';
import { JwtPayload } from '../models/types';

export class TransactionsController {
  constructor(private readonly txnService: TransactionsService) {}

  transfer = async (ctx: Context): Promise<void> => {
    const user = ctx.state.user as JwtPayload;
    const body = ctx.state.body as {
      sourceAccountId:      string;
      destinationAccountId: string;
      amount:               string;
      description?:         string;
    };

    const txn = await this.txnService.transfer({
      ...body,
      requestingUserId: user.userId,
      idempotencyKey:   ctx.headers['idempotency-key'] as string | undefined,
      ipAddress:        ctx.ip,
      userAgent:        ctx.headers['user-agent'],
    });

    ctx.status = 201;
    ctx.body   = { data: txn };
  };

  deposit = async (ctx: Context): Promise<void> => {
    const user = ctx.state.user as JwtPayload;
    const body = ctx.state.body as {
      destinationAccountId: string;
      amount:               string;
      description?:         string;
    };

    const txn = await this.txnService.deposit({
      ...body,
      requestingUserId: user.userId,
      ipAddress:        ctx.ip,
    });

    ctx.status = 201;
    ctx.body   = { data: txn };
  };

  getHistory = async (ctx: Context): Promise<void> => {
    const user   = ctx.state.user as JwtPayload;
    const limit  = Number.parseInt(ctx.query.limit  as string || '20', 10);
    const offset = Number.parseInt(ctx.query.offset as string || '0',  10);

    const txns = await this.txnService.getHistory(
      ctx.params.accountId,
      user.userId,
      user.role === 'admin',
      limit,
      offset,
    );

    ctx.body = { data: txns, meta: { limit, offset } };
  };

  getById = async (ctx: Context): Promise<void> => {
    const txn = await this.txnService.getById(ctx.params.id);
    if (!txn) {
      ctx.status = 404;
      ctx.body   = { error: { code: 'NOT_FOUND', message: 'Transacción no encontrada' } };
      return;
    }
    ctx.body = { data: txn };
  };
}
