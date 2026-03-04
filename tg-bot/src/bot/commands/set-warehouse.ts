import TelegramBot from 'node-telegram-bot-api';
import { CourierService } from '../../services/courier.service';
import { WarehouseService } from '../../services/warehouse.service';
import { getUserState, setUserState, resetUserState, getUserTempData, setUserTempData, resetUserTempData } from '../middlewares/user-state';
import { WarehouseState } from '../../constants/states.constant';
import { Warehouse } from '../../repositories/types/warehouse.type';

/**
 * Команда /set_warehouse
 * Курьер выбирает склад по порядковому номеру
 */
export function registerSetWarehouseCommand(
    bot: TelegramBot,
    courierService: CourierService,
    warehouseService: WarehouseService
) {
    // Шаг 1: обработка команды /set_warehouse
    bot.onText(/\/set_warehouse/, async (msg) => {
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

        // Сохраняем временное состояние пользователя
        setUserState(telegramId, WarehouseState.SELECTING_WAREHOUSE);

        // Сохраняем список складов для проверки выбора
        setUserTempData(telegramId, warehouses);
    });

    // Шаг 2: обработка текстового ввода пользователя при выборе склада
    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        const telegramId = msg.from?.id;
        if (!telegramId) return;

        const state = getUserState(telegramId);
        if (state !== WarehouseState.SELECTING_WAREHOUSE) return;

        const text = msg.text?.trim();
        if (!text || !/^\d+$/.test(text)) {
            await bot.sendMessage(chatId, '❌ Пожалуйста, введите корректный номер склада из списка выше.');
            return;
        }

        const index = parseInt(text, 10) - 1;

        const warehouses = getUserTempData<Warehouse[]>(telegramId);
        if (!warehouses) {
            await bot.sendMessage(chatId, '❌ Произошла ошибка, попробуйте заново командой /set_warehouse.');
            resetUserState(telegramId);
            resetUserTempData(telegramId);
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

        // Сбрасываем состояние и временные данные
        resetUserState(telegramId);
        resetUserTempData(telegramId);
    });
}