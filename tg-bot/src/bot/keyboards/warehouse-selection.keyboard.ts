import TelegramBot from 'node-telegram-bot-api';
import { INLINE_CALLBACK_DATA, KEYBOARD_BUTTON_TEXT } from './keyboard.constants';
import { buildNumberInlineRows, buildNumberReplyRows } from './keyboard.utils';

/**
 * Reply-клавиатура выбора склада по номеру.
 */
export const getWarehouseNumberSelectionKeyboard = (
    warehouseCount: number
): TelegramBot.ReplyKeyboardMarkup => {
    return {
        keyboard: [
            ...buildNumberReplyRows(warehouseCount),
            [{ text: KEYBOARD_BUTTON_TEXT.CANCEL }]
        ],
        resize_keyboard: true,
        one_time_keyboard: false
    };
};

/**
 * Inline-клавиатура выбора склада по номеру.
 */
export const getWarehouseNumberSelectionInlineKeyboard = (
    warehouseCount: number
): TelegramBot.InlineKeyboardMarkup => {
    return {
        inline_keyboard: buildNumberInlineRows(warehouseCount, INLINE_CALLBACK_DATA.WAREHOUSE_SELECT_PREFIX)
    };
};
