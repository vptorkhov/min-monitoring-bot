import TelegramBot from 'node-telegram-bot-api';
import { INLINE_CALLBACK_DATA, KEYBOARD_BUTTON_TEXT } from './keyboard.constants';
import { buildNumberInlineRows, buildNumberReplyRows } from './keyboard.utils';

/**
 * Reply-клавиатура выбора СИМ по номеру в /take_sim.
 */
export const getTakeSimNumberSelectionKeyboard = (
    deviceCount: number
): TelegramBot.ReplyKeyboardMarkup => {
    return {
        keyboard: [
            [{ text: KEYBOARD_BUTTON_TEXT.CANCEL }],
            ...buildNumberReplyRows(deviceCount)
        ],
        resize_keyboard: true,
        one_time_keyboard: false
    };
};

/**
 * Inline-клавиатура выбора СИМ по номеру в /take_sim.
 */
export const getTakeSimNumberSelectionInlineKeyboard = (
    deviceCount: number
): TelegramBot.InlineKeyboardMarkup => {
    return {
        inline_keyboard: buildNumberInlineRows(deviceCount, INLINE_CALLBACK_DATA.TAKE_SIM_SELECT_PREFIX)
    };
};
