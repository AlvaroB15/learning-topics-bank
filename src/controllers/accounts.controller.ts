import { Context } from 'koa';
import { AccountsService } from '../services/accounts.service';
import { JwtPayload } from '../models/types';

export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  getMyAccounts = async (ctx: Context): Promise<void> => {
    const user = ctx.state.user as JwtPayload;
    const accounts = await this.accountsService.getMyAccounts(user.userId);
    ctx.body = { data: accounts };
  };

  getAccountById = async (ctx: Context): Promise<void> => {
    const user    = ctx.state.user as JwtPayload;
    const account = await this.accountsService.getAccountById(
      ctx.params.id,
      user.userId,
      user.role === 'admin',
    );
    ctx.body = { data: account };
  };

  getBalance = async (ctx: Context): Promise<void> => {
    const user   = ctx.state.user as JwtPayload;
    const result = await this.accountsService.getBalance(
      ctx.params.id,
      user.userId,
      user.role === 'admin',
    );
    ctx.body = { data: result };
  };
}
