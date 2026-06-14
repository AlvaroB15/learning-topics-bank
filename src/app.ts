import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import {errorHandler} from './middlewares/errorHandler';
import api from './routes/index';

const app = new Koa();

// Seguridad básica: no exponer que usamos Koa
app.proxy = true;

// Middlewares globales
app.use(errorHandler);

app.use(bodyParser({
    enableTypes: ['json'],
    onerror(err, ctx) {
        ctx.throw(400, `Body inválido: ${err.message}`);
    },
}));

// Logging de requests
app.use(async (ctx, next) => {
    const start = Date.now();
    await next();
    const ms = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${ctx.method} ${ctx.url} ${ctx.status} - ${ms}ms`);
});

// Routes
app.use(api.routes());
app.use(api.allowedMethods());

// 404 catch-all
app.use((ctx) => {
    ctx.status = 404;
    ctx.body = {error: {code: 'NOT_FOUND', message: 'Endpoint no encontrado'}};
});

export default app;
