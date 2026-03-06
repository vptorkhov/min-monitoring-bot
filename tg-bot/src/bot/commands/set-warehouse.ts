import TelegramBot from 'node-telegram-bot-api';
import { CourierService } from '../../services/courier.service';
import { WarehouseService } from '../../services/warehouse.service';
import { SessionService } from '../../services/session.service';
import { stateManager } from '../state-manager';
import { WarehouseState } from '../../constants/states.constant';
import { Warehouse } from '../../repositories/types/warehouse.type';
import { isCommand } from '../../constants/commands.constant';
import { KEYBOARD_BUTTON_TEXT } from '../keyboards/registration.keyboard';

/**
 * Команда /set_warehouse
 * Курьер выбирает склад по порядковому номеру
 */
export function registerSetWarehouseCommand(
    bot: TelegramBot,
    courierService: CourierService,
    warehouseService: WarehouseService
) {
    const startWarehouseSelection = async (chatId: number, telegramId: number) => {
        // Входим в процесс выбора склада заново, если пользователь уже был в нём.
        stateManager.clearUser(telegramId);

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

        // запрет на смену, если есть активная сессия
        const sessionService = new SessionService();
        const hasSession = await sessionService.hasActiveSession(telegramId);
        if (hasSession) {
            await bot.sendMessage(chatId, '❌ У вас есть активная сессия. Сначала сдайте СИМ.');
            return;
        }

        // Получаем список активных складов
        const warehouses: Warehouse[] = await warehouseService.getActiveWarehouses();
        if (!warehouses.length) {
            await bot.sendMessage(chatId, '❌ Нет доступных складов для выбора.');
            return;
        }

        // Формируем нумерованный список складов
        const warehouseList = warehouses
            .map((w, index) => `${index + 1}. ${w.name}, ${w.address}`)
            .join('\n');

        await bot.sendMessage(chatId, `Введите порядковый номер склада для прикрепления:\n\n${warehouseList}`);

        // Сохраняем состояние и список складов пользователя
        stateManager.setUserState(telegramId, WarehouseState.SELECTING_WAREHOUSE);
        stateManager.setUserTempData(telegramId, { warehouses });
    };

    // Шаг 1: обработка команды /set_warehouse
    bot.onText(/\/set_warehouse/, async (msg) => {
        const chatId = msg.chat.id;
        const telegramId = msg.from?.id;
        if (!telegramId) return;

        await startWarehouseSelection(chatId, telegramId);
    });

    // Запуск того же потока при нажатии inline-кнопки "🏠Выбрать склад"
    bot.on('callback_query', async (query) => {
        if (query.data !== 'set_warehouse') {
            return;
        }

        const chatId = query.message?.chat.id;
        const telegramId = query.from.id;

        await bot.answerCallbackQuery(query.id);

        if (!chatId) {
            return;
        }

        await startWarehouseSelection(chatId, telegramId);
    });

    // Шаг 2: обработка текстового ввода пользователя при выборе склада
    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        const telegramId = msg.from?.id;
        if (!telegramId) return;

        const text = msg.text?.trim();

        // Перехват reply-кнопки "🏠Выбрать склад" как эквивалента /set_warehouse
        if (text === KEYBOARD_BUTTON_TEXT.SELECT_WAREHOUSE) {
            await startWarehouseSelection(chatId, telegramId);
            return;
        }

        const state = stateManager.getUserState(telegramId);
        if (state !== WarehouseState.SELECTING_WAREHOUSE) return;

        if (!text || isCommand(text)) {
            return; // любое сообщение, которое является командой, игнорируем здесь
        }

        if (!/^\d+$/.test(text)) {
            await bot.sendMessage(chatId, '❌ Пожалуйста, введите корректный номер склада из списка выше.');
            return;
        }

        const index = parseInt(text, 10) - 1;

        // перед применением снова проверим, не появилась ли активная сессия
        const sessionService = new SessionService();
        const hasSession = await sessionService.hasActiveSession(telegramId);
        if (hasSession) {
            await bot.sendMessage(chatId, '❌ У вас есть активная сессия. Сначала сдайте СИМ.');
            stateManager.clearUser(telegramId);
            return;
        }

        const tempData = stateManager.getUserTempData<{ warehouses: Warehouse[] }>(telegramId);
        const warehouses = tempData?.warehouses;

        if (!warehouses) {
            await bot.sendMessage(chatId, '❌ Произошла ошибка, попробуйте заново командой /set_warehouse.');
            stateManager.clearUser(telegramId);
            return;
        }

        if (index < 0 || index >= warehouses.length) {
            await bot.sendMessage(chatId, '❌ Номер вне диапазона, попробуйте снова.');
            return;
        }

        const selectedWarehouse = warehouses[index];

        // Присоединяем курьера к выбранному складу
        const result = await courierService.assignWarehouse(telegramId, selectedWarehouse.id, warehouseService);
        if (!result.success) {
            await bot.sendMessage(chatId, `❌ Не удалось прикрепиться к складу: ${result.message}`);
        } else {
            await bot.sendMessage(chatId, `✅ Вы успешно прикрепились к складу: ${selectedWarehouse.name}`);
        }

        // Очищаем состояние и данные пользователя
        stateManager.clearUser(telegramId);
    });
}