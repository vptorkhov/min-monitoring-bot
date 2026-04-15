// src/bot/middlewares/registration-state.middleware.ts

import TelegramBot from 'node-telegram-bot-api';
import { RegistrationHandler } from '../handlers/registration.handler';
import { isCommand } from '../../constants/commands.constant';
import { GENERIC_ERROR_MESSAGE } from '../../constants/messages.constant';
import { convertKeyboardButtonToCommand } from '../../utils/telegram.utils';

const MESSAGE_DEBOUNCE_MS = 800;

type LastUserMessage = {
    text: string;
    timestampMs: number;
};

const lastUserMessageById = new Map<number, LastUserMessage>();

function normalizeMessageText(text?: string): string | undefined {
    if (!text) {
        return undefined;
    }

    return convertKeyboardButtonToCommand(text);
}

function isDuplicateMessage(userId: number, text: string, nowMs: number): boolean {
    const previous = lastUserMessageById.get(userId);
    if (!previous) {
        lastUserMessageById.set(userId, { text, timestampMs: nowMs });
        return false;
    }

    const isSameText = previous.text === text;
    const isInDebounceWindow = nowMs - previous.timestampMs <= MESSAGE_DEBOUNCE_MS;

    lastUserMessageById.set(userId, { text, timestampMs: nowMs });
    return isSameText && isInDebounceWindow;
}

/** Создает middleware регистрации с проверкой команд и защитой от дублей. */
export function createRegistrationStateMiddleware(
    bot: TelegramBot,
    registrationHandler: RegistrationHandler
) {
    /** Обрабатывает входящее сообщение в контексте регистрации. */
    return async function registrationStateMiddleware(
        msg: TelegramBot.Message
    ) {
        if (!msg.from) {
            return;
        }

        const userId = msg.from.id;
        const text = normalizeMessageText(msg.text);
        const isInRegistration = registrationHandler.isUserInRegistration(userId);
        if (!isInRegistration) {
            return;
        }

        if (text && isCommand(text)) {
            console.log(
                `Команда ${text} от пользователя ${userId} ` +
                'пропущена к обработчикам (приоритет над регистрацией)'
            );
            return;
        }

        if (text && isDuplicateMessage(userId, text, Date.now())) {
            console.log(`Пропущено дублирующее сообщение от пользователя ${userId}`);
            return;
        }

        try {
            await registrationHandler.handleMessage(msg);
        } catch (error) {
            console.error('Ошибка middleware регистрации:', error);
            await bot.sendMessage(msg.chat.id, GENERIC_ERROR_MESSAGE);
        }
    };
}

/** Регистрирует middleware регистрации для входящих сообщений. */
export function setupRegistrationMiddleware(
    bot: TelegramBot,
    registrationHandler: RegistrationHandler
) {
    const middleware = createRegistrationStateMiddleware(bot, registrationHandler);
    bot.on('message', middleware);

    console.log('✅ Middleware регистрации настроен');
}