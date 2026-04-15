import TelegramBot from 'node-telegram-bot-api';
import { DUPLICATE_CALLBACK_MESSAGE } from '../constants/messages.constant';

export type CallbackQueryHandler = (query: TelegramBot.CallbackQuery) => Promise<boolean>;

const CALLBACK_DEBOUNCE_MS = 800;

type LastCallback = {
    data: string;
    timestampMs: number;
};

const lastCallbackByUserId = new Map<number, LastCallback>();

function isDuplicateCallback(query: TelegramBot.CallbackQuery): boolean {
    const userId = query.from.id;
    const data = query.data ?? '';
    const nowMs = Date.now();
    const previous = lastCallbackByUserId.get(userId);

    lastCallbackByUserId.set(userId, { data, timestampMs: nowMs });
    if (!previous) {
        return false;
    }

    const isSameData = previous.data === data;
    const isInDebounceWindow = nowMs - previous.timestampMs <= CALLBACK_DEBOUNCE_MS;
    return isSameData && isInDebounceWindow;
}

/**
 * Единый роутер callback_query.
 * Команды регистрируют обработчики, а роутер централизованно
 * отвечает на callback, чтобы у клиента Telegram не зависал loader.
 */
export function createCallbackRouter(bot: TelegramBot) {
    const handlers: CallbackQueryHandler[] = [];

    const registerHandler = (handler: CallbackQueryHandler): void => {
        handlers.push(handler);
    };

    bot.on('callback_query', async (query) => {
        if (isDuplicateCallback(query)) {
            await bot.answerCallbackQuery(query.id, {
                text: DUPLICATE_CALLBACK_MESSAGE,
                show_alert: false
            });
            return;
        }

        for (const handler of handlers) {
            try {
                const handled = await handler(query);
                if (handled) {
                    await bot.answerCallbackQuery(query.id);
                    return;
                }
            } catch (error) {
                console.error('Ошибка в callback_query обработчике:', error);
                await bot.answerCallbackQuery(query.id);
                return;
            }
        }

        // Закрываем callback даже если он не обработан,
        // чтобы не оставлять пользователю бесконечный loader.
        await bot.answerCallbackQuery(query.id);
    });

    return {
        registerHandler
    };
}
