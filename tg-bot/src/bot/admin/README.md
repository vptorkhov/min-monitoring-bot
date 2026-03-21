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

## Состояния admin_mode_states

Все состояния, при которых `isUserInAdminMode()` возвращает `true`:

- `admin_guest_mode` — неавторизованный режим
- `admin_register_awaiting_login` / `admin_register_awaiting_password` — шаги регистрации
- `admin_login_awaiting_login` / `admin_login_awaiting_password` — шаги входа
- `admin_authenticated` — авторизованный режим
- `admin_create_warehouse_awaiting_name` / `admin_create_warehouse_awaiting_address` — шаги создания склада
