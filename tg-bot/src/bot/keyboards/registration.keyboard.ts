// src/bot/keyboards/registration.keyboard.ts

import TelegramBot from 'node-telegram-bot-api';

// Константы текста кнопок
export const KEYBOARD_BUTTON_TEXT = {
    START: '✔️ Старт',
    CANCEL: '❌ Отмена',
    SELECT_WAREHOUSE: '🏠Выбрать склад'
} as const;

/**
 * Клавиатура для начала регистрации
 * Содержит кнопку ✔️ Старт
 */
export const getRegistrationStartKeyboard = (): TelegramBot.ReplyKeyboardMarkup => {
    return {
        keyboard: [
            [{ text: KEYBOARD_BUTTON_TEXT.START }]
        ],
        resize_keyboard: true,
        one_time_keyboard: true
    };
};

/**
 * Клавиатура для отмены (используется при вводе имени/телефона)
 * Содержит кнопку ❌ Отмена
 */
export const getCancelKeyboard = (): TelegramBot.ReplyKeyboardMarkup => {
    return {
        keyboard: [
            [{ text: KEYBOARD_BUTTON_TEXT.CANCEL }]
        ],
        resize_keyboard: true,
        one_time_keyboard: true
    };
};

/**
 * Клавиатура для выбора склада после активации
 * Содержит кнопку 🏠 Выбрать склад
 */
export const getSelectWarehouseKeyboard = (): TelegramBot.ReplyKeyboardMarkup => {
    return {
        keyboard: [
            [{ text: KEYBOARD_BUTTON_TEXT.SELECT_WAREHOUSE }]
        ],
        resize_keyboard: true,
        one_time_keyboard: false
    };
};
