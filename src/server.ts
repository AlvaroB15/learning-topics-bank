import './config/env'; // carga dotenv antes que cualquiera
import app from './app';
import {env, pool} from "./config";

async function start(): Promise<void> {
    // Verifica conexión a BD antes de levantar el servidor
    await pool.query('SELECT 1');
    console.log('[DB] Conexión establecida');

    const server = app.listen(env.port, () => {
        console.log(`[SERVER] Banking API corriendo en http://localhost:${env.port}`);
        console.log(`[SERVER] Ambiente: ${process.env.NODE_ENV ?? 'development'}`);
    });

    const shutdown = async (signal: string): Promise<void> => {
        console.log(`\n[SERVER] ${signal} recibido, cerrando...`);
        server.close(async () => {
            await pool.end();
            console.log('[DB] Pool cerrado');
            process.exit(0);
        });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((err) => {
    console.error('[SERVER] Error al iniciar:', err);
    process.exit(1);
});
