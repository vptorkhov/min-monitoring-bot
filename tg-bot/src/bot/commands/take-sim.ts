// src/bot/commands/take-sim.ts

import TelegramBot from 'node-telegram-bot-api';
import { CourierService } from '../../services/courier.service';
import { SessionService } from '../../services/session.service';
import { MobilityDeviceRepository, MobilityDevice } from '../../repositories/mobility-device.repository';
import { stateManager } from '../state-manager';
import { DeviceSessionState } from '../../constants/states.constant';
import { isCommand } from '../../constants/commands.constant';
import { convertKeyboardButtonToCommand } from '../../utils/telegram.utils';
import { INLINE_CALLBACK_DATA } from '../keyboards/registration.keyboard';

const HIDE_REPLY_KEYBOARD: TelegramBot.ReplyKeyboardRemove = {
    remove_keyboard: true
};

/**
 * Команда /take_sim — курьер выбирает устройство из списка и начинает сессию.
 */
export function registerTakeSimCommand(
    bot: TelegramBot,
    courierService: CourierService,
    sessionService: SessionService,
    deviceRepo: MobilityDeviceRepository
) {
    const startTakeSimFlow = async (chatId: number, telegramId: number) => {
        // проверки регистрации/активности
        const check = await courierService.checkCourierExists(telegramId);
        if (!check.exists) {
            await bot.sendMessage(chatId, '❌ Вы не зарегистрированы. Используйте /start для регистрации.');
            return;
        }
        if (!check.isActive) {
            await bot.sendMessage(chatId, '❌ Ваша регистрация еще не подтверждена администратором.');
            return;
        }

        // запрет, если уже есть активная сессия
        const has = await sessionService.hasActiveSession(telegramId);
        if (has) {
            await bot.sendMessage(chatId, '❌ У вас уже есть активная сессия. Сначала сдайте текущий СИМ.');
            return;
        }

        // склад должен быть назначен
        const courier = check.courier!;
        if (!courier.warehouse_id) {
            await bot.sendMessage(chatId, '❌ Сначала выберите склад командой /set_warehouse.');
            return;
        }

        // получаем доступные устройства
        const devices: MobilityDevice[] = await deviceRepo.getAvailableDevices(courier.warehouse_id, null);
        if (!devices.length) {
            await bot.sendMessage(chatId, '❌ Нет доступных СИМ на вашем складе.');
            return;
        }

        // формируем список для пользователя
        const lines = devices.map((d, idx) => {
            const label = d.is_personal ? 'Личный' : (d.device_number || 'без номера');
            return `${idx + 1}. ${label}`;
        });
        const text = 'Введите порядковый номер из списка:\n' + lines.join('\n');
        await bot.sendMessage(chatId, text, {
            reply_markup: HIDE_REPLY_KEYBOARD
        });

        // сохраняем состояние и список устройств
        stateManager.setUserState(telegramId, DeviceSessionState.TAKE_DEVICE_SELECT);
        stateManager.setUserTempData(telegramId, { devices });
    };

    // Шаг 1: обработка команды
    bot.onText(/\/take_sim/, async (msg) => {
        const chatId = msg.chat.id;
        const telegramId = msg.from?.id;
        if (!telegramId) return;

        await startTakeSimFlow(chatId, telegramId);
    });

    // Запуск потока по inline-кнопке "🚲 Взять СИМ"
    bot.on('callback_query', async (query) => {
        if (query.data !== INLINE_CALLBACK_DATA.TAKE_SIM) {
            return;
        }

        const chatId = query.message?.chat.id;
        const telegramId = query.from.id;
        if (!chatId) {
            return;
        }

        await bot.sendMessage(chatId, '/take_sim');
        await startTakeSimFlow(chatId, telegramId);
    });

    // Шаг 2: обработка простого текста после списка
    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        const telegramId = msg.from?.id;
        if (!telegramId) return;

        const text = msg.text?.trim();
        const textAsCommand = text ? convertKeyboardButtonToCommand(text) : '';
        if (textAsCommand === '/take_sim' && text !== '/take_sim') {
            await startTakeSimFlow(chatId, telegramId);
            return;
        }

        const state = stateManager.getUserState(telegramId);
        if (state !== DeviceSessionState.TAKE_DEVICE_SELECT) return;

        if (!text || isCommand(text)) {
            return; // команды игнорируем здесь
        }

        if (!/^[0-9]+$/.test(text)) {
            await bot.sendMessage(chatId, '❌ Пожалуйста, введите номер из списка.');
            return;
        }

        const idx = parseInt(text, 10) - 1;
        const temp = stateManager.getUserTempData<{ devices: MobilityDevice[] }>(telegramId);
        const devices = temp?.devices;
        if (!devices) {
            await bot.sendMessage(chatId, '❌ Произошла ошибка, попробуйте заново командой /take_sim.');
            stateManager.clearUser(telegramId);
            return;
        }

        if (idx < 0 || idx >= devices.length) {
            await bot.sendMessage(chatId, '❌ Номер вне диапазона, попробуйте снова.');
            return;
        }

        const device = devices[idx];
        // создаём сессию
        const startResult = await sessionService.startSession(telegramId, device.id);
        if (!startResult.success) {
            await bot.sendMessage(chatId, `❌ Не удалось взять СИМ: ${startResult.error}`);
            // остаёмся в состоянии, чтобы пользователь мог выбрать другой
            return;
        }

        const label = device.is_personal ? 'Личный' : device.device_number || 'без номера';
        await bot.sendMessage(chatId, `✅ СИМ (${label}) взят.`);

        stateManager.clearUser(telegramId);
    });
}
