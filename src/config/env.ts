import 'dotenv/config';

const required = (name: string): string => {
    const val = process.env[name];
    if (!val) throw new Error(`Missing required env var: ${name}`);
    return val;
};

export const env = {
    port: Number.parseInt(process.env.PORT ?? '3000', 10),
    db: {
        host: process.env.DB_HOST ?? 'localhost',
        port: Number.parseInt(process.env.DB_PORT ?? '5432', 10),
        database: process.env.DB_NAME ?? 'banking',
        user: process.env.DB_USER ?? 'banking_user',
        password: required('DB_PASSWORD'),
        min: Number.parseInt(process.env.DB_POOL_MIN ?? '2', 10),
        max: Number.parseInt(process.env.DB_POOL_MAX ?? '10', 10),
    },
    jwt: {
        secret: required('JWT_SECRET'),
        expiresIn: process.env.JWT_EXPIRES_IN ?? '1h',
    },
    bcrypt: {
        rounds: Number.parseInt(process.env.BCRYPT_ROUNDS ?? '10', 10),
    },
    bcrypt_password: process.env.BCRYPT_PASSWORD ?? '3000'
} as const;

