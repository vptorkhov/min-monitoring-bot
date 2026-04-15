import TelegramBot from 'node-telegram-bot-api';

function getMessagePreview(text?: string): string {
    if (!text) {
        return '[no-text]';
    }

    const trimmed = text.replace(/\s+/g, ' ').trim();
    if (trimmed.length <= 80) {
        return trimmed;
    }

    return `${trimmed.slice(0, 77)}...`;
}

/** Регистрирует логирование входящих сообщений и callback-запросов. */
export function setupUpdateLoggingMiddleware(bot: TelegramBot): void {
    bot.on('message', (msg) => {
        const userId = msg.from?.id ?? 'unknown-user';
        const chatId = msg.chat.id;
        const preview = getMessagePreview(msg.text);
        console.log(`[update][message] user=${userId} chat=${chatId} text="${preview}"`);
    });

    bot.on('callback_query', (query) => {
        const userId = query.from.id;
        const data = query.data ?? '[no-data]';
        console.log(`[update][callback] user=${userId} data="${data}"`);
    });
}