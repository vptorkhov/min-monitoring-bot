// src/bot/index.ts

import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import { initBot } from './init';
import { ActivationNotifier } from '../services/activation-notifier.service';

dotenv.config();

export default async function createAndSetupBot() {
    console.log('🤖 Настройка Telegram бота...');

    const token = process.env.BOT_TOKEN;
    if (!token) {
        throw new Error('❌ Отсутствует BOT_TOKEN в .env файле');
    }

    // Создание экземпляра бота с long polling
    const bot = new TelegramBot(token, {
        polling: {
            interval: 300,
            params: {
                timeout: 30,
            },
        },
    });

    let restartAttempts = 0;
    let restartTimer: NodeJS.Timeout | null = null;
    let isRestartingPolling = false;

    const restartableErrorCodes = new Set([
        'EFATAL',
        'ECONNRESET',
        'ETIMEDOUT',
        'ENOTFOUND',
        'EAI_AGAIN',
        'ECONNREFUSED',
    ]);

    const safeGetErrorCode = (error: unknown): string | undefined => {
        if (!error || typeof error !== 'object') {
            return undefined;
        }

        const err = error as {
            code?: unknown;
            cause?: { code?: unknown };
        };

        if (typeof err.code === 'string') {
            return err.code;
        }

        if (err.cause && typeof err.cause.code === 'string') {
            return err.cause.code;
        }

        return undefined;
    };

    const schedulePollingRestart = async (reason: string) => {
        if (isRestartingPolling || restartTimer) {
            return;
        }

        isRestartingPolling = true;
        restartAttempts += 1;

        const delayMs = Math.min(30_000, restartAttempts * 2_000);
        console.warn(
            `⚠️ Перезапуск polling через ${delayMs}ms (попытка ${restartAttempts}). Причина: ${reason}`
        );

        try {
            await bot.stopPolling({ cancel: true });
        } catch (stopError) {
            console.warn('⚠️ stopPolling завершился с ошибкой:', stopError);
        }

        restartTimer = setTimeout(async () => {
            try {
                await bot.startPolling();
                console.log('✅ Polling успешно восстановлен');
                restartAttempts = 0;
            } catch (startError) {
                console.error('❌ Не удалось перезапустить polling:', startError);
            } finally {
                restartTimer = null;
                isRestartingPolling = false;
            }
        }, delayMs);
    };

    // Базовое логирование ошибок
    bot.on('polling_error', (error) => {
        console.error('❌ Ошибка polling:', error);

        const code = safeGetErrorCode(error);
        if (code && restartableErrorCodes.has(code)) {
            void schedulePollingRestart(code);
        }
    });

    bot.on('error', (error) => {
        console.error('❌ Ошибка бота:', error);

        const code = safeGetErrorCode(error);
        if (code && restartableErrorCodes.has(code)) {
            void schedulePollingRestart(code);
        }
    });

    // Инициализация всех компонентов бота (сервисы, обработчики, middleware, команды)
    const { courierService, registrationHandler } = initBot(bot);

    // Нотификатор активации стартует сразу после поднятия бота
    const notifier = new ActivationNotifier(bot, courierService);
    notifier.start();

    console.log('✅ Telegram бот успешно настроен и запущен');

    // Возвращаем созданные экземпляры для возможного использования в других частях приложения
    return { bot, courierService, registrationHandler, notifier };
}