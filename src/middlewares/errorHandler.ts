import { Context, Next } from 'koa';
import { BankingError } from '../errors/BankingError';
import { ZodError } from 'zod';

export async function errorHandler(ctx: Context, next: Next): Promise<void> {
  try {
    await next();
  } catch (err) {
    if (err instanceof BankingError) {
      ctx.status = err.statusCode;
      ctx.body = {
        error: {
          code:    err.code,
          message: err.message,
        },
      };
      return;
    }

    if (err instanceof ZodError) {
      ctx.status = 400;
      ctx.body = {
        error: {
          code:    'VALIDATION_ERROR',
          message: 'Datos de entrada inválidos',
          details: err.errors.map((e) => ({
            field:   e.path.join('.'),
            message: e.message,
          })),
        },
      };
      return;
    }

    // Error de constraint de PostgreSQL (ej: unique violation)
    if (isPostgresError(err)) {
      if (err.code === '23505') {
        ctx.status = 409;
        ctx.body = { error: { code: 'CONFLICT', message: 'Registro duplicado' } };
        return;
      }
      if (err.code === '23514') {
        ctx.status = 400;
        ctx.body = { error: { code: 'CONSTRAINT_VIOLATION', message: 'Violación de restricción de datos' } };
        return;
      }
    }

    console.error('[ERROR]', err);
    ctx.status = 500;
    ctx.body = { error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' } };
  }
}

function isPostgresError(err: unknown): err is { code: string; message: string } {
  return typeof err === 'object' && err !== null && 'code' in err;
}
