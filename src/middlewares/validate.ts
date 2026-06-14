import {Context, Next} from 'koa';
import {ZodSchema} from 'zod';

type Source = 'body' | 'params' | 'query';

export function validate(schema: ZodSchema, source: Source = 'body') {
    return async (ctx: Context, next: Next): Promise<void> => {
        let data;
        switch (source) {
            case 'body':
                data = ctx.request.body
                break;
            case 'params':
                data = ctx.params
                break;
            case 'query':
                data = ctx.query
        }

        // ZodError se propaga al errorHandler global
        ctx.state[source] = schema.parse(data);

        await next();
    };
}
