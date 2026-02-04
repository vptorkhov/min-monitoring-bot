import TelegramBot from 'node-telegram-bot-api';

// Вспомогательная функция для создания reply_markup
export const createReplyKeyboard = (keyboard: TelegramBot.ReplyKeyboardMarkup) => ({
    reply_markup: keyboard
});

export const Keyboards = {
    // Стартовая клавиатура
    start: createReplyKeyboard({
        keyboard: [
            [{ text: '🚀 СТАРТ' }],
            [{ text: '❓ Помощь' }, { text: 'ℹ️ Информация' }]
        ],
        resize_keyboard: true,
        one_time_keyboard: false
    }),
    courierKeyboard: createReplyKeyboard({
        keyboard: [
            [{ text: '🛴 Хочу взять СИМ' }, { text: '✅ Свободные средства' }],
            [{ text: '⏹️ Завершить сессию' }, { text: '📱 Мой профиль' }],
            [{ text: '❓ Помощь' }, { text: '🏠 Главная' }]
        ],
        resize_keyboard: true
    }),

    afterTakeDevice: createReplyKeyboard({
        keyboard: [
            [{ text: '⏹️ Завершить сессию' }, { text: '📱 Мой профиль' }],
            [{ text: '✅ Свободные средства' }, { text: '❓ Помощь' }]
        ],
        resize_keyboard: true
    }),

    // Быстрый доступ после регистрации
    quickAccess: createReplyKeyboard({
        keyboard: [
            [{ text: '🛴 Мои сессии' }, { text: '✅ Свободные средства' }],
            [{ text: '📋 Все средства' }, { text: '⏹️ Завершить сессию' }],
            [{ text: '❓ Помощь' }, { text: '👤 Мой профиль' }]
        ],
        resize_keyboard: true
    }),

    // Клавиатура только с Помощью
    helpOnly: createReplyKeyboard({
        keyboard: [[{ text: '❓ Помощь' }]],
        resize_keyboard: true,
        one_time_keyboard: true
    }),

    // Инлайн кнопка для старта регистрации
    inlineStart: {
        reply_markup: {
            inline_keyboard: [[
                { text: '🚀 Начать регистрацию', callback_data: 'start_registration' }
            ]]
        } as TelegramBot.InlineKeyboardMarkup
    },

    // Клавиатура для администратора
    adminPanel: createReplyKeyboard({
        keyboard: [
            [{ text: '🛴 Добавить СИМ' }, { text: '📋 Все СИМ' }],
            [{ text: '🛠️ Управление СИМ' }, { text: '👥 Курьеры' }],
            [{ text: '👥 Управление курьерами' }, { text: '📅 Активные сессии' }],
            [{ text: '📅 История сессий' }, { text: '📊 Статистика' }]
        ],
        resize_keyboard: true
    }),

    // Клавиатура для управления СИМ
    deviceManagement: createReplyKeyboard({
        keyboard: [
            [{ text: '🛠️ Управление СИМ' }, { text: '📋 Все СИМ' }],
            [{ text: '🛴 Добавить СИМ' }, { text: '⚙️ Админ-панель' }],
            [{ text: '❓ Помощь' }, { text: '🏠 Главная' }]
        ],
        resize_keyboard: true
    }),

    // Клавиатура действий для СИМ
    deviceActions: createReplyKeyboard({
        keyboard: [
            [{ text: '❌ Отключить' }, { text: '🗑️ Удалить' }],
            [{ text: '↩️ Назад' }, { text: '❌ Отмена' }]
        ],
        resize_keyboard: true,
        one_time_keyboard: true
    }),

    // Клавиатура после добавления СИМ
    afterDeviceAdd: createReplyKeyboard({
        keyboard: [
            [{ text: '🛴 Добавить СИМ' }, { text: '📋 Все СИМ' }],
            [{ text: '⚙️ Админ-панель' }, { text: '❓ Помощь' }]
        ],
        resize_keyboard: true
    })
};