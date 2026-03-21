# Управление состояниями и middleware в Telegram-боте

Этот документ описывает, как в проекте реализован механизм отслеживания
состояний пользователей и взаимодействие с ним через middleware.

---

## 📌 Общая идея

Состояния пользователя (`state`) и временные данные (`tempData`) раньше
хранились в нескольких местах (`Map` и обычные объекты). Это вызывало
путаницу и баги: middleware перехватывал сообщения для процессов, не
связанных с регистрацией, что приводило к неожиданной перезаписи
состояния.

Сейчас весь код использует **единый менеджер состояний** —
`src/bot/state-manager.ts`. Ранее существовавший файл `user-state.ts` был
deprecated и теперь отсутствует: его функции инлайнены в `state-manager`,
поэтому новые модули должны работать напрямую с `stateManager`. Исключение
не требуется.

---

## 🗂️ `StateManager` (src/bot/state-manager.ts)

### Структура хранилища

```ts
interface UserStateData {
  state?: string;
  tempData?: Record<string, any>;
}
```

У каждого пользователя (ключ — `telegramId`) есть:

- строковое `state` (напр. `awaiting_phone`)
- произвольный объект `tempData` для промежуточных данных

Менеджер хранит всё в `Map<number, UserStateData>`.

### Основные методы

| Метод                              | Описание                                   |
| ---------------------------------- | ------------------------------------------ |
| `getUserState(id)`                 | Получить состояние пользователя            |
| `setUserState(id,state)`           | Установить состояние                       |
| `resetUserState(id)`               | Сбросить состояние (но сохранить tempData) |
| `getUserTempData<T>(id)`           | Получить временные данные с типом          |
| `setUserTempData(id,data)`         | Заменить или объединить tempData           |
| `setUserTempDataField(id,key,val)` | Обновить одно поле tempData                |
| `resetUserTempData(id)`            | Сбросить только tempData                   |
| `clearUser(id)`                    | Удалить пользователя полностью             |
| `hasState(id)`                     | Есть ли вообще какое-либо state            |

> **Примечание:** `resetUserState` сохраняет `tempData`, `resetUserTempData`
> сохраняет `state`. Оба эквивалентны вызову `clearUser` если второй
> параметр отсутствует.

### Пример использования

```ts
stateManager.setUserState(userId, "awaiting_name");
stateManager.setUserTempData(userId, { fullName: "Иван" });

const data = stateManager.getUserTempData<{ fullName: string }>(userId);
console.log(data.fullName);
```

---

## 🔄 Middleware регистрации (src/bot/middlewares/registration-state.middleware.ts)

Middleware прикрепляется через `bot.on('message', middleware)`.
Он проверяет только две вещи:

1. Пользователь находится в **процессе регистрации**
   (`awaiting_name` или `awaiting_phone`).
2. Сообщение **не является командой**.

Если оба условия выполняются, middleware передаёт сообщение в
`registrationHandler.handleMessage(msg)`; иначе он ничего не делает –
следующие подписчики на `message` могут обрабатывать событие.

Дополнительно в проекте используется группа admin-state:

- `admin_guest_mode` — неавторизованный админский режим;
- `admin_register_awaiting_login` — ожидание логина в `/admin_register`;
- `admin_register_awaiting_password` — ожидание пароля в `/admin_register`;
- `admin_login_awaiting_login` — ожидание логина в `/admin_login`;
- `admin_login_awaiting_password` — ожидание пароля в `/admin_login`;
- `admin_authenticated` — авторизованный админский режим.
- `admin_create_warehouse_awaiting_name` / `admin_create_warehouse_awaiting_address` — шаги создания склада.
- `admin_edit_warehouses_selecting` — ожидание номера склада в сценарии `/superadmin_edit_warehouses`.
- `admin_edit_warehouse_action_selecting` — ожидание выбора действия для выбранного склада.
- `admin_edit_warehouse_awaiting_name` — ожидание нового названия склада.
- `admin_edit_warehouse_awaiting_address` — ожидание нового адреса склада.
- `admin_edit_warehouse_awaiting_status` — ожидание нового статуса склада.
- `admin_edit_warehouse_awaiting_delete_confirm` — ожидание подтверждения удаления склада (`ДА`).

Поведение:

- при вводе `/admin` текущее состояние и `tempData` пользователя очищаются;
- пользователь переходит в неавторизованный админский режим;
- в этом режиме блокируются курьерские команды, кроме `/admin_login`, `/admin_register`, `/admin_logout`, `/exit_admin`, `/cancel`;
- `/admin_login` запускает пошаговый сценарий входа админа (логин -> пароль -> `admin_authenticated`);
- `/admin_register` запускает пошаговый сценарий регистрации админа (логин -> пароль -> запись в БД);
- `/admin_logout` завершает авторизованную сессию админа и возвращает в `admin_guest_mode`;
- `/exit_admin` очищает admin-state и возвращает пользователя в курьерский поток
  в зависимости от статуса профиля (зарегистрирован/активен, выбран склад,
  есть ли активная сессия).
- `/superadmin_edit_warehouses` запускает многошаговый сценарий редактирования склада
  (выбор склада -> выбор действия -> ввод значения/подтверждение), доступный только
  для суперадмина (`permissions_level >= 2`).
- `/cancel` в этом сценарии работает контекстно:
  - на этапе выбора склада или выбора действия возвращает в состояние до запуска
    `/superadmin_edit_warehouses`;
  - на этапах ввода названия/адреса/статуса/подтверждения удаления возвращает к
    выбору действия по выбранному складу.
### Важное поведение

- Команды **никогда не мешают**: middleware не прерывает их выполнение.
- Другие процессы (выбор склада, аренда девайса) не будут
  захвачены, потому что `isUserInRegistration()` теперь чётко фильтрует
  состояния.
- При желании можно создать аналогичные middleware для других диалогов,
  например `warehouse-state.middleware.ts`.

---

## ✅ Общие рекомендации

- **Добавление новой команды**: обычно вам не нужно ничего менять в
  `state-manager` – просто выберите уникальное строковое состояние и
  при необходимости используйте `stateManager` для сохранения данных.
- **Новый процесс (диалог)**: создайте своё состояние, добавьте
  middleware-проверку и обработчик. Убедитесь, что `isUserInRegistration`
  не возвращает `true` для этого состояния.
- **Очистка после окончания**: всегда вызывайте
  `stateManager.clearUser(userId)` либо `resetUser*` вручную после
  завершения процесса. Это предотвратит «висение» состояний.

---

В случае вопросов – ориентируйтесь на `registration.handler.ts` в качестве
живого примера. Документ актуален на 04.03.2026.
