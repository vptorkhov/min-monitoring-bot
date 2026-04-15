# Мониторинг СИМ

Telegram бот для учёта и мониторинга средств индивидуальной мобильности (СИМ), используемых курьерами для доставки.

## 📋 Содержание

- [О проекте](#о-проекте)
- [Технологический стек](#технологический-стек)
- [Структура проекта](#структура-проекта)
- [Документация](#документация)
- [Функциональность](#функциональность)
- [База данных](#база-данных)
- [Установка и запуск](#установка-и-запуск)
- [Переменные окружения](#переменные-окружения)
- [Команды бота](#команды-бота)
- [Планируемые возможности](#планируемые-возможности)
- [Часовые пояса](#часовые-пояса)

## 🎯 О проекте

**Мониторинг СИМ** — это Telegram бот для автоматизации процессов, связанных с использованием средств индивидуальной мобильности (электросамокатов, моноколёс, гироскутеров и т.д.) в курьерской службе.

**Основные роли пользователей:**

- **Курьеры** — регистрируются в системе, прикрепляются к складам, берут и сдают СИМ
- **Администраторы** — управляют устройствами, складами, курьерами, просматривают статистику

## 🛠 Технологический стек

- **Node.js** — v22.17.0
- **TypeScript** — для типобезопасности
- **Telegram Bot API** — библиотека `node-telegram-bot-api`
- **PostgreSQL** — база данных
- **Express** — HTTP сервер для health checks
- **pg** — клиент для PostgreSQL
- **Docker** — контейнеризация БД

**Зависимости:**

```json
{
	"dotenv": "^17.2.3",
	"express": "^5.1.0",
	"node-telegram-bot-api": "^0.63.0",
	"pg": "^8.18.0"
}
```

## 📁 Структура проекта

```
min-monitoring-bot/
├── db/
│   ├── docker-compose.yml
│   ├── init.sql
│   └── readme.md
├── min-monitoring-bot-tree.txt
├── readme.md
└── tg-bot/
    ├── Dockerfile
    ├── min-monitoring-bot-tree.txt
    ├── package.json
    ├── tsconfig.json
    ├── docs/
    │   └── state_management.md
    └── src/
        ├── index.ts
        ├── bot/
        │   ├── index.ts
        │   ├── init.ts
        │   ├── callback-router.ts
        │   ├── state-manager.ts
        │   ├── admin/
        │   │   ├── admin-command-hints.ts
        │   │   ├── admin-mode.ts
        │   │   └── README.md
        │   ├── commands/
        │   │   ├── index.ts
        │   │   ├── admin.ts
        │   │   ├── admin.types.ts
        │   │   ├── start.ts
        │   │   ├── set-warehouse.ts
        │   │   ├── clear-warehouse.ts
        │   │   ├── take-sim.ts
        │   │   ├── admin/
        │   │   ├── cancel/
        │   │   ├── courier/
        │   │   ├── return/
        │   │   ├── sim/
        │   │   ├── warehouse/
        │   │   └── README.md
        │   ├── handlers/
        │   │   ├── registration.handler.ts
        │   │   └── README.md
        │   ├── keyboards/
        │   │   ├── index.ts
        │   │   ├── keyboard.constants.ts
        │   │   ├── keyboard.utils.ts
        │   │   ├── courier-actions.keyboard.ts
        │   │   ├── courier-main-keyboard.ts
        │   │   ├── registration-flow.keyboard.ts
        │   │   ├── return-sim.keyboard.ts
        │   │   ├── sim-selection.keyboard.ts
        │   │   ├── warehouse-selection.keyboard.ts
        │   │   └── README.md
        │   ├── middlewares/
        │   │   ├── index.ts
        │   │   ├── registration-state.middleware.ts
        │   │   ├── update-logging.middleware.ts
        │   │   └── README.md
        │   └── README.md
        ├── config/
        │   ├── database.ts
        │   └── README.md
        ├── constants/
        │   ├── commands.constant.ts
        │   ├── messages.constant.ts
        │   ├── states.constant.ts
        │   └── README.md
        ├── repositories/
        │   ├── admin.repository.ts
        │   ├── courier.repository.ts
        │   ├── mobility-device.repository.ts
        │   ├── session.repository.ts
        │   ├── warehouse.repository.ts
        │   ├── types/
        │   │   ├── session.type.ts
        │   │   ├── warehouse.type.ts
        │   │   └── README.md
        │   └── README.md
        ├── services/
        │   ├── activation-notifier.service.ts
        │   ├── admin.service.ts
        │   ├── courier.service.ts
        │   ├── session.service.ts
        │   ├── warehouse.service.ts
        │   └── README.md
        ├── server/
        │   ├── index.ts
        │   └── README.md
        ├── utils/
        │   ├── admin-format.utils.ts
        │   ├── admin-message-state.utils.ts
        │   ├── admin-selection-format.utils.ts
        │   ├── admin-state.utils.ts
        │   ├── admin-status.utils.ts
        │   ├── cancel-admin-state.utils.ts
        │   ├── moscow-time.utils.ts
        │   ├── telegram.utils.ts
        │   └── README.md
        └── validators/
            ├── phone.validator.ts
            ├── sim-number.validator.ts
            └── README.md
```

## 📚 Документация

Для каждой папки в `tg-bot/src/` создана подробная документация в файле `README.md`:

### Основные модули:
- [`src/bot/README.md`](tg-bot/src/bot/README.md) — основная логика Telegram-бота
- [`src/config/README.md`](tg-bot/src/config/README.md) — конфигурация приложения
- [`src/constants/README.md`](tg-bot/src/constants/README.md) — константы и перечисления
- [`src/repositories/README.md`](tg-bot/src/repositories/README.md) — слой работы с базой данных
- [`src/repositories/types/README.md`](tg-bot/src/repositories/types/README.md) — TypeScript типы для репозиториев
- [`src/server/README.md`](tg-bot/src/server/README.md) — HTTP-сервер для мониторинга
- [`src/services/README.md`](tg-bot/src/services/README.md) — бизнес-логика приложения
- [`src/utils/README.md`](tg-bot/src/utils/README.md) — вспомогательные функции
- [`src/validators/README.md`](tg-bot/src/validators/README.md) — валидация данных

### Bot слой:
- [`src/bot/admin/README.md`](tg-bot/src/bot/admin/README.md) — скрытый админ-режим
- [`src/bot/commands/README.md`](tg-bot/src/bot/commands/README.md) — регистрация и структура команд
- [`src/bot/commands/admin/README.md`](tg-bot/src/bot/commands/admin/README.md) — admin auth-команды и szenarios
- [`src/bot/commands/cancel/README.md`](tg-bot/src/bot/commands/cancel/README.md) — универсальная отмена действий
- [`src/bot/commands/courier/README.md`](tg-bot/src/bot/commands/courier/README.md) — управление курьерами в admin-flow
- [`src/bot/commands/return/README.md`](tg-bot/src/bot/commands/return/README.md) — сценарий сдачи устройства
- [`src/bot/commands/sim/README.md`](tg-bot/src/bot/commands/sim/README.md) — управление SIM в admin-flow
- [`src/bot/commands/warehouse/README.md`](tg-bot/src/bot/commands/warehouse/README.md) — управление складами в admin-flow
- [`src/bot/handlers/README.md`](tg-bot/src/bot/handlers/README.md) — обработчики диалоговых процессов
- [`src/bot/keyboards/README.md`](tg-bot/src/bot/keyboards/README.md) — reply/inline клавиатуры
- [`src/bot/middlewares/README.md`](tg-bot/src/bot/middlewares/README.md) — middleware для управления состояниями

### Дополнительные документы:
- [`db/readme.md`](db/readme.md) — структура БД, таблицы, связи и начальные данные
- [`tg-bot/docs/state_management.md`](tg-bot/docs/state_management.md) — архитектура системы состояний (State Machine): переходы, tempData, жизненный цикл

## ✨ Функциональность

### ✅ Реализовано

- **Регистрация курьеров** — двухэтапная регистрация (имя → телефон)
- **Проверка существующего пользователя** — при `/start` определяется статус
- **Валидация телефонных номеров** — поддержка международных форматов
- **Middleware для регистрации** — блокировка команд во время регистрации
- **Прикрепление курьеров к складам** — через `/set_warehouse` с выбором из активных складов; доступны ручной ввод номера, inline-кнопки и reply-кнопки; запрещено при активной сессии
- **Взятие СИМ** — команда `/take_sim` показывает список устройств и создаёт сессию
- **Сдача СИМ** — команда `/return_sim` завершает сессию, с опросом о повреждениях для не‑личных устройств
- **Отмена действий** — команда `/cancel` сбрасывает текущее состояние и временные данные, выводит `❌ Действие отменено.`
- **Скрытый админский режим** — команда `/admin` в любой момент останавливает текущий курьерский сценарий и переводит пользователя в admin-mode; в предадминском состоянии доступны `/admin_login`, `/admin_register`, `/admin_logout`, `/exit_admin`
- **Вход администратора** — команда `/admin_login` запускает сценарий логин → пароль с проверкой SHA-256 от `пароль + mim` и переводит в авторизованный админский режим
- **Выход из авторизованного админ-режима** — команда `/admin_logout` завершает только авторизацию администратора и возвращает в предадминское состояние
- **Выход в курьерский режим** — команда `/exit_admin` полностью выключает admin-mode и восстанавливает следующий шаг по состоянию курьера (регистрация, выбор склада, активная сессия, обычное меню)
- **Создание склада суперадмином** — команда `/superadmin_create_warehouse` доступна только авторизованному суперадмину (`permissions_level ≥ 2`); обычному админу отвечает «Нет прав на эту команду»; двухшаговый ввод названия (мин. 2 символа) и адреса (мин. 2 символа) с валидацией; доступна независимо от того, выбран ли склад; на любом этапе `/cancel` отменяет создание и возвращает в авторизованный режим, а `/exit_admin` выходит из админского режима
- **Редактирование администраторов суперадмином** — команда `/superadmin_edit_admins` доступна только авторизованному суперадмину (`permissions_level ≥ 2`); выводит нумерованный список админов (без суперадминов), после выбора доступны действия: `/superadmin_edit_admin_status`, `/superadmin_edit_admin_delete`, `/superadmin_edit_admin_password`; на этапах ввода действует валидация, а `/cancel` работает контекстно (возврат к предыдущему уровню сценария)
- **Принятие регистраций курьеров** — команда `/admin_apply_registrations` доступна авторизованному админу и суперадмину (с выбранным складом и без него); показывает нумерованный список неактивных курьеров без записей в `session`, принимает номер курьера и подтверждение `Да`/`Нет` (без учета регистра); при `Да` активирует курьера, при `Нет` отменяет регистрацию и удаляет курьера из БД, после каждого решения возвращает к обновленному списку кандидатов (или в предыдущее состояние, если список пуст)
- **Взаимодействие с курьерами из админ-режима** — команды `/admin_edit_couriers` и `/superadmin_edit_couriers` позволяют выбрать курьера из списка, просмотреть карточку (ФИО, телефон, никнейм, склад, статус, активная сессия) и выполнить подкоманды изменения статуса/просмотра истории; для обычного админа доступ ограничен курьерами выбранного склада, для суперадмина — всеми курьерами
- **Health check** — HTTP endpoint `/health` для мониторинга
- **Уведомления об активации** — фоновой воркер `ActivationNotifier` отправляет курьерам сообщение при активации их учётной записи; отслеживает отправленные уведомления в БД через поле `notified_at` для предотвращения дублирования при перезапусках

### 🚧 В разработке / Планируется

#### Курьерский функционал:

- Смена прикрепленного склада (блокируется при активной сессии)
- Просмотр истории своих сессий

#### Административный функционал:

- Добавление/редактирование СИМ
- Назначение курьеров на склады
- Просмотр статистики использования
- Принудительное завершение сессий

#### Архитектурные улучшения:

- Модульный рефакторинг фич в `bot/features/admin/` и `bot/features/courier/` (директории зарезервированы)

## 💾 База данных

### Структура таблиц

#### `mobility_devices` — Средства индивидуальной мобильности

| Поле          | Тип         | Описание                                      |
| ------------- | ----------- | --------------------------------------------- |
| id            | SERIAL      | Уникальный идентификатор                      |
| device_number | VARCHAR(20) | Номер устройства                              |
| is_personal   | BOOLEAN     | Признак личного устройства (личный СИМ)       |
| status        | VARCHAR(20) | Статус устройства (`ok`, `warning`, `broken`) |
| warehouse_id  | INTEGER     | ID склада, к которому привязано устройство    |
| is_active     | BOOLEAN     | Активна ли запись                             |
| created_at    | TIMESTAMP   | Дата создания                                 |
| updated_at    | TIMESTAMP   | Дата обновления                               |

Личный СИМ (генерируется запись `'ЛИЧНЫЙ'` при инициализации) показывается курьеру всегда, вне зависимости от склада и принадлежности. При сдаче такого СИМ сессия закрывается мгновенно без вопросов о повреждениях.

#### `warehouse` — Склады

| Поле       | Тип          | Описание                 |
| ---------- | ------------ | ------------------------ |
| id         | SERIAL       | Уникальный идентификатор |
| name       | VARCHAR(100) | Название склада          |
| address    | VARCHAR(200) | Адрес склада             |
| is_active  | BOOLEAN      | Активен ли склад         |
| created_at | TIMESTAMP    | Дата создания            |
| updated_at | TIMESTAMP    | Дата обновления          |

#### `couriers` — Курьеры

| Поле         | Тип          | Описание                                                          |
| ------------ | ------------ | ----------------------------------------------------------------- |
| id           | SERIAL       | Уникальный идентификатор                                          |
| telegram_id  | BIGINT       | ID пользователя в Telegram                                        |
| full_name    | VARCHAR(255) | Полное имя                                                        |
| nickname     | VARCHAR(100) | Псевдоним (никнейм)                                               |
| phone_number | VARCHAR(20)  | Номер телефона                                                    |
| warehouse_id | INTEGER      | ID склада (FK)                                                    |
| is_active    | BOOLEAN      | Активен ли курьер                                                 |
| notified_at  | TIMESTAMP    | Время отправки уведомления об активации (NULL если не отправлено) |
| created_at   | TIMESTAMP    | Дата создания                                                     |
| updated_at   | TIMESTAMP    | Дата обновления                                                   |

#### `session` — Курьерские сессии

| Поле             | Тип         | Описание                                       |
| ---------------- | ----------- | ---------------------------------------------- |
| id               | SERIAL      | Уникальный идентификатор                       |
| courier_id       | INTEGER     | ID курьера (FK)                                |
| device_id        | INTEGER     | ID устройства (FK)                             |
| warehouse_id     | INTEGER     | ID склада (FK)                                 |
| start_date       | TIMESTAMP   | Начало сессии                                  |
| end_date         | TIMESTAMP   | Окончание сессии                               |
| sim_status_after | VARCHAR(20) | Статус СИМ после завершения сессии             |
| status_comment   | TEXT        | Комментарий о состоянии СИМ (повреждения)      |
| is_active        | BOOLEAN     | Генерируемое поле (true если end_date IS NULL) |

Запись создаётся при взятии СИМ и закрывается при сдаче; в случае критического повреждения устройство помечается неактивным.

Дополнительно на уровне БД действует ограничение: у одного курьера может быть только одна активная сессия одновременно.

#### `admins` — Администраторы

| Поле              | Тип          | Описание                                      |
| ----------------- | ------------ | --------------------------------------------- |
| id                | SERIAL       | Уникальный идентификатор                      |
| nickname          | VARCHAR(50)  | Никнейм администратора                        |
| password_hash     | VARCHAR(200) | Хеш пароля                                    |
| permissions_level | INTEGER      | Уровень доступа (1 - обычный, 2 - суперадмин) |
| is_active         | BOOLEAN      | Активен ли администратор (одобрен суперадмином) |
| is_login          | BOOLEAN      | Статус авторизации                            |
| warehouse_id      | INTEGER      | ID склада (FK, NULL если не привязан)        |
| created_at        | TIMESTAMP    | Дата создания                                 |

**Примечание:** В таблицу `admins` при инициализации добавляется суперадмин с хешем пароля.

## 🚀 Установка и запуск

### Предварительные требования

- Docker и Docker Compose
- Node.js v22.17.0+
- npm

### Запуск базы данных

```bash
# Перейти в директорию с БД
cd db

# Запустить PostgreSQL в Docker
docker-compose up -d

# Остановить и удалить контейнер с БД
docker-compose down -v
```

### Настройка бота

1. **Клонировать репозиторий**

```bash
git clone <repository-url>
cd min-monitoring-bot/tg-bot
```

2. **Установить зависимости**

```bash
npm install
```

3. **Настроить переменные окружения**

```bash
cp .env.example .env
# Отредактировать .env, указав свои значения
```

4. **Собрать проект**

```bash
npm run build
```

5. **Запустить бота**

```bash
npm run start
```

### Docker для бота (опционально)

```bash
# Собрать образ
docker build -t monitoring-bot .

# Запустить контейнер
docker run --env-file .env monitoring-bot
```

## 🔧 Переменные окружения

Создайте файл `.env` в директории `tg-bot`:

```env
# Telegram Bot Token (получить у @BotFather)
BOT_TOKEN=your_bot_token_here

# Режим получения апдейтов: polling | webhook
BOT_UPDATE_MODE=polling

# Webhook настройки (обязательны только если BOT_UPDATE_MODE=webhook)
WEBHOOK_BASE_URL=https://your-app-name.user.amvera.io
WEBHOOK_PATH=/webhook/telegram
WEBHOOK_SECRET_TOKEN=your_secret_token_here

# Опционально: удалять webhook при graceful shutdown
WEBHOOK_DELETE_ON_SHUTDOWN=false

# Порт HTTP сервера для health check
PORT=3000

# PostgreSQL подключение
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mobility_db
DB_USER=mobility_user
DB_PASSWORD=mobility_password
```

### Режимы запуска

- Локально рекомендуется `BOT_UPDATE_MODE=polling`.
- На хостинге (например, Amvera) рекомендуется `BOT_UPDATE_MODE=webhook`.

### Минимальные требования для webhook на Amvera

- Публичный HTTPS-домен приложения (бесплатный домен Amvera или свой).
- Переменные/секреты в настройках приложения: `BOT_TOKEN`, `BOT_UPDATE_MODE=webhook`, `WEBHOOK_BASE_URL`, `WEBHOOK_PATH`, `WEBHOOK_SECRET_TOKEN`, а также `DB_*`.
- После изменения переменных окружения требуется перезапуск контейнера.
- При первичном переходе с polling на webhook очистите старый webhook в BotFather/Telegram API при необходимости.

## 🤖 Команды бота

| Команда            | Описание                                                                                                                                                                                                                                |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/start`           | Начало работы с ботом. Если курьер не зарегистрирован — запускает регистрацию                                                                                                                                                           |
| `/set_warehouse`   | Позволяет курьеру выбрать склад для прикрепления. Бот показывает список активных складов и поддерживает выбор через inline-кнопки `1..N`, reply-кнопки `1..N` + `❌ Отмена`, а также ручной ввод номера (запрещено при активной сессии) |
| `/clear_warehouse` | Позволяет курьеру отвязаться от всех складов. Бот проверяет отсутствие активной сессии и отвязывает курьера от текущего склада.                                                                                                         |
| `/take_sim`        | Курьер выбирает устройство и начинает сессию. Личный СИМ всегда первым, требуется ввод номера.                                                                                                                                          |
| `/return_sim`      | Сдача СИМ; личный закрывается сразу, остальные требуют опроса о повреждениях.                                                                                                                                                           |
| `/cancel`          | Отмена текущего действия (регистрация, выбор склада, диалог по взятию/сдаче СИМ). Сбрасывает состояние и временные данные. Бот выводит `❌ Действие отменено.`                                                                          |
| `/admin`           | Включает скрытый админский режим из любого текущего курьерского сценария. Текущий процесс принудительно останавливается.                                                                                                                |
| `/admin_login`     | Пошаговый вход администратора (логин → пароль). Если логин не найден или пароль неверен, бот запрашивает повторный ввод соответствующего шага.                                                                                           |
| `/admin_register`  | Пошаговая регистрация админа: логин (латиница, минимум 3 символа, минимум 1 буква, проверка уникальности без учета регистра) и пароль (минимум 6 символов). Пароль сохраняется как SHA-256 от `пароль + mim`.                        |
| `/admin_change_password` | Смена пароля для авторизованного админа/суперадмина. Бот запрашивает новый пароль (минимум 6 символов), обновляет пароль в БД и оставляет пользователя в авторизованном админ-режиме. |
| `/admin_set_warehouse` | Выбор склада для админа любого уровня доступа. Бот выводит нумерованный список активных складов, ожидает номер и сохраняет выбор в `admins.warehouse_id`. Команда доступна и для первичного выбора, и для смены склада. |
| `/admin_clear_warehouse` | Отвязка админа от склада. Доступна только когда склад выбран; очищает `admins.warehouse_id`, сообщает об успехе и переводит в состояние админа без выбранного склада. |
| `/admin_logout`    | Выходит из авторизованного админ-режима и возвращает в предадминское состояние (доступны `/admin_login`, `/admin_register`, `/exit_admin`).                                                                                              |
| `/exit_admin`      | Выключает админский режим и возвращает пользователя в курьерский поток в соответствии с его текущим статусом (регистрация/склад/сессия).                                                                                                 |
| `/superadmin_create_warehouse` | Создание нового склада. Доступна только авторизованному суперадмину (`permissions_level ≥ 2`). Обычному админу отвечает «Нет прав на эту команду». Пошаговый ввод: название (мин. 2 символа) → адрес (мин. 2 символа) → создание. |
| `/superadmin_edit_admins` | Редактирование администраторов. Доступна только авторизованному суперадмину (`permissions_level ≥ 2`). Показывает нумерованный список админов (кроме суперадминов), ожидает номер и переводит к выбору действия. |
| `/superadmin_edit_admin_status` | Подкоманда в сценарии `/superadmin_edit_admins`: изменение статуса выбранного администратора (`Активный`/`Отключен`) с валидацией вариантов ввода. |
| `/superadmin_edit_admin_delete` | Подкоманда в сценарии `/superadmin_edit_admins`: удаление выбранного администратора после подтверждения `ДА`; после успеха показывает обновленный список админов. |
| `/superadmin_edit_admin_password` | Подкоманда в сценарии `/superadmin_edit_admins`: смена пароля выбранного администратора (минимум 6 символов) с возвратом к выбору действия. |
| `/admin_edit_couriers` | Взаимодействие с курьерами выбранного склада. Доступна авторизованному админу/суперадмину только при выбранном складе. Показывает список курьеров и переводит к карточке/подкомандам. |
| `/admin_edit_courier_status` | Подкоманда в сценарии `/admin_edit_couriers`: изменение `is_active` выбранного курьера по вводу `1/2` или текстовым эквивалентам `Активный/Отключен`. |
| `/admin_edit_courier_name` | Подкоманда в сценарии `/admin_edit_couriers`: изменение ФИО выбранного курьера (минимум 2 символа) с возвратом к карточке курьера. |
| `/admin_courier_history` | Подкоманда в сценарии `/admin_edit_couriers`: показывает последние 50 сессий курьера и выводит в заголовке ФИО + `@nickname` (если задан); предлагает полную историю по ответу `ДА` (строго верхний регистр). |
| `/superadmin_edit_couriers` | Взаимодействие со всеми курьерами (включая курьеров без склада). Доступна только суперадмину и работает независимо от выбранного склада. |
| `/superadmin_edit_courier_status` | Подкоманда в сценарии `/superadmin_edit_couriers`: изменение статуса активности выбранного курьера. |
| `/superadmin_edit_courier_name` | Подкоманда в сценарии `/superadmin_edit_couriers`: изменение ФИО выбранного курьера (минимум 2 символа). |
| `/superadmin_courier_history` | Подкоманда в сценарии `/superadmin_edit_couriers`: история сессий выбранного курьера с preview 50 записей, показом ФИО + `@nickname` (если задан) и полной историей по `ДА`. |

## � Часовые пояса

### Хранение дат в базе данных

Все временные метки хранятся в **UTC** (Coordinated Universal Time):

- Колонки `start_date`, `end_date` в таблице `session` — UTC
- Колонки `created_at`, `updated_at` во всех таблицах — UTC (`CURRENT_TIMESTAMP` с принудительным `timezone=UTC` на уровне сессии PostgreSQL)
- Колонка `notified_at` в таблице `couriers` — UTC (`NOW()`)

Гарантии UTC на двух уровнях:
1. **PostgreSQL контейнер** (`docker-compose.yml`): переменные `TZ=UTC` и `PGTZ=UTC` — сервер использует UTC по умолчанию.
2. **Подключение Node.js** (`database.ts`): параметр `options: '-c timezone=UTC'` в пуле соединений pg — каждая сессия PostgreSQL явно работает в UTC.
3. **Парсер типов pg** (`database.ts`): кастомный парсер OID 1114 приписывает суффикс `Z` к строке TIMESTAMP при создании `Date`-объекта — независимо от временно́й зоны Node.js-процесса значения трактуются как UTC.

### Отображение дат пользователям

Все даты и время, отображаемые в сообщениях бота, переводятся в **московское время (Europe/Moscow, UTC+3)**:

- Время начала/конца сессии в истории курьера и склада
- Время активной сессии в карточке курьера (в режиме администратора)

Используется `Intl.DateTimeFormat` с явным параметром `timeZone: "Europe/Moscow"` (функции `formatMoscowTime` и `formatMoscowDateTime` в `admin.ts`).

## �📝 Лицензия

MIT
