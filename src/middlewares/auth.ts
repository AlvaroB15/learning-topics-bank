import { Context, Next } from 'koa';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { JwtPayload, UserRole } from '../models/types';
import { UnauthorizedError, ForbiddenError } from '../errors/BankingError';

export async function requireAuth(ctx: Context, next: Next): Promise<void> {
  const header = ctx.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Token de acceso requerido');
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, env.jwt.secret) as JwtPayload;
    ctx.state.user = payload;
  } catch {
    throw new UnauthorizedError('Token inválido o expirado');
  }

  await next();
}

export function requireRole(...roles: UserRole[]) {
  return async (ctx: Context, next: Next): Promise<void> => {
    const user = ctx.state.user;
    if (!user || !roles.includes(user.role)) {
      throw new ForbiddenError();
    }
    await next();
  };
}
