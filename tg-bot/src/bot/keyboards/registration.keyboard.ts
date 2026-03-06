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

/**
 * Клавиатура для выбора склада по номеру
 * Содержит кнопки с номерами и кнопку отмены.
 */
export const getWarehouseNumberSelectionKeyboard = (
    warehouseCount: number
): TelegramBot.ReplyKeyboardMarkup => {
    const numberButtons: TelegramBot.KeyboardButton[] = Array.from(
        { length: warehouseCount },
        (_, index) => ({ text: String(index + 1) })
    );

    const chunkSize = 5;
    const rows: TelegramBot.KeyboardButton[][] = [];
    for (let i = 0; i < numberButtons.length; i += chunkSize) {
        rows.push(numberButtons.slice(i, i + chunkSize));
    }

    return {
        keyboard: [
            ...rows,
            [{ text: KEYBOARD_BUTTON_TEXT.CANCEL }]
        ],
        resize_keyboard: true,
        one_time_keyboard: false
    };
};
