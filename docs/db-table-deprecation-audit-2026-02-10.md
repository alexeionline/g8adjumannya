# Аудит таблиц БД: устаревшие и кандидаты на удаление

Дата аудита: 2026-02-10  
Область: текущий runtime-код (`src/db.js`, `src/api/server.js`, `src/index.js`, `src/handlers/*`)

## Краткий вывод

1. **Точно устаревшие и фактически неиспользуемые в runtime-логике:**
   - `records`
   - `user_records`
   - `migration_flags`

2. **Legacy-таблицы, которые пока нельзя удалять без изменения поведения:**
   - `api_tokens` (нужна для v1 auth и `/web`)
   - `daily_counts` (в неё до сих пор пишет `addCount`, хотя чтения уже нет)

3. **Активно используемые, не удалять:**
   - `users`
   - `daily_adds`
   - `shared_chats`
   - `chat_meta`

---

## Таблица по состоянию

| Таблица | Текущий статус | Где используется | Рекомендация |
|---|---|---|---|
| `users` | Активная | upsert/чтение профилей и display_name | Оставить |
| `daily_adds` | Активная (основной источник) | все агрегаты status/records/history/approaches | Оставить |
| `shared_chats` | Активная | доступ к chat_id и состав чатов | Оставить |
| `chat_meta` | Активная | резолв title в `/chats` | Оставить |
| `api_tokens` | Legacy, но используется | v1 auth (`getChatIdByToken`), `/web` (`createApiToken`) | Удалять только после отключения v1/token-flow |
| `daily_counts` | Legacy, **пишется**, не читается | `addCount()` делает upsert в таблицу | Удалять после перевода `addCount` на `daily_adds`-only |
| `records` | Устаревшая | только миграционный код в `initDb()` | Кандидат на удаление |
| `user_records` | Устаревшая | запись в `updateRecord()` и initDb, чтений нет | Кандидат на удаление |
| `migration_flags` | Не используется | только `CREATE TABLE`, без runtime-запросов | Кандидат на удаление |

---

## Доказательства по коду

### 1) `records` — устарела
- Используется только в `initDb()` для миграционных/схемных операций (`ALTER/UPDATE/INSERT INTO user_records ... FROM records`).
- В runtime-чтениях рекордов используется `getRecordsByChatV2()` из `daily_adds`, а не `records`.

### 2) `user_records` — устарела
- Пишется в `updateRecord()` и в `initDb()`.
- Чтений из `user_records` в текущих API/бот-хендлерах нет; рекорды считаются агрегациями по `daily_adds`.

### 3) `migration_flags` — не используется
- Таблица создаётся, но в текущем коде нет `SELECT/INSERT/UPDATE/DELETE` к ней.

### 4) `daily_counts` — legacy-переходная
- В `initDb()` есть комментарий: "No reads from daily_counts: runtime uses daily_adds only."
- Но `addCount()` до сих пор делает `INSERT ... ON CONFLICT` в `daily_counts`.

### 5) `api_tokens` — legacy-переходная
- Нужна для v1 middleware (`getChatIdByToken`) и формирования токена в `/web`.
- Удаление сейчас сломает v1-эндпоинты и часть flow открытия WebApp.

---

## Что можно удалить уже сейчас

При условии, что не требуется откат к старой миграционной логике:

1. `migration_flags`
2. `records`
3. `user_records`

Риск: низкий, но перед удалением нужен backup/снапшот.

---

## Что удалять позже (после доработок)

1. `daily_counts`
   - Сначала убрать запись в неё из `addCount()` и оставить запись только в `daily_adds`.
2. `api_tokens`
   - Сначала отключить v1 auth/token-схему и перевести `/web` только на v2/JWT-initData flow.

---

## Рекомендуемый порядок deprecation

1. Удалить использование `updateRecord()` и всё, что пишет в `user_records`.
2. Почистить `initDb()` от миграционных блоков `records/user_records`.
3. Удалить таблицы `records`, `user_records`, `migration_flags`.
4. Перевести `addCount()` на `daily_adds`-only, удалить `daily_counts`.
5. Полностью отключить token v1, удалить `api_tokens`.

---

## План удаления `daily_counts` (детально)

Цель: полностью перестать зависеть от `daily_counts` и удалить таблицу без регрессии.

### Шаг 1. Перевести запись `addCount()` на `daily_adds`-only

Файл: `src/db.js`

Что сделать:
1. В `addCount({ chatId, userId, date, delta, createdAt })` удалить SQL upsert в `daily_counts`.
2. Оставить только вставку в `daily_adds` (как сейчас уже делается второй операцией).
3. Возвращаемое значение `count` больше нельзя брать из `daily_counts RETURNING count`:
   - после вставки в `daily_adds` вычислять total через `getTotalForUserDateV2(userId, date)`;
   - возвращать это значение как текущий total за день.

Важно:
- Логика `resolveWriteChatId(chatId, userId)` станет не нужна для записи (в `daily_adds` нет `chat_id`).
- Проверить, что внешние вызовы `addCount()` не ожидают старую семантику "count из daily_counts".

### Шаг 2. Очистить мёртвый код вокруг `daily_counts`

Файл: `src/db.js`

Проверить и удалить/упростить:
1. Комментарии и участки кода, привязанные к "каноническому chat_id для daily_counts".
2. Функции, которые нужны только для старой модели хранения дня одним числом (если после шага 1 они не используются).

### Шаг 3. Прогнать регрессию

Минимум:
1. `npm test`
2. Проверить руками сценарии:
   - add в боте;
   - add через WebApp;
   - status/records/history после add.

Критерий готовности:
- Нигде в runtime нет `SELECT/INSERT/UPDATE/DELETE` к `daily_counts`.

### Шаг 4. Удалить таблицу из схемы

Файл: `src/db.js`

В `initDb()`:
1. Удалить `CREATE TABLE IF NOT EXISTS daily_counts (...)`.
2. Удалить связанный индекс/ограничения (если останутся).

SQL миграция:
```sql
DROP TABLE IF EXISTS daily_counts;
```

### Шаг 5. Пост-проверка

1. Убедиться, что новый деплой поднимается с чистой БД и с существующей БД.
2. Убедиться, что `status/records/history` совпадают по значениям до/после релиза на контрольных пользователях.

---

## Пример SQL на удаление (после backup)

```sql
-- Этап 1: можно после cleanup миграционного кода
DROP TABLE IF EXISTS migration_flags;
DROP TABLE IF EXISTS records;
DROP TABLE IF EXISTS user_records;

-- Этап 2: только после отключения legacy-flow
DROP TABLE IF EXISTS daily_counts;
DROP TABLE IF EXISTS api_tokens;
```
