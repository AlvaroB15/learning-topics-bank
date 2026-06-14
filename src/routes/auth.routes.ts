import Router from '@koa/router';
import { z } from 'zod';
import { validate } from '../middlewares/validate';
import { rateLimiter } from '../middlewares/rateLimiter';
import { AuthController } from '../controllers/auth.controller';
import { AuthService } from '../services/auth.service';
import { UsersRepository } from '../repositories/users.repository';
import { pool } from '../config';

const router = new Router({ prefix: '/auth' });

const usersRepo  = new UsersRepository(pool);
const authSvc    = new AuthService(usersRepo);
const controller = new AuthController(authSvc);

const loginSchema = z.object({
  email:    z.string().email('Email inválido'),
  password: z.string().min(6, 'Contraseña muy corta'),
});

// 5 intentos por minuto por IP (prevención de brute-force)
router.post('/login',
  rateLimiter(5, 60_000),
  validate(loginSchema),
  controller.login,
);

router.get('/test',
    rateLimiter(5, 60_000),
    controller.test,
);

export default router;
