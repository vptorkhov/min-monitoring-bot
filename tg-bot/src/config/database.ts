// src/config/database.ts

import { Pool, types } from 'pg';
import dotenv from 'dotenv';

// Принудительно парсим TIMESTAMP (без таймзоны, OID 1114) как UTC,
// чтобы pg не интерпретировал значения из БД по локальному времени процесса.
types.setTypeParser(1114, (val: string) => new Date(val + 'Z'));

dotenv.config();

// Конфигурация по умолчанию
const DEFAULT_DB_HOST = 'localhost';
const DEFAULT_DB_PORT = 5432;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

// Хранилище для пула (приватная переменная модуля)
let pool: Pool | null = null;

// Функция для задержки
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Инициализация подключения к базе данных
 * Создает пул соединений и проверяет подключение
 * Должна быть вызвана один раз при запуске приложения
 */
export async function initializeDatabase(): Promise<Pool> {
    console.log('📦 Подключение к базе данных...');

    // Если уже подключены, возвращаем существующий pool
    if (pool) {
        console.log('🔄 Используется существующее подключение к БД');
        return pool;
    }

    // Чтение параметров из переменных окружения
    const host = process.env.DB_HOST || DEFAULT_DB_HOST;
    const port = parseInt(process.env.DB_PORT || String(DEFAULT_DB_PORT));
    const user = process.env.DB_USER;
    const password = process.env.DB_PASSWORD;
    const database = process.env.DB_NAME;

    // Проверка обязательных параметров
    if (!user || !password || !database) {
        throw new Error('❌ Отсутствуют обязательные параметры подключения к БД. Проверьте DB_USER, DB_PASSWORD, DB_NAME в .env файле');
    }

    // Создание пула соединений
    const newPool = new Pool({
        host,
        port,
        user,
        password,
        database,
        // Гарантируем UTC-часовой пояс на уровне сессии PostgreSQL,
        // чтобы NOW() / CURRENT_TIMESTAMP всегда записывали UTC.
        options: '-c timezone=UTC',
    });

    // Попытки подключения с повторными попытками
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            console.log(`🔄 Попытка подключения к БД (${attempt}/${MAX_RETRIES})...`);

            // Проверка соединения
            const client = await newPool.connect();
            const result = await client.query('SELECT 1 as connection_test');
            client.release();

            if (result.rows[0]?.connection_test === 1) {
                console.log('✅ Подключение к базе данных успешно установлено');
                pool = newPool; // Сохраняем пул в модуле
                return pool;
            }

        } catch (error) {
            console.error(`❌ Попытка ${attempt} не удалась:`, error instanceof Error ? error.message : error);

            if (attempt < MAX_RETRIES) {
                console.log(`⏳ Ожидание ${RETRY_DELAY_MS / 1000} секунд перед следующей попыткой...`);
                await delay(RETRY_DELAY_MS);
            }
        }
    }

    throw new Error(`❌ Не удалось подключиться к БД после ${MAX_RETRIES} попыток`);
}

/**
 * Получение пула соединений
 * Должна вызываться только после initializeDatabase()
 * @throws Error если база данных не инициализирована
 */
export function getDatabase(): Pool {
    if (!pool) {
        throw new Error('❌ База данных не инициализирована. Сначала вызовите initializeDatabase()');
    }
    return pool;
}

/**
 * Закрытие всех соединений с базой данных
 * Полезно для graceful shutdown
 */
export async function closeDatabase(): Promise<void> {
    if (pool) {
        await pool.end();
        pool = null;
        console.log('📦 Соединения с БД закрыты');
    }
}