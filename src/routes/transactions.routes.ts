import Router from '@koa/router';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middlewares/auth';
import { rateLimiter } from '../middlewares/rateLimiter';
import { validate } from '../middlewares/validate';
import { TransactionsController } from '../controllers/transactions.controller';
import { TransactionsService } from '../services/transactions.service';
import { AccountsRepository } from '../repositories/accounts.repository';
import { TransactionsRepository } from '../repositories/transactions.repository';
import { pool } from '../config';

const router = new Router({ prefix: '/transactions' });

const accountsRepo = new AccountsRepository(pool);
const txnRepo      = new TransactionsRepository(pool);
const txnSvc       = new TransactionsService(accountsRepo, txnRepo);
const controller   = new TransactionsController(txnSvc);

const transferSchema = z.object({
  sourceAccountId:      z.string().uuid('ID de cuenta origen inválido'),
  destinationAccountId: z.string().uuid('ID de cuenta destino inválido'),
  amount:               z.string().regex(/^\d+(\.\d{1,4})?$/, 'Monto inválido'),
  description:          z.string().max(255).optional(),
});

const depositSchema = z.object({
  destinationAccountId: z.string().uuid('ID de cuenta destino inválido'),
  amount:               z.string().regex(/^\d+(\.\d{1,4})?$/, 'Monto inválido'),
  description:          z.string().max(255).optional(),
});

router.use(requireAuth);

// Transferencia: 10 por minuto (operación sensible)
router.post('/transfer',
  rateLimiter(10, 60_000),
  validate(transferSchema),
  controller.transfer,
);

// Depósito: solo tellers y admins
router.post('/deposit',
  requireRole('teller', 'admin'),
  rateLimiter(30, 60_000),
  validate(depositSchema),
  controller.deposit,
);

router.get('/:id', controller.getById);

export default router;
