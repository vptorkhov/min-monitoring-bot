import TelegramBot from 'node-telegram-bot-api';
import { checkUserRegistration } from './registration';
import { userStateManager } from '../../utils/userState';
import { Keyboards } from '../keyboards';

export async function handleStart(bot: TelegramBot, msg: TelegramBot.Message) {
    const chatId = msg.chat.id;
    const user = msg.from;

    if (!user) {
        await bot.sendMessage(chatId, '❌ Не удалось получить информацию о пользователе.');
        return;
    }

    console.log(`🎯 Команда /start от ${user.first_name || 'пользователь'} (ID: ${user.id}, Username: ${user.username || 'нет'})`);

    // Проверяем, зарегистрирован ли пользователь
    const isRegistered = await checkUserRegistration(user);

    if (isRegistered) {
        // В случае если пользователь уже зарегистрирован:
        const welcomeText = `👋 С возвращением, ${user.first_name || 'друг'}!\n\n` +
            `Вы уже зарегистрированы как курьер.\n` +
            `Используйте кнопки ниже для работы:`;

        await bot.sendMessage(chatId, welcomeText, Keyboards.courierKeyboard);
        return;
    }

    // Если не зарегистрирован, начинаем процесс регистрации
    const welcomeText = `Привет, ${user.first_name || 'друг'}! 👋\n\n` +
        `Это бот для мониторинга Средств Индивидуальной Мобильности (СИМ).\n\n` +
        `Для начала работы вам нужно зарегистрироваться как курьер.`;

    const registerText = `📝 *Регистрация курьера*\n\n` +
        `Пожалуйста, введите свое *ФИО* (полностью, например: Иванов Иван Иванович):`;

    // Отправляем приветственное сообщение с кнопкой
    await bot.sendMessage(chatId, welcomeText, Keyboards.start);
    await bot.sendMessage(chatId, registerText, {
        parse_mode: 'Markdown',
        ...Keyboards.helpOnly
    });

    // Через секунду отправляем запрос ФИО
    setTimeout(async () => {
        await bot.sendMessage(chatId, registerText, {
            parse_mode: 'Markdown',
            reply_markup: Keyboards.helpOnly.reply_markup
        });
        // Устанавливаем состояние для пользователя
        userStateManager.set(chatId, {
            step: 'awaiting_name',
            telegramUser: user
        });
    }, 1000);
}