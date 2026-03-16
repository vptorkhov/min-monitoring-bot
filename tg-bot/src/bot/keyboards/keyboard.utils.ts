import TelegramBot from 'node-telegram-bot-api';

const DEFAULT_CHUNK_SIZE = 5;

export function buildNumberReplyRows(
    count: number,
    chunkSize = DEFAULT_CHUNK_SIZE
): TelegramBot.KeyboardButton[][] {
    const buttons: TelegramBot.KeyboardButton[] = Array.from(
        { length: count },
        (_, index) => ({ text: String(index + 1) })
    );

    const rows: TelegramBot.KeyboardButton[][] = [];
    for (let i = 0; i < buttons.length; i += chunkSize) {
        rows.push(buttons.slice(i, i + chunkSize));
    }

    return rows;
}

export function buildNumberInlineRows(
    count: number,
    callbackPrefix: string,
    chunkSize = DEFAULT_CHUNK_SIZE
): TelegramBot.InlineKeyboardButton[][] {
    const buttons: TelegramBot.InlineKeyboardButton[] = Array.from(
        { length: count },
        (_, index) => ({
            text: String(index + 1),
            callback_data: `${callbackPrefix}${index + 1}`
        })
    );

    const rows: TelegramBot.InlineKeyboardButton[][] = [];
    for (let i = 0; i < buttons.length; i += chunkSize) {
        rows.push(buttons.slice(i, i + chunkSize));
    }

    return rows;
}
