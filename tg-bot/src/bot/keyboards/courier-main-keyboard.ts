import TelegramBot from 'node-telegram-bot-api';
import { CourierService } from '../../services/courier.service';
import { SessionService } from '../../services/session.service';
import {
    getCourierIdleKeyboard,
    getSelectWarehouseKeyboard
} from './registration.keyboard';

const HIDE_REPLY_KEYBOARD: TelegramBot.ReplyKeyboardRemove = {
    remove_keyboard: true
};

type CourierMainKeyboardReplyMarkup =
    | TelegramBot.ReplyKeyboardMarkup
    | TelegramBot.ReplyKeyboardRemove;

interface CourierMainKeyboardPayload {
    text: string;
    replyMarkup: CourierMainKeyboardReplyMarkup;
}

/**
 * Возвращает основную клавиатуру курьера по текущему состоянию из БД.
 * Если пользователь не курьер или не активирован, возвращает null.
 */
export async function resolveCourierMainKeyboard(
    telegramId: number,
    courierService: CourierService,
    sessionService: SessionService
): Promise<CourierMainKeyboardPayload | null> {
    const check = await courierService.checkCourierExists(telegramId);
    if (!check.exists || !check.isActive || !check.courier) {
        return null;
    }

    const hasSession = await sessionService.hasActiveSession(telegramId);
    if (hasSession) {
        return {
            text: 'У вас активная сессия. Используйте /return_sim для завершения.',
            replyMarkup: HIDE_REPLY_KEYBOARD
        };
    }

    if (!check.courier.warehouse_id) {
        return {
            text: 'Пожалуйста, выберите склад:',
            replyMarkup: getSelectWarehouseKeyboard()
        };
    }

    return {
        text: 'Выберите действие:',
        replyMarkup: getCourierIdleKeyboard()
    };
}

/**
 * Отправляет пользователю основную клавиатуру, подходящую под его состояние.
 * Возвращает false, если клавиатура не была отправлена.
 */
export async function sendCourierMainKeyboard(
    bot: TelegramBot,
    chatId: number,
    telegramId: number,
    courierService: CourierService,
    sessionService: SessionService
): Promise<boolean> {
    const payload = await resolveCourierMainKeyboard(telegramId, courierService, sessionService);
    if (!payload) {
        return false;
    }

    await bot.sendMessage(chatId, payload.text, {
        reply_markup: payload.replyMarkup
    });

    return true;
}
