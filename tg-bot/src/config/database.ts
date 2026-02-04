import { Client } from 'pg';
import { config } from './index';

export const dbClient = new Client({
    host: config.DB_HOST,
    port: config.DB_PORT,
    database: config.DB_NAME,
    user: config.DB_USER,
    password: config.DB_PASSWORD,
});

export async function connectToDatabase() {
    try {
        await dbClient.connect();
        console.log('✅ Успешно подключено к базе данных PostgreSQL');
    } catch (error) {
        console.error('❌ Ошибка подключения к базе данных:', error);
        process.exit(1);
    }
}