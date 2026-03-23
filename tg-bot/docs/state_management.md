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
- `admin_authenticated_with_warehouse` — авторизованный админский режим с выбранным складом (`admins.warehouse_id IS NOT NULL`).
- `admin_change_password_awaiting_new` — ожидание нового пароля в `/admin_change_password`.
- `admin_set_warehouse_selecting` — ожидание номера склада в сценарии `/admin_set_warehouse`.
- `admin_create_warehouse_awaiting_name` / `admin_create_warehouse_awaiting_address` — шаги создания склада.
- `admin_edit_warehouses_selecting` — ожидание номера склада в сценарии `/superadmin_edit_warehouses`.
- `admin_edit_warehouse_action_selecting` — ожидание выбора действия для выбранного склада.
- `admin_edit_warehouse_awaiting_name` — ожидание нового названия склада.
- `admin_edit_warehouse_awaiting_address` — ожидание нового адреса склада.
- `admin_edit_warehouse_awaiting_status` — ожидание нового статуса склада.
- `admin_edit_warehouse_awaiting_delete_confirm` — ожидание подтверждения удаления склада (`ДА`).
- `admin_edit_admins_selecting` — ожидание номера администратора в сценарии `/superadmin_edit_admins`.
- `admin_edit_admin_action_selecting` — ожидание выбора действия для выбранного администратора.
- `admin_edit_admin_awaiting_status` — ожидание нового статуса администратора.
- `admin_edit_admin_awaiting_delete_confirm` — ожидание подтверждения удаления администратора (`ДА`).
- `admin_edit_admin_awaiting_password` — ожидание нового пароля администратора.
- `admin_apply_registrations_selecting` — ожидание номера курьера в сценарии `/admin_apply_registrations`.
- `admin_apply_registration_awaiting_confirm` — ожидание ответа `Да`/`Нет` для подтверждения принятия регистрации курьера.
- `admin_sim_interactions_selecting` — ожидание выбора СИМ в сценарии `/admin_sim_interactions`.
- `admin_sim_interaction_action_selecting` — ожидание выбора действия для выбранного СИМ.
- `admin_sim_interaction_awaiting_active_status` — ожидание нового статуса активности СИМ.
- `admin_sim_interaction_awaiting_condition_status` — ожидание нового статуса исправности СИМ.
- `admin_sim_interaction_awaiting_delete_confirm` — ожидание подтверждения удаления СИМ (`ДА`).
- `admin_edit_couriers_selecting` — ожидание номера курьера в сценарии `/admin_edit_couriers`.
- `admin_edit_courier_action_selecting` — ожидание выбора действия по выбранному курьеру.
- `admin_edit_courier_awaiting_status` — ожидание нового статуса активности курьера.
- `admin_courier_history_awaiting_full` — ожидание ответа `ДА`/`нет`/`/cancel` после вывода последних 50 сессий курьера.
- `superadmin_edit_couriers_selecting` — ожидание номера курьера в сценарии `/superadmin_edit_couriers`.
- `superadmin_edit_courier_action_selecting` — ожидание выбора действия по выбранному курьеру (суперадмин).
- `superadmin_edit_courier_awaiting_status` — ожидание нового статуса активности курьера (суперадмин).
- `superadmin_courier_history_awaiting_full` — ожидание ответа `ДА`/`нет`/`/cancel` для полной истории (суперадмин).

Поведение:

- при вводе `/admin` текущее состояние и `tempData` пользователя очищаются;
- пользователь переходит в неавторизованный админский режим;
- в этом режиме блокируются курьерские команды, кроме `/admin_login`, `/admin_register`, `/admin_logout`, `/exit_admin`, `/cancel`;
- `/admin_login` запускает пошаговый сценарий входа админа (логин -> пароль -> `admin_authenticated` или `admin_authenticated_with_warehouse`, если у админа уже есть выбранный склад в БД);
- `/admin_register` запускает пошаговый сценарий регистрации админа (логин -> пароль -> запись в БД);
- `/admin_logout` завершает авторизованную сессию админа и возвращает в `admin_guest_mode`;
- `/admin_change_password` запускает смену пароля для авторизованного админа/суперадмина
  (ввод нового пароля, минимум 6 символов, обновление в БД без разлогина);
- `/admin_set_warehouse` запускает выбор склада для авторизованного админа: показать список активных складов -> ожидать номер -> при успехе сохранить `admins.warehouse_id` и перевести в `admin_authenticated_with_warehouse`;
- `/admin_clear_warehouse` доступна только в состоянии с выбранным складом; очищает `admins.warehouse_id` и возвращает в `admin_authenticated`;
- `/admin_sim_interactions` запускает выбор СИМ выбранного склада (без личного транспорта), далее доступны действия `/admin_sim_change_active`, `/admin_sim_change_status`, `/admin_sim_story`, `/admin_sim_delete` только в рамках выбранного СИМ;
- `/admin_sim_change_active` и `/admin_sim_change_status` недоступны, если по выбранному СИМ есть активная сессия;
- при установке статуса исправности `broken` через `/admin_sim_change_status` дополнительно устанавливается `is_active=false`;
- после выполнения `/admin_sim_story` пользователь автоматически возвращается к выбору команды для выбранного СИМ;
- удаление через `/admin_sim_delete` требует подтверждения `ДА` и запрещено, если по СИМ есть активная сессия;
- `/exit_admin` очищает admin-state и возвращает пользователя в курьерский поток
  в зависимости от статуса профиля (зарегистрирован/активен, выбран склад,
  есть ли активная сессия).
- `/superadmin_edit_warehouses` запускает многошаговый сценарий редактирования склада
  (выбор склада -> выбор действия -> ввод значения/подтверждение), доступный только
  для суперадмина (`permissions_level >= 2`).
- `/superadmin_edit_admins` запускает многошаговый сценарий редактирования администратора
  (выбор администратора -> выбор действия -> ввод значения/подтверждение), доступный
  только для суперадмина (`permissions_level >= 2`); в список попадают только админы
  с `permissions_level < 2`.
- `/admin_apply_registrations` запускает многошаговый сценарий принятия регистраций курьеров
  (выбор номера курьера -> подтверждение `Да`/`Нет`), доступный любому авторизованному
  админу/суперадмину; в список попадают только неактивные курьеры без записей в `session`.
- `/admin_edit_couriers` запускает многошаговый сценарий взаимодействия с курьерами
  выбранного склада (выбор курьера -> карточка -> подкоманды статуса/истории);
  доступен только при выбранном складе.
- `/superadmin_edit_couriers` запускает аналогичный сценарий по всем курьерам
  (включая курьеров без склада), доступный только суперадмину (`permissions_level >= 2`).
- `/admin_edit_courier_status` и `/superadmin_edit_courier_status` меняют `couriers.is_active`
  по вариантам ввода `1`/`2` и текстовым эквивалентам `Активный`/`Отключен`.
- `/admin_courier_history` и `/superadmin_courier_history` сначала показывают последние 50
  сессий курьера (новейшие -> старейшие), затем ожидают `ДА` (строго верхний регистр)
  для полной истории или `/cancel`/`нет` для возврата.
- `/cancel` в этом сценарии работает контекстно:
  - на этапе выбора склада или выбора действия возвращает в состояние до запуска
    `/superadmin_edit_warehouses`;
  - на этапах ввода названия/адреса/статуса/подтверждения удаления возвращает к
    выбору действия по выбранному складу.
- `/cancel` в сценарии `/superadmin_edit_admins` работает контекстно:
  - на этапе выбора администратора возвращает в состояние до запуска
    `/superadmin_edit_admins`;
  - на этапе выбора действия возвращает к списку администраторов;
  - на этапах ввода статуса/подтверждения удаления/нового пароля возвращает к
    выбору действия по выбранному администратору.
- `/cancel` в сценарии `/admin_apply_registrations` работает контекстно:
  - на этапе выбора номера курьера возвращает в состояние до запуска
    `/admin_apply_registrations`;
  - на этапе подтверждения `Да`/`Нет` возвращает к обновленному списку неактивных курьеров;
  - если при возврате список пуст, пользователь возвращается в состояние до запуска
    `/admin_apply_registrations`.
- `/cancel` в `/admin_change_password` возвращает пользователя в `admin_authenticated`.
- `/cancel` в `/admin_set_warehouse` возвращает пользователя в состояние, из которого был запущен выбор склада.
- `/cancel` в `/admin_sim_interactions` на этапе выбора СИМ (где бот подсказывает `/cancel - вернуться в состояние выбранного склада`) возвращает в `admin_authenticated_with_warehouse`, а в подэтапах действий/изменений/удаления (где бот подсказывает `/cancel - вернуться к списку СИМ`) возвращает к обновленному списку СИМ.
- `/cancel` в `/admin_edit_couriers` и `/superadmin_edit_couriers` работает контекстно:
  - на этапе выбора номера курьера возвращает в состояние до запуска базовой команды;
  - на этапе выбора действия по курьеру возвращает к списку курьеров;
  - на этапах ввода статуса и ожидания полной истории возвращает к карточке выбранного курьера.
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
