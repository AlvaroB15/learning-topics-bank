export class BankingError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = 'BankingError';
  }
}

export class InsufficientFundsError extends BankingError {
  constructor() {
    super('INSUFFICIENT_FUNDS', 'Saldo insuficiente para realizar la operación', 422);
  }
}

export class DailyLimitExceededError extends BankingError {
  constructor(limit: string, currency: string) {
    super('DAILY_LIMIT_EXCEEDED', `Límite diario de ${currency} ${limit} excedido`, 422);
  }
}

export class AccountNotFoundError extends BankingError {
  constructor(id?: string) {
    super('ACCOUNT_NOT_FOUND', id ? `Cuenta ${id} no encontrada` : 'Cuenta no encontrada', 404);
  }
}

export class AccountBlockedError extends BankingError {
  constructor(status: string) {
    super('ACCOUNT_BLOCKED', `La cuenta está en estado: ${status}`, 403);
  }
}

export class SameAccountError extends BankingError {
  constructor() {
    super('SAME_ACCOUNT', 'Cuenta origen y destino no pueden ser la misma', 400);
  }
}

export class CurrencyMismatchError extends BankingError {
  constructor() {
    super('CURRENCY_MISMATCH', 'Las cuentas deben operar con la misma moneda', 400);
  }
}

export class DuplicateTransactionError extends BankingError {
  constructor(idempotencyKey: string) {
    super('DUPLICATE_TRANSACTION', `Transacción duplicada: ${idempotencyKey}`, 409);
  }
}

export class UnauthorizedError extends BankingError {
  constructor(message = 'No autorizado') {
    super('UNAUTHORIZED', message, 401);
  }
}

export class ForbiddenError extends BankingError {
  constructor() {
    super('FORBIDDEN', 'Acceso denegado', 403);
  }
}

export class UserNotFoundError extends BankingError {
  constructor() {
    super('USER_NOT_FOUND', 'Usuario no encontrado', 404);
  }
}

export class InvalidCredentialsError extends BankingError {
  constructor() {
    super('INVALID_CREDENTIALS', 'Credenciales inválidas', 401);
  }
}
