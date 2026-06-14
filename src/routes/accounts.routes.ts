import Router from '@koa/router';
import { requireAuth } from '../middlewares/auth';
import { rateLimiter } from '../middlewares/rateLimiter';
import { AccountsController } from '../controllers/accounts.controller';
import { AccountsService } from '../services/accounts.service';
import { AccountsRepository } from '../repositories/accounts.repository';
import { TransactionsService } from '../services/transactions.service';
import { TransactionsController } from '../controllers/transactions.controller';
import { TransactionsRepository } from '../repositories/transactions.repository';
import { pool } from '../config/db';

const router = new Router({ prefix: '/accounts' });

const accountsRepo   = new AccountsRepository(pool);
const txnRepo        = new TransactionsRepository(pool);
const accountsSvc    = new AccountsService(accountsRepo);
const txnSvc         = new TransactionsService(accountsRepo, txnRepo);
const accountsCtrl   = new AccountsController(accountsSvc);
const txnCtrl        = new TransactionsController(txnSvc);

router.use(requireAuth);
router.use(rateLimiter(60, 60_000)); // 60 req/min

router.get('/',          accountsCtrl.getMyAccounts);
router.get('/:id',       accountsCtrl.getAccountById);
router.get('/:id/balance', accountsCtrl.getBalance);
router.get('/:accountId/transactions', txnCtrl.getHistory);

export default router;
