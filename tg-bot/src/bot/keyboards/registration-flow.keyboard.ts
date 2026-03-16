import TelegramBot from 'node-telegram-bot-api';
import { KEYBOARD_BUTTON_TEXT } from './keyboard.constants';

/**
 * Клавиатура старта регистрации.
 */
export const getRegistrationStartKeyboard = (): TelegramBot.ReplyKeyboardMarkup => {
    return {
        keyboard: [[{ text: KEYBOARD_BUTTON_TEXT.START }]],
        resize_keyboard: true,
        one_time_keyboard: true
    };
};

/**
 * Клавиатура отмены шага регистрации/диалога.
 */
export const getCancelKeyboard = (): TelegramBot.ReplyKeyboardMarkup => {
    return {
        keyboard: [[{ text: KEYBOARD_BUTTON_TEXT.CANCEL }]],
        resize_keyboard: true,
        one_time_keyboard: true
    };
};
