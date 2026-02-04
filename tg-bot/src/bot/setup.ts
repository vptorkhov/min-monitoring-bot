import TelegramBot from 'node-telegram-bot-api';
import {
    handleStart,
    handleHelp,
    handleMyInfo,
    handleRegistrationMessage
} from './handlers';
import {
    handleAdmin,
    handleAdminRegistrationMessage,
    handleCancel,
    adminStateManager
} from './handlers/admin';
import {
    handleAddDevice,
    handleAddDeviceButton,
    handleAddDeviceMessage,
    handleListDevices,
    addDeviceStateManager
} from './handlers/admin-devices';
import { userStateManager } from '../utils/userState';
import { Keyboards } from './keyboards';
import { deviceManagementStateManager, handleDeviceManagementMessage, handleManageDevices, handleManageDevicesButton } from './handlers/admin-device-management';
import { handleViewCouriers, handleViewCouriersButton } from './handlers/admin-couriers';
import { courierManagementStateManager, handleCourierManagementMessage, handleManageCouriers, handleManageCouriersButton } from './handlers/admin-courier-management';
import { handleActiveSessions, handleActiveSessionsButton } from './handlers/admin-sessions';
import { handleSessionHistory, handleSessionHistoryButton, handleSessionHistoryMessage, sessionHistoryStateManager } from './handlers/admin-session-history';
import { handleTakeDevice, handleTakeDeviceButton, handleTakeDeviceMessage, takeDeviceStateManager } from './handlers/user-take-device';
import { handleEndSession } from './handlers/user-end-session';

export function setupBotHandlers(bot: TelegramBot) {
    console.log('🔧 Настройка обработчиков бота...');

    // Регистрация обработчиков команд
    bot.onText(/\/start|СТАРТ/, (msg) => handleStart(bot, msg));
    bot.onText(/\/help|Помощь/, (msg) => handleHelp(bot, msg));
    bot.onText(/\/myinfo/, (msg) => handleMyInfo(bot, msg));
    bot.onText(/\/admin/, (msg) => handleAdmin(bot, msg));
    bot.onText(/\/cancel/, (msg) => handleCancel(bot, msg));
    bot.onText(/\/takedevice/, (msg) => handleTakeDevice(bot, msg));
    bot.onText(/\/endsession/, (msg) => handleEndSession(bot, msg));

    // Команды администратора
    bot.onText(/\/adddevice/, (msg) => handleAddDevice(bot, msg));
    bot.onText(/\/devices/, (msg) => handleListDevices(bot, msg));
    bot.onText(/\/couriers/, (msg) => handleViewCouriers(bot, msg));
    bot.onText(/\/managedevices/, (msg) => handleManageDevices(bot, msg));
    bot.onText(/\/managecouriers/, (msg) => handleManageCouriers(bot, msg));
    bot.onText(/\/activesessions/, (msg) => handleActiveSessions(bot, msg));
    bot.onText(/\/sessionhistory/, (msg) => handleSessionHistory(bot, msg));

    // Обработчик текстовых сообщений
    // В обработчике сообщений в setup.ts, добавьте больше логирования:
    bot.on('message', async (msg) => {
        const text = msg.text || '';
        const user = msg.from;

        if (!user) {
            return;
        }

        console.log(`📨 Получено сообщение от ${user.id}: "${text}"`);

        // Обработка кнопок с логированием
        if (text === '🛴 Добавить СИМ') {
            console.log(`🔄 Обработка кнопки "Добавить СИМ" для ${user.id}`);
            await handleAddDeviceButton(bot, msg);
            return;
        }

        if (text === '📋 Все СИМ') {
            console.log(`🔄 Обработка кнопки "Все СИМ" для ${user.id}`);
            await handleListDevices(bot, msg);
            return;
        }

        if (text === '🛠️ Управление СИМ') {
            console.log(`🔄 Обработка кнопки "Управление СИМ" для ${user.id}`);
            await handleManageDevicesButton(bot, msg);
            return;
        }

        if (text === '👥 Курьеры') {
            await handleViewCouriersButton(bot, msg);
            return;
        }

        if (text === '⚙️ Админ-панель') {
            console.log(`🔄 Обработка кнопки "Админ-панель" для ${user.id}`);
            await handleAdmin(bot, msg);
            return;
        }

        if (text === '👥 Управление курьерами') {
            console.log(`🔄 Обработка кнопки "Управление курьерами" для ${user.id}`);
            await handleManageCouriersButton(bot, msg);
            return;
        }

        if (text === '📅 Активные сессии') {
            console.log(`🔄 Обработка кнопки "Активные сессии" для ${user.id}`);
            await handleActiveSessionsButton(bot, msg);
            return;
        }
        if (text === '📅 История сессий') {
            console.log(`🔄 Обработка кнопки "История сессий" для ${user.id}`);
            await handleSessionHistoryButton(bot, msg);
            return;
        }

        if (text === '🛴 Хочу взять СИМ') {
            console.log(`🔄 Обработка кнопки "Хочу взять СИМ" для ${user.id}`);
            await handleTakeDeviceButton(bot, msg);
            return;
        }

        if (msg.text === '⏹️ Завершить сессию') {
            await handleEndSession(bot, msg);
            return;
        }

        if (text === '✅ Свободные СИМ') {
            // TODO: добавим просмотр свободных средств для пользователей
            await bot.sendMessage(msg.chat.id, '✅ Функция просмотра свободных средств будет добавлена позже.');
            return;
        }

        // Пропускаем команды, начинающиеся с /
        if (text.startsWith('/')) {
            console.log(`ℹ️ Пропуск команды: "${text}"`);
            return;
        }

        // Проверяем, в каком состоянии находится пользователь
        const adminState = adminStateManager.get(user.id);
        const deviceState = addDeviceStateManager.get(user.id);
        const deviceManagementState = deviceManagementStateManager.get(user.id);
        const userState = userStateManager.get(msg.chat.id);
        const courierManagementState = courierManagementStateManager.get(user.id);
        const sessionHistoryState = sessionHistoryStateManager.get(user.id);

        const takeDeviceState = takeDeviceStateManager.get(msg.chat.id);

        console.log(`🔍 Состояния для ${user.id}:`, {
            adminState: !!adminState,
            deviceState: !!deviceState,
            deviceManagementState: !!deviceManagementState,
            courierManagementState: !!courierManagementState,
            sessionHistoryState: !!sessionHistoryState,
            takeDeviceState: !!takeDeviceState,
            userState: !!userState
        });


        // Приоритет обработки:
        if (adminState) {
            console.log(`🔄 Обработка как регистрация администратора`);
            await handleAdminRegistrationMessage(bot, msg);
        } else if (deviceState) {
            console.log(`🔄 Обработка как добавление СИМ, шаг: ${deviceState.step}`);
            await handleAddDeviceMessage(bot, msg);
        } else if (deviceManagementState) {
            console.log(`🔄 Обработка как управление СИМ, шаг: ${deviceManagementState.step}`);
            await handleDeviceManagementMessage(bot, msg);
        } else if (courierManagementState) {
            console.log(`🔄 Обработка как управление курьерами, шаг: ${courierManagementState.step}`);
            await handleCourierManagementMessage(bot, msg);
        } else if (sessionHistoryState) {
            console.log(`🔄 Обработка как история сессий, шаг: ${sessionHistoryState.step}`);
            await handleSessionHistoryMessage(bot, msg);
        } else if (takeDeviceState) {
            console.log(`🔄 Обработка как взятие СИМ, шаг: ${takeDeviceState.step}`);
            await handleTakeDeviceMessage(bot, msg);
        } else if (userState) {
            console.log(`🔄 Обработка как регистрация курьера`);
            await handleRegistrationMessage(bot, msg);
        } else {
            console.log(`ℹ️ Нет активного состояния для ${user.id}, текст: "${text}"`);
            // Простое сообщение - только если это не пустое сообщение
            if (text.trim().length > 0 && !text.startsWith('/')) {
                console.log(`📤 Отправка сообщения "Не понимаю" для ${user.id}`);
                await bot.sendMessage(
                    msg.chat.id,
                    'Я не понимаю эту команду. Используйте /help для списка доступных команд.',
                    Keyboards.start
                );
            }
        }
    });

    // Простая тестовая команда
    bot.onText(/\/test/, (msg) => {
        const chatId = msg.chat.id;
        bot.sendMessage(chatId, '✅ Бот работает корректно!', {
            reply_markup: {
                inline_keyboard: [[
                    { text: '🚀 Начать регистрацию', callback_data: 'start_registration' }
                ]]
            }
        });
    });

    // Обработчик callback кнопок
    bot.on('callback_query', async (callbackQuery) => {
        const msg = callbackQuery.message;
        const data = callbackQuery.data;

        if (msg && data === 'start_registration') {
            await bot.answerCallbackQuery(callbackQuery.id);
            await bot.sendMessage(msg.chat.id, 'Начинаем регистрацию... Используйте /start или нажмите "СТАРТ"');
        }
    });

    // Обработчик входящих inline-запросов
    bot.on('inline_query', (query) => {
        console.log('📥 Inline query received:', query.query);
    });

    console.log('✅ Обработчики бота настроены');
}