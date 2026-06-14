/**
 * Script de seed: se inserta usuarios y cuentas con data realista para Peru.
 * Uso: npm run seed
 */
import '../config/env';
import bcrypt from 'bcryptjs';
import {pool, env} from '../config';

const PASSWORD = env.bcrypt_password;

async function seed(): Promise<void> {
    const client = await pool.connect();
    console.log('[SEED] Conectado a la BD');

    try {
        await client.query('BEGIN');

        // Limpiamos en orden para respetar FK
        await client.query('DELETE FROM audit_log');
        await client.query('DELETE FROM daily_transaction_totals');
        await client.query('DELETE FROM transactions');
        await client.query('DELETE FROM accounts');
        await client.query('DELETE FROM users');
        console.log('[SEED] Tablas limpias');

        const hash = await bcrypt.hash(PASSWORD, env.bcrypt.rounds);
        console.log('[SEED] Hash generado para contraseña:', PASSWORD);

        // ── Usuarios ──────────────────────────────────────────────
        const {rows: users} = await client.query<{ id: string }>(
            `INSERT INTO users (email, password_hash, full_name, role)
             VALUES ($1, $2, 'Juan Pérez Mamani', 'customer'),
                    ($3, $2, 'María García López', 'customer'),
                    ($4, $2, 'Carlos Teller BCP', 'teller'),
                    ($5, $2, 'Admin Sistema Banco', 'admin') RETURNING id`,
            [
                'juan.perez@banco.pe',
                hash,
                'maria.garcia@banco.pe',
                'carlos.teller@banco.pe',
                'admin@banco.pe',
            ],
        );

        const [juanId, mariaId, , adminId] = users.map((u) => u.id);
        console.log('[SEED] Usuarios insertados');

        // ── Cuentas ───────────────────────────────────────────────
        await client.query(
            `INSERT INTO accounts (user_id, account_number, type, balance, currency, daily_limit)
             VALUES ($1, '001-001-001234', 'checking', 15000.0000, 'PEN', 50000.0000),
                    ($1, '001-001-001235', 'savings', 45000.0000, 'PEN', 20000.0000),
                    ($2, '001-002-002345', 'checking', 8500.5000, 'PEN', 50000.0000),
                    ($2, '001-002-002346', 'savings', 120000.0000, 'PEN', 30000.0000),
                    ($3, '001-000-000001', 'checking', 999999.0000, 'PEN', 999999.0000)`,
            [juanId, mariaId, adminId],
        );
        console.log('[SEED] Cuentas insertadas');

        await client.query('COMMIT');
        console.log('\n[SEED] ✓ Seed completado exitosamente');
        console.log('[SEED] ─────────────────────────────────────────');
        console.log('[SEED] Usuarios disponibles (contraseña: password123)');
        console.log('[SEED]   juan.perez@banco.pe   → customer');
        console.log('[SEED]   maria.garcia@banco.pe → customer');
        console.log('[SEED]   carlos.teller@banco.pe → teller');
        console.log('[SEED]   admin@banco.pe         → admin');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[SEED] Error, rollback ejecutado:', err);
        throw err;
    } finally {
        client.release();
        await pool.end();
    }
}

seed().catch((err) => {
    console.error(err);
    process.exit(1);
});
