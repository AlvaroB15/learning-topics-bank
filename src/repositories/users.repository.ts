import { Pool } from 'pg';
import { User } from '../models/types';

function mapRow(row: Record<string, unknown>): User {
  return {
    id:           row.id as string,
    email:        row.email as string,
    passwordHash: row.password_hash as string,
    fullName:     row.full_name as string,
    role:         row.role as User['role'],
    isActive:     row.is_active as boolean,
    createdAt:    row.created_at as Date,
    updatedAt:    row.updated_at as Date,
  };
}

export class UsersRepository {
  constructor(private readonly db: Pool) {}

  async findByEmail(email: string): Promise<User | null> {
    const { rows } = await this.db.query(
      'SELECT * FROM users WHERE email = $1',
      [email],
    );
    return rows[0] ? mapRow(rows[0]) : null;
  }

  async findById(id: string): Promise<User | null> {
    const { rows } = await this.db.query(
      'SELECT * FROM users WHERE id = $1',
      [id],
    );
    return rows[0] ? mapRow(rows[0]) : null;
  }
}
