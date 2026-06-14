import { Context, Next } from 'koa';

interface Window {
  timestamps: number[];
}

// Ventana deslizante en memoria (para multi-instancia, reemplazar por Redis)
const store = new Map<string, Window>();

export function rateLimiter(maxRequests: number, windowMs: number) {
  return async (ctx: Context, next: Next): Promise<void> => {
    const key = `${ctx.ip}:${ctx.path}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    const window = store.get(key) ?? { timestamps: [] };
    window.timestamps = window.timestamps.filter((t) => t > windowStart);

    if (window.timestamps.length >= maxRequests) {
      ctx.status = 429;
      ctx.set('Retry-After', String(Math.ceil(windowMs / 1000)));
      ctx.body = {
        error: {
          code:    'RATE_LIMIT_EXCEEDED',
          message: `Límite de ${maxRequests} solicitudes por ${windowMs / 1000}s excedido`,
        },
      };
      return;
    }

    window.timestamps.push(now);
    store.set(key, window);

    ctx.set('X-RateLimit-Limit',     String(maxRequests));
    ctx.set('X-RateLimit-Remaining', String(maxRequests - window.timestamps.length));

    await next();
  };
}
