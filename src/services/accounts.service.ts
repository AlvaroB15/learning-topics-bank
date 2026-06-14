import { AccountsRepository } from '../repositories/accounts.repository';
import { Account } from '../models/types';
import { AccountNotFoundError, ForbiddenError } from '../errors/BankingError';

export class AccountsService {
  constructor(private readonly accounts: AccountsRepository) {}

  async getMyAccounts(userId: string): Promise<Account[]> {
    return this.accounts.findByUserId(userId);
  }

  async getAccountById(id: string, requestingUserId: string, isAdmin: boolean): Promise<Account> {
    const account = await this.accounts.findById(id);
    if (!account) throw new AccountNotFoundError(id);

    // Un customer solo puede ver sus propias cuentas
    if (!isAdmin && account.userId !== requestingUserId) {
      throw new ForbiddenError();
    }

    return account;
  }

  async getBalance(accountId: string, requestingUserId: string, isAdmin: boolean): Promise<{
    balance: string;
    currency: string;
    dailyTotal: string;
    dailyLimit: string;
  }> {
    const account = await this.getAccountById(accountId, requestingUserId, isAdmin);
    const dailyTotal = await this.accounts.getDailyTotal(accountId);

    return {
      balance:    account.balance,
      currency:   account.currency,
      dailyTotal,
      dailyLimit: account.dailyLimit,
    };
  }
}
