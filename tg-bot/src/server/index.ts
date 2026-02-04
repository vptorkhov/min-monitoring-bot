import express from 'express';
import { config } from '../config';
import { dbClient } from '../config/database';

export function createServer(): express.Application {
    console.log('🌐 Создание Express сервера...');

    const app = express();

    // Middleware для парсинга JSON
    app.use(express.json());

    // Health check endpoint
    app.get('/health', async (req, res) => {
        try {
            // Проверяем подключение к базе данных
            const dbResult = await dbClient.query('SELECT version()');
            const dbVersion = dbResult.rows[0].version;

            // Проверяем количество администраторов
            const adminResult = await dbClient.query('SELECT COUNT(*) as admin_count FROM admins WHERE is_active = true');
            const adminCount = adminResult.rows[0].admin_count;

            res.json({
                status: 'OK',
                service: 'Telegram Mobility Bot',
                timestamp: new Date().toISOString(),
                database: 'connected',
                db_version: dbVersion.split(' ')[1],
                admins: parseInt(adminCount),
                mode: 'polling',
                version: '1.0.0'
            });
        } catch (error) {
            res.status(500).json({
                status: 'ERROR',
                service: 'Telegram Mobility Bot',
                timestamp: new Date().toISOString(),
                database: 'disconnected',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });

    // Главная страница
    app.get('/', (req, res) => {
        res.json({
            message: 'Telegram Mobility Bot API',
            status: 'active',
            endpoints: {
                health: '/health',
                docs: 'Coming soon...'
            },
            features: {
                user_registration: true,
                admin_system: true,
                device_management: true,
                session_tracking: true
            }
        });
    });

    console.log('✅ Express сервер создан');
    return app;
}

export function startServer(app: express.Application): void {
    const PORT = config.PORT;

    app.listen(PORT, () => {
        console.log(`🚀 Сервер запущен на порту ${PORT}`);
        console.log(`📞 Health check: http://localhost:${PORT}/health`);

        // Логируем информацию о конфигурации
        console.log('\n📊 Конфигурация:');
        console.log(`   • Режим: Polling`);
        console.log(`   • Порт сервера: ${PORT}`);
        console.log(`   • База данных: ${config.DB_HOST}:${config.DB_PORT}/${config.DB_NAME}`);
        console.log(`   • Пароль администратора: ${config.ADMIN_PASSWORD ? 'установлен' : 'не установлен'}`);
        console.log(`   • Суперадмин ID: ${config.SUPER_ADMIN_TELEGRAM_ID || 'не указан'}`);

        // Показываем предупреждение, если используется пароль по умолчанию
        if (config.ADMIN_PASSWORD === 'admin123') {
            console.log(`   ⚠️  Используется пароль администратора по умолчанию!`);
            console.log(`   ⚠️  Рекомендуется изменить ADMIN_PASSWORD в .env файле`);
        }
    });
}