import dotenv from 'dotenv';

dotenv.config();

export const config = {
    // Telegram Bot Token
    BOT_TOKEN: process.env.BOT_TOKEN,

    // Server
    PORT: parseInt(process.env.PORT || '3000'),

    // Database
    DB_HOST: process.env.DB_HOST || 'localhost',
    DB_PORT: parseInt(process.env.DB_PORT || '5432'),
    DB_NAME: process.env.DB_NAME || 'mobility_db',
    DB_USER: process.env.DB_USER || 'mobility_user',
    DB_PASSWORD: process.env.DB_PASSWORD || 'mobility_password',

    // Admin Password (for registration)
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'admin123',

    // Super Admin Telegram ID (optional)
    SUPER_ADMIN_TELEGRAM_ID: process.env.SUPER_ADMIN_TELEGRAM_ID
        ? parseInt(process.env.SUPER_ADMIN_TELEGRAM_ID)
        : null,
};

// Validate required environment variables
if (!config.BOT_TOKEN) {
    console.error('❌ ОШИБКА: BOT_TOKEN не найден в .env файле');
    process.exit(1);
}