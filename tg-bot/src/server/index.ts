import express from 'express';
import type { Express } from 'express';
import dotenv from 'dotenv';

dotenv.config();

export function createServer(): Express {
    console.log('🌐 Создание HTTP сервера...');

    const app = express();

    // Базовый middleware для парсинга JSON
    app.use(express.json());

    // Health check endpoint
    app.get('/health', (req, res) => {
        res.status(200).json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            service: 'mobility-bot'
        });
    });

    console.log('✅ HTTP сервер создан');

    return app;
}

export function startServer(app: Express): void {
    const port = process.env.PORT || 3000;

    app.listen(port, () => {
        console.log(`🚀 HTTP сервер запущен на порту ${port}`);
        console.log(`🏥 Health check доступен по адресу http://localhost:${port}/health`);
    });
}