import express from 'express';
import type { Express } from 'express';
import type { Server } from 'http';
import type TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import type { BotRuntimeConfig } from '../bot';

dotenv.config();

interface CreateServerOptions {
    bot?: TelegramBot;
    runtimeConfig: BotRuntimeConfig;
}

export function createServer({ bot, runtimeConfig }: CreateServerOptions): Express {
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

    if (runtimeConfig.updateMode === 'webhook') {
        if (!bot || !runtimeConfig.webhookSecretToken) {
            throw new Error('❌ Для webhook-режима серверу требуется bot и WEBHOOK_SECRET_TOKEN');
        }

        app.post(runtimeConfig.webhookPath, (req, res) => {
            const receivedSecret = req.header('x-telegram-bot-api-secret-token');

            if (receivedSecret !== runtimeConfig.webhookSecretToken) {
                return res.sendStatus(401);
            }

            try {
                bot.processUpdate(req.body);
                return res.sendStatus(200);
            } catch (error) {
                console.error('❌ Ошибка обработки webhook:', error);
                return res.sendStatus(500);
            }
        });

        console.log(`🔗 Webhook endpoint активирован: ${runtimeConfig.webhookPath}`);
    }

    console.log('✅ HTTP сервер создан');

    return app;
}

export function startServer(app: Express): Server {
    const port = process.env.PORT || 3000;

    const server = app.listen(port, () => {
        console.log(`🚀 HTTP сервер запущен на порту ${port}`);
        console.log(`🏥 Health check доступен по адресу http://localhost:${port}/health`);
    });

    return server;
}