# Папка types

Эта папка содержит TypeScript интерфейсы и типы, специфичные для репозиториев.

## Файлы

### `warehouse.type.ts`

Определяет интерфейс `Warehouse` для типизации данных о складах:

```typescript
interface Warehouse {
	id: number;
	name: string;
	address: string;
	is_active: boolean;
}
```

## Архитектура типов

Типы в этой папке:

- Соответствуют структуре таблиц БД
- Используются репозиториями для типизации возвращаемых данных
- Обеспечивают типобезопасность на уровне доступа к данным</content>
  <parameter name="filePath">d:\Vova\bots\min-monitoring-bot\tg-bot\src\repositories\types\README.md
