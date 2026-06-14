// ============================================================
// Domain types — mirrors de las tablas PostgreSQL
// ============================================================

export type UserRole       = 'customer' | 'teller' | 'admin';
export type AccountType    = 'checking' | 'savings';
export type AccountStatus  = 'active' | 'blocked' | 'closed';
export type TransactionType   = 'transfer' | 'deposit' | 'withdrawal';
export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'reversed';
export type Currency       = 'PEN' | 'USD' | 'EUR';

export interface User {
  id:           string;
  email:        string;
  passwordHash: string;
  fullName:     string;
  role:         UserRole;
  isActive:     boolean;
  createdAt:    Date;
  updatedAt:    Date;
}

export interface Account {
  id:            string;
  userId:        string;
  accountNumber: string;
  type:          AccountType;
  balance:       string;   // NUMERIC devuelto como string por node-pg — preserva precisión
  currency:      Currency;
  status:        AccountStatus;
  dailyLimit:    string;
  version:       number;
  createdAt:     Date;
  updatedAt:     Date;
}

export interface Transaction {
  id:                   string;
  idempotencyKey?:      string;
  type:                 TransactionType;
  status:               TransactionStatus;
  sourceAccountId?:     string;
  destinationAccountId?: string;
  amount:               string;
  currency:             Currency;
  description?:         string;
  metadata?:            Record<string, unknown>;
  createdAt:            Date;
  updatedAt:            Date;
}

export interface JwtPayload {
  userId: string;
  email:  string;
  role:   UserRole;
}

// Extiende el estado de Koa para tipado
declare module 'koa' {
  interface DefaultState {
    user?: JwtPayload;
  }
}
