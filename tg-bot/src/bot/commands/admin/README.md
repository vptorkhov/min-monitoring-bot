# Папка commands/admin

Папка содержит admin auth-команды и message-layer для state-based сценариев admin-flow.

## Назначение

- Регистрирует команды входа/выхода в admin-mode.
- Маршрутизирует входящие текстовые сообщения по текущему состоянию админа.
- Предоставляет контексты и резолверы для сценариев складов, администраторов, курьеров, SIM и одобрения регистраций.

## Ключевые файлы

- `auth-commands.ts` — `/admin`, `/admin_login`, `/admin_register`, `/admin_logout`, `/exit_admin`, `/admin_change_password`.
- `admin-message-router.ts` — единый message-router для non-command сообщений в admin-state.
- `admin-flow.utils.ts` — утилиты приветствия и возврата в courier-flow после выхода из admin-mode.

## Message handlers по доменам

- `admin-auth-message-handlers.ts` — шаги login/register и смены пароля.
- `admin-warehouse-message-*.ts` — message-этапы выбора/редактирования/удаления складов.
- `admin-admins-message-handlers.ts` — message-этапы редактирования администраторов.
- `admin-approval-commands.ts`, `admin-approval-resolvers.ts` — одобрение/отклонение регистраций курьеров.
- `admin-sim-message-*.ts` — message-этапы выбора SIM, смены статусов и удаления.
- `admin-courier-message-*.ts` — message-этапы выбора курьера, смены статуса и истории.
- `admin-sessions-message-handlers.ts` — message-сценарий истории сессий.

## Контексты

- `admin-shared-message-context.ts` — общие функции и данные для warehouse/admin/approval сценариев.
- `admin-courier-message-context.ts` — контекст выбора и карточки курьера.
- `admin-sim-message-context.ts` — контекст выбора SIM и карточки устройства.

## Правила изменения

1. Любой новый многошаговый admin-сценарий должен иметь:
   - entry-команду;
   - message-handler для состояния;
   - обработку отмены в `commands/cancel/`.
2. При добавлении новых состояний обновлять `states.constant.ts` и state-guards.
3. При изменении команд учитывать права (admin/superadmin) до смены состояния.