# Папка middlewares

Папка содержит middleware-слой бота: предобработку входящих update, логирование и управление маршрутизацией сообщений в процессе регистрации.

## Состав

### index.ts

Единая точка подключения middleware.

- Экспортирует `setupAllMiddlewares`.
- Регистрирует middleware в фиксированном порядке.
- Сначала включает логирование update, затем регистрацию.

### update-logging.middleware.ts

Middleware наблюдаемости.

- Логирует входящие `message` с коротким preview текста.
- Логирует `callback_query` с данными callback.
- Не влияет на бизнес-логику и не изменяет состояние пользователя.

### registration-state.middleware.ts

Middleware регистрации пользователя.

- Активируется только если пользователь находится в registration-flow.
- Пропускает команды дальше в command handlers (команды имеют приоритет).
- Защищает от дублей сообщений с debounce-окном.
- Передает валидные сообщения в `RegistrationHandler`.
- На ошибках отправляет `GENERIC_ERROR_MESSAGE`.

## Порядок выполнения

Текущий порядок в `setupAllMiddlewares`:

1. `setupUpdateLoggingMiddleware`
2. `setupRegistrationMiddleware`

Это позволяет видеть сырые update в логах до того, как сообщение будет обработано регистрационным middleware.

## Правила расширения

- Новые middleware добавляйте через `index.ts`, чтобы порядок оставался явным.
- Middleware этого слоя не должны содержать тяжелую бизнес-логику.
- Любые stateful-проверки должны быть идемпотентны и безопасны к повторной доставке update.
