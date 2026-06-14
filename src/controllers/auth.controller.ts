import {Context} from 'koa';
import {AuthService} from '../services/auth.service';

export class AuthController {
    constructor(private readonly authService: AuthService) {
    }

    login = async (ctx: Context): Promise<void> => {
        const {email, password} = ctx.state.body as { email: string; password: string };
        const result = await this.authService.login(email, password);
        ctx.status = 200;
        ctx.body = result;
    };

    test = async (ctx: Context): Promise<void> => {
        ctx.status = 200;
        ctx.body = 'TEST desde KOA';
    };
}
