import TelegramBot from 'node-telegram-bot-api';
import { INLINE_CALLBACK_DATA, KEYBOARD_BUTTON_TEXT } from './keyboard.constants';

/**
 * Клавиатура для выбора склада после активации.
 */
export const getSelectWarehouseKeyboard = (): TelegramBot.ReplyKeyboardMarkup => {
    return {
        keyboard: [[{ text: KEYBOARD_BUTTON_TEXT.SELECT_WAREHOUSE }]],
        resize_keyboard: true,
        one_time_keyboard: false
    };
};

/**
 * Основная клавиатура активного курьера без активной сессии.
 */
export const getCourierIdleKeyboard = (): TelegramBot.ReplyKeyboardMarkup => {
    return {
        keyboard: [
            [{ text: KEYBOARD_BUTTON_TEXT.TAKE_SIM }],
            [{ text: KEYBOARD_BUTTON_TEXT.SELECT_WAREHOUSE }],
            [{ text: KEYBOARD_BUTTON_TEXT.CLEAR_WAREHOUSE }]
        ],
        resize_keyboard: true,
        one_time_keyboard: false
    };
};

/**
 * Клавиатура активного курьера с начатой сессией.
 */
export const getCourierActiveSessionKeyboard = (): TelegramBot.ReplyKeyboardMarkup => {
    return {
        keyboard: [[{ text: KEYBOARD_BUTTON_TEXT.RETURN_SIM }]],
        resize_keyboard: true,
        one_time_keyboard: false
    };
};

/**
 * Inline-клавиатура быстрых действий курьера.
 */
export const getCourierMainInlineKeyboard = (): TelegramBot.InlineKeyboardMarkup => {
    return {
        inline_keyboard: [
            [{ text: KEYBOARD_BUTTON_TEXT.TAKE_SIM, callback_data: INLINE_CALLBACK_DATA.TAKE_SIM }],
            [{ text: KEYBOARD_BUTTON_TEXT.SELECT_WAREHOUSE, callback_data: INLINE_CALLBACK_DATA.SET_WAREHOUSE }],
            [{ text: KEYBOARD_BUTTON_TEXT.CLEAR_WAREHOUSE, callback_data: INLINE_CALLBACK_DATA.CLEAR_WAREHOUSE }]
        ]
    };
};
