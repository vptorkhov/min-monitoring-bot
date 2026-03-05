import TelegramBot from 'node-telegram-bot-api';
import { CourierService } from '../../services/courier.service';
import { SessionService } from '../../services/session.service';

/**
 * Команда /clear_warehouse
 * Курьер отвязывается от всех складов
 */
export function registerClearWarehouseCommand(
    bot: TelegramBot,
    courierService: CourierService
) {
    bot.onText(/\/clear_warehouse/, async (msg) => {
        const chatId = msg.chat.id;
        const telegramId = msg.from?.id;
        if (!telegramId) return;

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
        const sessionService = new SessionService();
        const hasSession = await sessionService.hasActiveSession(telegramId);
        if (hasSession) {
            await bot.sendMessage(chatId, '❌ У вас есть активная сессия. Сначала сдайте СИМ.');
            return;
        }

        // Отвязываем курьера от склада
        const result = await courierService.clearWarehouse(telegramId);
        if (!result.success) {
            await bot.sendMessage(chatId, `❌ Не удалось отвязаться от склада: ${result.message}`);
        } else {
            await bot.sendMessage(chatId, '✅ Вы успешно отвязались от склада.');
        }
    });
}
