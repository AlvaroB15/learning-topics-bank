import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UsersRepository } from '../repositories/users.repository';
import { env } from '../config/env';
import { JwtPayload } from '../models/types';
import { InvalidCredentialsError } from '../errors/BankingError';

export class AuthService {
  constructor(private readonly users: UsersRepository) {}

  async login(email: string, password: string): Promise<{ token: string; user: Omit<JwtPayload, never> }> {
    const user = await this.users.findByEmail(email.toLowerCase());

    // Siempre comparamos el hash aunque el usuario no exista (previene timing attack)
    const dummyHash = '$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012345';
    const hash = user?.passwordHash ?? dummyHash;
    const valid = await bcrypt.compare(password, hash);

    if (!user || !valid || !user.isActive) {
      throw new InvalidCredentialsError();
    }

    const payload: JwtPayload = {
      userId: user.id,
      email:  user.email,
      role:   user.role,
    };

    const token = jwt.sign(payload, env.jwt.secret, {
      expiresIn: env.jwt.expiresIn as jwt.SignOptions['expiresIn'],
    });

    return { token, user: payload };
  }
}
