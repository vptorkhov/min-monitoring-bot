# Папка admin

Эта папка содержит служебную логику админского режима Telegram-бота.

## Файлы

### `admin-mode.ts`

Утилиты переключения и контроля админского режима:

- `enterAdminMode(telegramId)` — очищает текущий пользовательский сценарий и включает админ-режим
- `exitAdminMode(telegramId)` — выключает админ-режим
- `isUserInAdminMode(telegramId)` — проверка текущего админского режима
- `blockIfAdminGuestCommandNotAllowed(...)` — guard, который блокирует курьерские команды, если пользователь в админском режиме без авторизации

## Текущие ограничения

В неавторизованном админском режиме разрешены только:

- `/admin`
- `/admin_login`
- `/admin_register`
- `/admin_logout`
- `/exit_admin`
- `/cancel`

Реализованные сценарии:

- `/admin_register` — пошаговая регистрация админа (логин -> пароль -> создание неактивной записи)
- `/admin_login` — пошаговый вход админа (логин -> пароль -> переход в `admin_authenticated`)
- `/admin_logout` — выход из авторизованного админского состояния в `admin_guest_mode`
- `/exit_admin` — полный выход из админского режима в курьерский поток
- `/superadmin_create_warehouse` — создание нового склада; доступно только суперадмину (`permissions_level >= 2`); шаги: название (мин. 2 символа) → адрес (мин. 2 символа) → создание записи в БД; доступна как с выбранным складом, так и без него
- `/superadmin_edit_warehouses` — редактирование существующих складов; доступно только суперадмину (`permissions_level >= 2`); шаги: выбор номера склада из списка → выбор действия над складом
	- `/superadmin_edit_warehouse_name` — изменить название (мин. 2 символа), после успеха возврат к выбору действия по складу
	- `/superadmin_edit_warehouse_address` — изменить адрес (мин. 2 символа), после успеха возврат к выбору действия по складу
	- `/superadmin_edit_warehouse_status` — изменить статус (`1`/`1.`/`Активный`/`1. Активный` или `2`/`2.`/`Отключен`/`2. Отключен`), после успеха возврат к выбору действия по складу
	- `/superadmin_edit_warehouse_delete` — удалить склад после подтверждения `ДА`; после удаления возврат в состояние до запуска `/superadmin_edit_warehouses`

Поведение `/cancel` в редактировании складов:

- на этапе выбора склада или выбора действия — возврат в состояние до запуска `/superadmin_edit_warehouses`
- на этапах ввода нового названия/адреса/статуса/подтверждения удаления — возврат к выбору действия по выбранному складу
- ввод подкоманд `/superadmin_edit_warehouse_*` без активного контекста выбора склада приводит к сообщению о недоступности команды

## Состояния admin_mode_states

Все состояния, при которых `isUserInAdminMode()` возвращает `true`:

- `admin_guest_mode` — неавторизованный режим
- `admin_register_awaiting_login` / `admin_register_awaiting_password` — шаги регистрации
- `admin_login_awaiting_login` / `admin_login_awaiting_password` — шаги входа
- `admin_authenticated` — авторизованный режим
- `admin_create_warehouse_awaiting_name` / `admin_create_warehouse_awaiting_address` — шаги создания склада
- `admin_edit_warehouses_selecting` — ожидание номера склада для редактирования
- `admin_edit_warehouse_action_selecting` — ожидание выбора действия по выбранному складу
- `admin_edit_warehouse_awaiting_name` — ожидание нового названия склада
- `admin_edit_warehouse_awaiting_address` — ожидание нового адреса склада
- `admin_edit_warehouse_awaiting_status` — ожидание нового статуса склада
- `admin_edit_warehouse_awaiting_delete_confirm` — ожидание подтверждения удаления склада (`ДА`)
