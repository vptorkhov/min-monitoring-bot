# Папка keyboards

## Описание

Содержит функции и константы для создания reply- и inline-клавиатур Telegram бота.
Структура декомпозирована по доменам: константы, регистрация, действия курьера, выбор склада, выбор СИМ и возврат СИМ.

## Файлы

### `keyboard.constants.ts`

Константы текстов и callback-идентификаторов:

- `KEYBOARD_BUTTON_TEXT`
- `LEGACY_KEYBOARD_BUTTON_TEXT`
- `INLINE_CALLBACK_DATA`

### `keyboard.utils.ts`

Вспомогательные функции построения рядов кнопок с номерами:

- `buildNumberReplyRows(count)`
- `buildNumberInlineRows(count, callbackPrefix)`

### `registration-flow.keyboard.ts`

Клавиатуры для регистрации:

- `getRegistrationStartKeyboard()`
- `getCancelKeyboard()`

### `courier-actions.keyboard.ts`

Клавиатуры основных действий курьера:

- `getSelectWarehouseKeyboard()`
- `getCourierIdleKeyboard()`
- `getCourierActiveSessionKeyboard()`
- `getCourierMainInlineKeyboard()`

### `warehouse-selection.keyboard.ts`

Клавиатуры шага выбора склада:

- `getWarehouseNumberSelectionKeyboard(warehouseCount)`
- `getWarehouseNumberSelectionInlineKeyboard(warehouseCount)`

### `sim-selection.keyboard.ts`

Клавиатуры шага выбора СИМ:

- `getTakeSimNumberSelectionKeyboard(deviceCount)`
- `getTakeSimNumberSelectionInlineKeyboard(deviceCount)`

### `return-sim.keyboard.ts`

Клавиатуры сценария сдачи СИМ:

- `getReturnSimDamageQuestionKeyboard()`
- `getReturnSimDamageQuestionInlineKeyboard()`
- `getReturnSimDamageTypeKeyboard()`
- `getReturnSimDamageTypeInlineKeyboard()`

### `index.ts`

Barrel-файл для экспортов из всех keyboard-модулей.

### `courier-main-keyboard.ts`

Общий резолвер главной клавиатуры курьера:

- **`resolveCourierMainKeyboard()`**
    - Определяет подходящую клавиатуру по состоянию курьера в БД
    - Варианты:
        - `🏠 Выбрать склад`, если склад не выбран
        - `🚲 Взять СИМ` / `🏠 Выбрать склад` / `❌🏠 Отвязаться от склада`, если склад выбран и нет активной сессии
        - `🚲❌ Сдать СИМ`, если есть активная сессия
- **`sendCourierMainKeyboard()`**
    - Отправляет в чат текст и соответствующую reply-клавиатуру
    - Используется как единая точка восстановления клавиатуры после отмены и завершения сценариев

## Использование

```typescript
import {
	getRegistrationStartKeyboard,
	getCancelKeyboard,
	getWarehouseNumberSelectionKeyboard,
} from "../keyboards";

// Отправка сообщения с клавиатурой
await bot.sendMessage(chatId, "Введите имя:", {
	reply_markup: getCancelKeyboard(),
});

await bot.sendMessage(chatId, "Выберите номер склада:", {
	reply_markup: getWarehouseNumberSelectionKeyboard(3),
});
```

## Особенности

- **Reply keyboard** - встроенная клавиатура, которая появляется вместо стандартной клавиатуры устройства
- **one_time_keyboard** - клавиатура исчезает после нажатия на кнопку
- **resize_keyboard** - клавиатура адаптируется к размеру экрана

## Обработка текста кнопок

Текст из кнопок обрабатывается через **перехват текста** (text interception), а не как команды:

1. Пользователь нажимает кнопку (например, `❌ Отмена`)
2. Текст кнопки отправляется как обычное сообщение
3. Сообщение проходит через `registration.handler.ts`
4. Обработчик проверяет текущее состояние пользователя (`stateManager.getUserState()`)
5. В зависимости от состояния текст обрабатывается нужным способом (валидация имени, номера и т.д.)

Этот подход позволяет:

- Контролировать, какой текст может быть введён на каждом этапе
- Игнорировать некорректный ввод
- Валидировать данные перед сохранением в БД

Также используется преобразование текста кнопок в команды через `convertKeyboardButtonToCommand()`:

- `🚲 Взять СИМ` → `/take_sim`
- `🏠 Выбрать склад` → `/set_warehouse`
- `❌🏠 Отвязаться от склада` → `/clear_warehouse`
- `🚲❌ Сдать СИМ` → `/return_sim`
- Для обратной совместимости поддерживается старый текст `🏠Выбрать склад` (без пробела)

Для inline-кнопок используется `callback_query` с `callback_data` из `INLINE_CALLBACK_DATA`.
При нажатии соответствующие обработчики запускают тот же flow, что и команды `/take_sim`, `/set_warehouse`, `/clear_warehouse`, без отправки в чат служебных сообщений вида `/command`.
Маршрутизация inline-callback выполняется централизованно через `src/bot/callback-router.ts`.

## Архитектура

Клавиатуры используются в:

- `registration.handler.ts` - обработчик регистрации
- `activation-notifier.service.ts` - сообщение об активации и кнопка `🏠 Выбрать склад`
- `set-warehouse.ts` - выбор склада через inline-клавиатуру `1..N` и reply-клавиатуру `1..N` + `❌ Отмена`
- `take-sim.ts` - выбор СИМ через reply-клавиатуру `❌ Отмена` + `1..N`
- `return-sim.ts` - этап вопроса о повреждениях через inline-кнопки `Нет` / `Да`
- `return-sim.ts` - этап выбора типа повреждения через reply `Слабое` / `Критическое` / `❌ Отмена` и inline `Слабое` / `Критическое`
- `set-warehouse.ts` - показ inline-клавиатуры действий после успешного выбора склада
- `start.ts` и `return-sim.ts` - показ основной клавиатуры курьера при подходящем состоянии
- `start.ts`, `take-sim.ts` и `return-sim.ts` - показ клавиатуры `🚲❌ Сдать СИМ` при активной сессии
- `cancel.ts` и `clear-warehouse.ts` - восстановление главной клавиатуры через `sendCourierMainKeyboard()`
