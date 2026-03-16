import TelegramBot from 'node-telegram-bot-api';

export type CallbackQueryHandler = (query: TelegramBot.CallbackQuery) => Promise<boolean>;

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
