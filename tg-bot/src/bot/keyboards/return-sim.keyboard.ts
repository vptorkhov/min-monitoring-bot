import TelegramBot from 'node-telegram-bot-api';
import { INLINE_CALLBACK_DATA, KEYBOARD_BUTTON_TEXT } from './keyboard.constants';

/**
 * Reply-клавиатура шага /return_sim: вопрос о повреждениях.
 */
export const getReturnSimDamageQuestionKeyboard = (): TelegramBot.ReplyKeyboardMarkup => {
    return {
        keyboard: [
            [{ text: KEYBOARD_BUTTON_TEXT.NO }],
            [{ text: KEYBOARD_BUTTON_TEXT.YES }],
            [{ text: KEYBOARD_BUTTON_TEXT.CANCEL }]
        ],
        resize_keyboard: true,
        one_time_keyboard: false
    };
};

/**
 * Inline-клавиатура шага /return_sim: вопрос о повреждениях.
 */
export const getReturnSimDamageQuestionInlineKeyboard = (): TelegramBot.InlineKeyboardMarkup => {
    return {
        inline_keyboard: [
            [{ text: KEYBOARD_BUTTON_TEXT.NO, callback_data: INLINE_CALLBACK_DATA.RETURN_DAMAGE_NO }],
            [{ text: KEYBOARD_BUTTON_TEXT.YES, callback_data: INLINE_CALLBACK_DATA.RETURN_DAMAGE_YES }]
        ]
    };
};

/**
 * Reply-клавиатура шага /return_sim: выбор типа повреждения.
 */
export const getReturnSimDamageTypeKeyboard = (): TelegramBot.ReplyKeyboardMarkup => {
    return {
        keyboard: [
            [{ text: KEYBOARD_BUTTON_TEXT.WEAK }],
            [{ text: KEYBOARD_BUTTON_TEXT.CRITICAL }],
            [{ text: KEYBOARD_BUTTON_TEXT.CANCEL }]
        ],
        resize_keyboard: true,
        one_time_keyboard: false
    };
};

/**
 * Inline-клавиатура шага /return_sim: выбор типа повреждения.
 */
export const getReturnSimDamageTypeInlineKeyboard = (): TelegramBot.InlineKeyboardMarkup => {
    return {
        inline_keyboard: [
            [{ text: KEYBOARD_BUTTON_TEXT.WEAK, callback_data: INLINE_CALLBACK_DATA.RETURN_DAMAGE_WEAK }],
            [{ text: KEYBOARD_BUTTON_TEXT.CRITICAL, callback_data: INLINE_CALLBACK_DATA.RETURN_DAMAGE_CRITICAL }]
        ]
    };
};
