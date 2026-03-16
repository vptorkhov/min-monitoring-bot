import TelegramBot from 'node-telegram-bot-api';
import { CourierService } from '../../services/courier.service';
import { SessionService } from '../../services/session.service';
import { CallbackQueryHandler } from '../callback-router';
import { convertKeyboardButtonToCommand } from '../../utils/telegram.utils';
import { sendCourierMainKeyboard } from '../keyboards/courier-main-keyboard';
import { INLINE_CALLBACK_DATA } from '../keyboards';

const HIDE_REPLY_KEYBOARD: TelegramBot.ReplyKeyboardRemove = {
    remove_keyboard: true
};

/**
 * Команда /clear_warehouse
 * Курьер отвязывается от всех складов
 */
export function registerClearWarehouseCommand(
    bot: TelegramBot,
    courierService: CourierService,
    registerCallbackHandler: (handler: CallbackQueryHandler) => void
) {
    const sessionService = new SessionService(courierService);

    const clearWarehouseFlow = async (chatId: number, telegramId: number) => {
        // Проверка курьера
        const check = await courierService.checkCourierExists(telegramId);
        if (!check.exists) {
            await bot.sendMessage(chatId, '❌ Вы не зарегистрированы. Используйте /start для регистрации.');
            return;
        }
        if (!check.isActive) {
            await bot.sendMessage(chatId, '❌ Ваша регистрация еще не подтверждена администратором.');
            return;
        }

        // запрет на отвязку, если есть активная сессия
        const hasSession = await sessionService.hasActiveSession(telegramId);
        if (hasSession) {
            await bot.sendMessage(chatId, '❌ У вас есть активная сессия. Сначала сдайте СИМ.');
            return;
        }

        // Отвязываем курьера от склада
        const result = await courierService.clearWarehouse(telegramId);
        if (!result.success) {
            await bot.sendMessage(chatId, `❌ Не удалось отвязаться от склада: ${result.message}`);
            return;
        }

        await bot.sendMessage(chatId, '✅ Вы успешно отвязались от склада.', {
            reply_markup: HIDE_REPLY_KEYBOARD
        });

        await sendCourierMainKeyboard(bot, chatId, telegramId, courierService, sessionService);
    };

    bot.onText(/^\/clear_warehouse(?:@\w+)?$/, async (msg) => {
        const chatId = msg.chat.id;
        const telegramId = msg.from?.id;
        if (!telegramId) return;

        await clearWarehouseFlow(chatId, telegramId);
    });

    registerCallbackHandler(async (query) => {
        if (query.data !== INLINE_CALLBACK_DATA.CLEAR_WAREHOUSE) {
            return false;
        }

        const chatId = query.message?.chat.id;
        const telegramId = query.from.id;
        if (!chatId) {
            return false;
        }

        await clearWarehouseFlow(chatId, telegramId);
        return true;
    });

    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        const telegramId = msg.from?.id;
        if (!telegramId) return;

        const text = msg.text?.trim();
        const textAsCommand = text ? convertKeyboardButtonToCommand(text) : '';
        if (textAsCommand !== '/clear_warehouse' || text === '/clear_warehouse') {
            return;
        }

        await clearWarehouseFlow(chatId, telegramId);
    });
}
