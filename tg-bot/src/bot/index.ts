// src/bot/index.ts

import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import { initBot } from './init';
import { ActivationNotifier } from '../services/activation-notifier.service';

dotenv.config();

export type BotUpdateMode = 'polling' | 'webhook';

export interface BotRuntimeConfig {
    updateMode: BotUpdateMode;
    webhookPath: string;
    webhookSecretToken?: string;
    deleteWebhookOnShutdown: boolean;
}

export interface BotSetupResult {
    bot: TelegramBot;
    notifier: ActivationNotifier;
    runtimeConfig: BotRuntimeConfig;
}

function normalizeWebhookPath(pathValue: string): string {
    return pathValue.startsWith('/') ? pathValue : `/${pathValue}`;
}

function resolveBotRuntimeConfig(): BotRuntimeConfig {
    const modeValue = (process.env.BOT_UPDATE_MODE || 'polling').toLowerCase();
    const webhookPath = normalizeWebhookPath(process.env.WEBHOOK_PATH || '/webhook/telegram');
    const deleteWebhookOnShutdown = (process.env.WEBHOOK_DELETE_ON_SHUTDOWN || 'false').toLowerCase() === 'true';

    if (modeValue !== 'polling' && modeValue !== 'webhook') {
        throw new Error('❌ Некорректный BOT_UPDATE_MODE. Допустимые значения: polling, webhook');
    }

    if (modeValue === 'webhook') {
        if (!process.env.WEBHOOK_BASE_URL) {
            throw new Error('❌ Для режима webhook требуется WEBHOOK_BASE_URL');
        }
        if (!process.env.WEBHOOK_SECRET_TOKEN) {
            throw new Error('❌ Для режима webhook требуется WEBHOOK_SECRET_TOKEN');
        }
    }

    return {
        updateMode: modeValue,
        webhookPath,
        webhookSecretToken: process.env.WEBHOOK_SECRET_TOKEN,
        deleteWebhookOnShutdown,
    };
}

function buildWebhookUrl(baseUrl: string, webhookPath: string): string {
    return `${baseUrl.replace(/\/+$/, '')}${webhookPath}`;
}

export default async function createAndSetupBot() {
    console.log('🤖 Настройка Telegram бота...');

    const token = process.env.BOT_TOKEN;
    if (!token) {
        throw new Error('❌ Отсутствует BOT_TOKEN в .env файле');
    }

    const runtimeConfig = resolveBotRuntimeConfig();
    console.log(`🔧 Режим обновлений Telegram: ${runtimeConfig.updateMode}`);

    // Инициализируем бота без автозапуска polling, чтобы явно управлять режимом.
    const bot = new TelegramBot(token, { polling: false });

    if (runtimeConfig.updateMode === 'polling') {
        // На всякий случай убираем webhook перед запуском polling, чтобы исключить конфликт getUpdates.
        await bot.deleteWebHook();
        await bot.startPolling();

        bot.on('polling_error', (error) => {
            console.error('❌ Ошибка polling:', error);
        });
    } else {
        const webhookUrl = buildWebhookUrl(process.env.WEBHOOK_BASE_URL!, runtimeConfig.webhookPath);
        // В типах библиотеки может отсутствовать secret_token, поэтому передаем через совместимый объект.
        await bot.setWebHook(webhookUrl, { secret_token: runtimeConfig.webhookSecretToken } as never);
        console.log(`🔗 Webhook установлен: ${webhookUrl}`);
    }

    bot.on('error', (error) => {
        console.error('❌ Ошибка бота:', error);
    });

    // Инициализация всех компонентов бота (сервисы, обработчики, middleware, команды)
    const { courierService } = initBot(bot);

    // Нотификатор активации стартует сразу после поднятия бота
    const notifier = new ActivationNotifier(bot, courierService);
    notifier.start();

    console.log('✅ Telegram бот успешно настроен и запущен');

    // Возвращаем созданные экземпляры для использования в server и graceful shutdown.
    return {
        bot,
        notifier,
        runtimeConfig,
    } satisfies BotSetupResult;
}