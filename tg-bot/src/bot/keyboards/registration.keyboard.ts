// src/bot/keyboards/registration.keyboard.ts

import TelegramBot from 'node-telegram-bot-api';

// Константы текста кнопок
export const KEYBOARD_BUTTON_TEXT = {
    START: '✔️ Старт',
    CANCEL: '❌ Отмена',
    SELECT_WAREHOUSE: '🏠 Выбрать склад',
    TAKE_SIM: '🚲 Взять СИМ',
    CLEAR_WAREHOUSE: '❌🏠 Отвязаться от склада'
} as const;

// Исторический текст кнопки выбора склада (без пробела).
export const LEGACY_KEYBOARD_BUTTON_TEXT = {
    SELECT_WAREHOUSE: '🏠Выбрать склад'
} as const;

// Callback data для inline-кнопок действий курьера.
export const INLINE_CALLBACK_DATA = {
    TAKE_SIM: 'take_sim',
    SET_WAREHOUSE: 'set_warehouse',
    CLEAR_WAREHOUSE: 'clear_warehouse',
    TAKE_SIM_SELECT_PREFIX: 'take_sim_select_'
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
 * Inline-клавиатура действий активного курьера.
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

/**
 * Reply-клавиатура выбора СИМ по номеру в /take_sim.
 * Порядок кнопок: сначала отмена, затем номера 1..N.
 */
export const getTakeSimNumberSelectionKeyboard = (
    deviceCount: number
): TelegramBot.ReplyKeyboardMarkup => {
    const numberButtons: TelegramBot.KeyboardButton[] = Array.from(
        { length: deviceCount },
        (_, index) => ({ text: String(index + 1) })
    );

    const chunkSize = 5;
    const rows: TelegramBot.KeyboardButton[][] = [];
    for (let i = 0; i < numberButtons.length; i += chunkSize) {
        rows.push(numberButtons.slice(i, i + chunkSize));
    }

    return {
        keyboard: [
            [{ text: KEYBOARD_BUTTON_TEXT.CANCEL }],
            ...rows
        ],
        resize_keyboard: true,
        one_time_keyboard: false
    };
};

/**
 * Inline-клавиатура выбора СИМ по номеру в /take_sim.
 * Содержит кнопки 1..N (по количеству СИМ в списке).
 */
export const getTakeSimNumberSelectionInlineKeyboard = (
    deviceCount: number
): TelegramBot.InlineKeyboardMarkup => {
    const buttons: TelegramBot.InlineKeyboardButton[] = Array.from(
        { length: deviceCount },
        (_, index) => ({
            text: String(index + 1),
            callback_data: `${INLINE_CALLBACK_DATA.TAKE_SIM_SELECT_PREFIX}${index + 1}`
        })
    );

    const chunkSize = 5;
    const rows: TelegramBot.InlineKeyboardButton[][] = [];
    for (let i = 0; i < buttons.length; i += chunkSize) {
        rows.push(buttons.slice(i, i + chunkSize));
    }

    return {
        inline_keyboard: rows
    };
};
