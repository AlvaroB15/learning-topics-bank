import Router from '@koa/router';
import authRoutes         from './auth.routes';
import accountsRoutes     from './accounts.routes';
import transactionsRoutes from './transactions.routes';

const api = new Router({ prefix: '/api/v1' });

api.use(authRoutes.routes(),         authRoutes.allowedMethods());
api.use(accountsRoutes.routes(),     accountsRoutes.allowedMethods());
api.use(transactionsRoutes.routes(), transactionsRoutes.allowedMethods());

export default api;
