# API v2 — анализ текущего API и утверждённая спецификация v2

Документ анализирует текущее HTTP API и фиксирует спецификацию API v2 в соответствии со схемой БД v2 и документом Academy.

**Статус:** все предложенные решения утверждены; документ является **финальной спецификацией** для реализации API v2. Раздел 5 и сводка в §6 — обязательная основа для реализации.

**Базовый путь API v2:** префикс `/api/v2/`. Эндпоинты:

| Метод | Путь |
|-------|------|
| POST | /api/v2/auth |
| POST | /api/v2/add |
| GET | /api/v2/status?chat_id=...&date=... |
| GET | /api/v2/records?chat_id=... |
| GET | /api/v2/history?user_id=... |
| GET | /api/v2/approaches?date=... |
| PATCH | /api/v2/approaches/:id |
| DELETE | /api/v2/approaches/:id |

---

## 1. Текущее API (обзор)

**Базовый URL:** один домен с бэкендом; статика WebApp и API на одном сервере (Express). Префикса `/api` в путях нет — эндпоинты корневые: `/health`, `/add`, `/status`, `/records`, `/history`.

**Аутентификация:** заголовок `Authorization: Bearer <token>`. Токен выдаётся ботом (при `/start` в чате или через кнопку WebApp); в БД хранится в `api_tokens`, по токену определяется `chat_id`. Все запросы в текущем API привязаны к **чату**: `req.chatId` задаётся middleware и дальше используется во всех эндпоинтах.

**Формат:** JSON, даты `YYYY-MM-DD`, ошибки — `{ "error": "message" }`, статус 4xx/5xx.

---

## 2. Текущие эндпоинты (кратко)

| Метод | Путь | Назначение | Зависимости от схемы |
|-------|------|------------|-----------------------|
| GET | /health | Проверка живости | Нет |
| POST | /add | Добавить отжимания за день | chat_id (из токена), user_id, delta, date; пишет в daily_counts, возвращает total; опционально user для upsert |
| GET | /status | Статус за дату (лидерборд) | chat_id; getStatusByDate(chatId, date) |
| GET | /records | Рекорды участников чата | chat_id; getRecordsByChat(chatId) |
| GET | /history | История пользователя по дням | chat_id, user_id (query); getUserHistory(chatId, userId); в ответе chat_id |

**Дополнительно:** после POST /add бот может отправить сообщение в чат (notifyAddInChat) — используется `req.chatId` и BOT_TOKEN.

---

## 3. Что опирается на текущую схему и бота

- **Токен → chat_id:** авторизация через `api_tokens`; в v2 таблицы нет, привязка только к user.
- **POST /add:** вызывает `addCount({ chatId, userId, date, delta })` — запись в `daily_counts` (одна строка на день, обновление count). В v2 запись в `daily_adds` (несколько строк на день), без chat_id; рекорды считаются из daily_adds.
- **GET /status, /records:** данные по чату (участники чата, лидерборд). В v2 «участники чата» = `shared_chats` по chat_id; сами данные — из `daily_adds` по user_id. Для статуса/рекордов по чату в v2 по‑прежнему нужен chat_id, но способ его передачи поменяется (не из токена).
- **GET /history:** привязан к chat_id (getUserHistory(chatId, userId)); в ответе есть `chat_id`. В v2 история пользователя не зависит от чата — только user_id; chat_id в ответе не нужен для «моя история».
- **Поля пользователя:** в ответах есть first_name, last_name (из users или из тела запроса). В v2 в users только username; отображаемое имя = username или «User {user_id}».
- **Рекорды:** из таблицы user_records (max_add, record_date). В v2 рекорды считаются из daily_adds (WHERE migrated = FALSE); отдельной таблицы нет.
- **Нет эндпоинтов:** список подходов за день, редактирование подхода, удаление подхода. В Academy и db-schema-v2 заложены GET /approaches, PATCH /approaches/:id, DELETE /approaches/:id.

---

## 4. Проблемы и разрывы относительно v2

1. **Авторизация:** текущая — по токену, привязанному к chat_id. В v2 — по пользователю (user_id); механизм в db-schema-v2 предложен: initData → JWT с user_id. Текущий middleware и все эндпоинты завязаны на req.chatId; в v2 нужен req.userId (из JWT или сессии).
2. **POST /add:** пишет в daily_counts одним числом за день; не возвращает id подхода. В v2 нужно писать в daily_adds (одна или несколько строк при add 5 10 15), возвращать созданные подходы (id, count, date, created_at) и соблюдать ограничения (count 1–1000, date <= today).
3. **Статус и рекорды по чату:** сейчас chat_id берётся из токена. В v2 токена нет — chat_id для «статус в этом чате» / «рекорды в этом чате» нужно передавать явно (query или body), с проверкой, что пользователь в этом чате есть в shared_chats (или что чат «его»).
4. **История:** сейчас getUserHistory(chatId, userId) и в ответе chat_id. В v2 история только по user_id (агрегат по daily_adds); chat_id из ответа убрать; доступ — только к своему user_id или к пользователям, видимым в выбранном чате (если решим показывать историю других участников чата).
5. **Форматы ответов:** first_name, last_name в ответах — убрать или заменить на одно поле (username или display_name). Рекорды сейчас { max_add, record_date }; в v2 считать из daily_adds (лучший подход, лучший день) — формат можно оставить или расширить.
6. **Нет CRUD по подходам:** нет GET списка подходов, PATCH и DELETE подхода — в v2 они нужны для редактирования/удаления (Academy, db-schema-v2).
7. **Уведомление в чат (notifyAddInChat):** использует chat_id и BOT_TOKEN. В v2 при «только user» непонятно, в какой чат слать уведомление; можно оставить опционально (например, если в запросе передан chat_id для уведомления) или убрать из API.

---

## 5. Утверждённая спецификация: решения по всем проблемам API

Ниже — по каждой проблеме из §4 зафиксировано утверждённое решение (спецификация для реализации).

### 5.1 Авторизация (токен → chat_id → нет в v2)

**Проблема:** Сейчас Bearer-токен из api_tokens даёт chat_id; в v2 таблицы api_tokens нет, нужна привязка к user_id.

**Утверждённое решение:**

1. **Точка входа в API v2:** эндпоинт `POST /api/v2/auth`. Тело: `{ "init_data": "<Telegram WebApp initData>" }`. Сервер проверяет подпись initData по правилам Telegram WebApp (HMAC-SHA256, секрет — секрет от Bot API / BotFather; см. [Validation of data received via the Mini App](https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app)). Извлекает из payload объект `user`, берёт `user.id` как user_id и `user.username` как username (может быть пустым/null; в БД хранить как есть). При необходимости создаёт/обновляет запись в `users` (user_id, username, updated_at; при первом INSERT — created_at = NOW()). В ответ отдаёт JWT с payload `{ user_id, exp }` (подписанный секретом сервера).
2. **Все остальные запросы v2:** заголовок `Authorization: Bearer <jwt>`. Middleware проверяет JWT, кладёт `req.userId` (из payload). Chat_id из авторизации не используется.
3. **Обратная совместимость:** старый эндпоинт с токеном по chat_id остаётся под v1 до перехода клиентов на v2; после перехода его можно отключить.

**Детали реализации auth:** алгоритм JWT — HS256; секрет сервера — переменная окружения (например `JWT_SECRET`); срок жизни JWT — например 30 дней (значение exp в payload). Ответ при успехе: `200 OK`, тело `{ "token": "<jwt>", "user_id": <number> }`.

---

### 5.2 POST /add (одно число за день → подходы в daily_adds)

**Проблема:** Сейчас один delta пишется в daily_counts, нет id подхода; в v2 нужны строки в daily_adds с ограничениями 1–1000 и date ≤ today.

**Утверждённое решение:**

1. **Контракт:** `POST /api/v2/add`. Тело: `{ "date": "YYYY-MM-DD" }` (опционально, по умолчанию сегодня), `"counts": [ 10, 20, 5 ]` — один подход или массив (как в боте add 5 10 15). Либо один параметр `"count": 10` для одного подхода. user_id не в теле — только из JWT (`req.userId`). Должен быть указан либо один `count` (число 1–1000), либо непустой массив `counts` (каждый элемент 1–1000); если ни того ни другого нет или `counts` пустой — **400** с сообщением вроде «укажите count или непустой counts». **Приоритет:** если передан непустой `counts`, используются только он (поле `count` игнорируется); иначе используется `count`.
2. **Валидация:** каждый count от 1 до 1000; date <= CURRENT_DATE; при нарушении — 400 с текстом ошибки. **Лимит:** не более 100 подходов в одном запросе (длина `counts` или 1 при `count`); при превышении — 400.
3. **Логика:** для каждого значения из counts вставить строку в `daily_adds` (user_id, date, count, created_at = NOW(), migrated = FALSE). При необходимости перед вставкой создаём пользователя в `users` (если ещё не было): INSERT по user_id из JWT с **username = NULL** (username обновляется только при POST /auth с initData).
4. **Ответ:** `201 Created`, тело `{ "approaches": [ { "id", "user_id", "date", "count", "created_at" }, ... ], "total": 35 }` — созданные подходы и сумма за день (SUM по daily_adds по этому user_id и date).
5. add полностью переходит на daily_adds и возвращает id подходов для последующего редактирования/удаления.

---

### 5.3 Статус и рекорды по чату (chat_id не из токена)

**Проблема:** В v2 токен не привязан к чату; для «статус в этом чате» и «рекорды в этом чате» нужен chat_id откуда-то ещё.

**Утверждённое решение:**

1. **Явная передача chat_id и даты (status):** GET /api/v2/status принимает **обязательный** query-параметр `chat_id` и **опциональный** `date` (формат YYYY-MM-DD; по умолчанию — сегодня, т.е. CURRENT_DATE на сервере). GET /api/v2/records принимает **обязательный** query-параметр `chat_id`. Чат, для которого запрашиваем лидерборд/рекорды (например, выбранный в WebApp).
2. **Проверка доступа:** перед выдачей данных проверять, что `req.userId` входит в участников этого чата: `SELECT 1 FROM shared_chats WHERE chat_id = ? AND user_id = ?`. Если нет — 403 Forbidden («нет доступа к этому чату»).
3. **Данные:** участники чата = `SELECT user_id FROM shared_chats WHERE chat_id = ?`. Статус за дату = для этих user_id SUM(count) по date из daily_adds, отсортировать по убыванию суммы. Рекорды = для этих user_id из daily_adds (migrated = FALSE) лучший подход и лучший день; **порядок сортировки:** по убыванию best_day_total, при равенстве — по убыванию best_approach, затем по user_id.
4. **Формат ответа:** GET /api/v2/status — `200 OK`, тело `{ "date": "YYYY-MM-DD", "rows": [ { "user_id", "display_name", "total" }, ... ] }` (rows отсортированы по total по убыванию). GET /api/v2/records — `200 OK`, тело `{ "rows": [ { "user_id", "display_name", "best_approach", "best_day_total", "best_day_date" }, ... ] }` (порядок по §5.3 п.3).
5. **Источник chat_id для клиента:** при открытии WebApp из бота в URL/параметрах передаётся chat_id. WebApp сохраняет его и подставляет в запросы к /api/v2/status и /api/v2/records. **В v2.0 эндпоинт «мои чаты» не реализуем** — chat_id клиент получает только из URL/параметров бота при открытии WebApp. **Отсутствующий обязательный параметр** (chat_id для status/records) — **400**.

---

### 5.4 История (без chat_id, только по user_id)

**Проблема:** Сейчас история привязана к chat_id и в ответе есть chat_id; в v2 история глобальная по user_id.

**Утверждённое решение:**

1. **Кого показываем:** GET /api/v2/history принимает опциональный query `user_id`. Если не передан — подставляется req.userId (запрос «своей» истории). Если передан и не равен req.userId — 403. Расширение «история участников чата» при необходимости — позже (chat_id в query и проверка shared_chats).
2. **Данные:** из daily_adds по этому user_id: `SUM(count) GROUP BY date`, отсортировать по date. Формат ответа: `{ "user_id": 456, "days": { "2026-01-26": 40, "2026-01-27": 100 } }` — без chat_id.

---

### 5.5 Форматы ответов (first_name, last_name → username / display_name)

**Проблема:** В ответах есть first_name, last_name; в v2 в users только username.

**Утверждённое решение:**

1. **Единое поле для отображаемого имени:** во всех ответах v2, где фигурирует пользователь (status, records, подходы и т.д.), отдаём поле `display_name`: значение `username` из users, либо при отсутствии — `"User " + user_id`. first_name, last_name не отдаём.
2. В ответах можно дополнительно отдавать `username` (может быть null); `display_name` при этом всегда заполнен по правилу выше.
3. **Рекорды:** формат `{ user_id, display_name, best_approach, best_day_total, best_day_date }` (или сохраняем имена max_add/record_count/record_date с новым смыслом: лучший разовый подход, сумма в лучший день, дата лучшего дня). Данные считаем из daily_adds (migrated = FALSE).
4. **Форматы даты и времени в ответах v2:** поле `date` — всегда **YYYY-MM-DD**; поле `created_at` — **ISO 8601** (с суффиксом Z или offset, например UTC). Сервер/БД работают в единой таймзоне (рекомендуется UTC).

---

### 5.6 CRUD по подходам (список, редактирование, удаление)

**Проблема:** Нет эндпоинтов для списка подходов и изменения/удаления по id.

**Утверждённое решение:**

1. **GET /api/v2/approaches** — список подходов. Query: `user_id` (только свой — из JWT, параметр можно не передавать), `date` (обязательно, YYYY-MM-DD), опционально `date_to` (YYYY-MM-DD). Диапазон **[date, date_to] включительно**; если `date_to` не передан — один день (date). При `date_to` < `date` — 400. Отсутствие обязательного `date` — **400**. **Лимит диапазона:** не более 365 дней; при переданном date_to и (date_to − date) > 365 — 400. Ответ GET /approaches: массив `{ id, user_id, date, count, created_at, migrated }`, сортировка по created_at. Права: только свой user_id.
2. **PATCH /api/v2/approaches/:id** — изменить количество в подходе. Тело: `{ "count": 50 }`. Валидация: 1 ≤ count ≤ 1000. Найти подход по id; если не найден — 404; если approach.user_id !== req.userId — 403. UPDATE daily_adds SET count = ? WHERE id = ?. **Ответ:** `200 OK`, тело `{ "approach": { id, user_id, date, count, created_at }, "total": N }` — обновлённый подход и сумма за этот день (user_id, date).
3. **DELETE /api/v2/approaches/:id** — удалить подход. Найти по id; если approach.user_id !== req.userId — 403. DELETE FROM daily_adds WHERE id = ?. **Ответ:** `200 OK`, тело `{ "total": N }` — сумма за этот день после удаления (чтобы клиент мог обновить UI).
4. Три эндпоинта закрывают сценарии «показать мои подходы за день», «исправить подход», «удалить подход»; права везде — только свой подход.

---

### 5.7 Уведомление в чат (notifyAddInChat)

**Проблема:** Сейчас после POST /add бот шлёт сообщение в чат по chat_id из токена; в v2 chat_id из авторизации нет.

**Утверждённое решение:**

В API v2 уведомление в чат при добавлении **не делаем**. Добавление из WebApp не дублируется в чат. Уведомление в чат остаётся только при добавлении через бота (бот знает chat_id из контекста). Это согласуется с тем, что WebApp привязан к user, не к чату.

---

### 5.8 Ошибки API v2

**Формат тела ошибки:** единый для всех эндпоинтов v2 — `{ "error": "<текст сообщения>" }` (как в v1). HTTP-статус задаёт тип ошибки.

| Код | Когда возвращается |
|-----|---------------------|
| **400** | Ошибка валидации: нет или пустой count/counts в POST /add; неверный формат даты; отсутствующий обязательный query (chat_id для status/records, date для GET /approaches); date_to < date или диапазон > 365 дней в GET /approaches; более 100 подходов в POST /add; count вне 1–1000; date в будущем и т.п. |
| **401** | Нет заголовка Authorization или JWT невалидный/истёк (для эндпоинтов, требующих авторизации). Для POST /auth — невалидный или поддельный initData (проверка по правилам Telegram WebApp, см. §5.1). |
| **403** | Доступ запрещён: запрос чужого user_id (GET /history, GET /approaches); запрос подхода другого пользователя (PATCH/DELETE /approaches/:id); запрос status/records для чата, в котором req.userId не состоит (shared_chats). |
| **404** | Ресурс не найден: подход с указанным id не существует (PATCH/DELETE /approaches/:id). |

---

## 6. Сводка утверждённой спецификации

| Проблема | Утверждённое решение (спецификация) |
|----------|------------------------|
| Авторизация | POST /api/v2/auth с initData → JWT с user_id; все запросы с Bearer JWT → req.userId |
| POST /add | POST /api/v2/add: date (опц.), counts[] или count; запись в daily_adds; ответ: approaches[], total |
| Статус/рекорды по чату | GET /api/v2/status, GET /api/v2/records; query chat_id (обязательный); проверка shared_chats; данные из daily_adds |
| История | GET /api/v2/history; query user_id; только свой; ответ days без chat_id |
| Форматы ответов | display_name (username или "User {user_id}"); без first_name/last_name; рекорды из daily_adds |
| CRUD по подходам | GET /api/v2/approaches (user_id, date); PATCH /api/v2/approaches/:id (count); DELETE /api/v2/approaches/:id; права — только свой подход |
| Уведомление в чат | В API v2 не делаем; уведомление только при добавлении через бота |

---

## 7. Реализация (на основе утверждённой спецификации)

Спецификация утверждена. Рекомендуемый порядок внедрения:

- Базовый путь v2: префикс `/api/v2/`. Точные контракты запрос/ответ для каждого эндпоинта — по разделам 5.1–5.8.
- Порядок внедрения: auth → add → approaches (GET, PATCH, DELETE) → status, records, history с новыми правилами.
- Связь эндпоинтов с БД v2 — в разделе 8 ниже.

---

## 8. Связь эндпоинтов API v2 с функциями БД v2

Каждый эндпоинт v2 опирается на таблицы **users**, **daily_adds** и при необходимости **shared_chats**. Рекорды и итоги считаются только из `daily_adds` (агрегации), без таблиц `user_records` и `records`.

| Эндпоинт | Таблицы | Операции и логика БД |
|----------|---------|----------------------|
| **POST /api/v2/auth** | users | **Чтение/запись:** проверка initData (вне БД). При успехе — upsert в `users` по `user_id` (username, updated_at); при первом появлении — created_at = NOW(). JWT с user_id выдаётся клиенту. |
| **POST /api/v2/add** | users, daily_adds | **Запись:** при необходимости upsert в `users` (user_id, username, updated_at). Для каждого значения из `counts` — INSERT в `daily_adds` (user_id, date, count, created_at = NOW(), migrated = FALSE). **Чтение:** SUM(count) по (user_id, date) из `daily_adds` для поля `total` в ответе. |
| **GET /api/v2/status** | shared_chats, daily_adds, users | **Чтение:** 1) Проверка доступа: `SELECT 1 FROM shared_chats WHERE chat_id = ? AND user_id = ?` (req.userId). 2) Участники чата: `SELECT user_id FROM shared_chats WHERE chat_id = ?`. 3) По этим user_id и переданной дате — из `daily_adds` SUM(count) GROUP BY user_id за дату; сортировка по убыванию. 4) Для отображения имён — username из `users` (или "User " || user_id). |
| **GET /api/v2/records** | shared_chats, daily_adds, users | **Чтение:** 1) Проверка доступа: как у status (shared_chats). 2) Участники чата: user_id из shared_chats по chat_id. 3) По этим user_id из `daily_adds` WHERE migrated = FALSE: лучший подход = MAX(count); лучший день = SUM(count) GROUP BY date, взять дату и сумму с максимальной суммой. 4) display_name из users. |
| **GET /api/v2/history** | daily_adds | **Чтение:** доступ только к своему user_id (req.userId). Из `daily_adds`: SUM(count) GROUP BY date для этого user_id, сортировка по date. Ответ: объект days { "YYYY-MM-DD": total, ... }. |
| **GET /api/v2/approaches** | daily_adds | **Чтение:** фильтр по req.userId (только свой). SELECT из `daily_adds` по user_id и date (и опционально date_to), сортировка по created_at. Возврат полей: id, user_id, date, count, created_at, migrated. |
| **PATCH /api/v2/approaches/:id** | daily_adds | **Чтение:** SELECT по id; проверка approach.user_id = req.userId (иначе 403). **Запись:** UPDATE `daily_adds` SET count = ? WHERE id = ? (и проверка 1 ≤ count ≤ 1000). При необходимости в ответе — total за день: SUM(count) по (user_id, date) из daily_adds. |
| **DELETE /api/v2/approaches/:id** | daily_adds | **Чтение:** SELECT по id; проверка approach.user_id = req.userId (иначе 403). **Запись:** DELETE FROM `daily_adds` WHERE id = ?. Опционально в ответе — total за этот день после удаления: SUM(count) по (user_id, date). |

### Функции БД v2 (рекомендуемые имена при реализации)

- **users:** `upsertUser(userId, username)` — вставка/обновление по user_id (created_at только при INSERT).
- **daily_adds:**  
  - `insertApproaches(userId, date, counts[])` → массив созданных строк { id, user_id, date, count, created_at };  
  - `getTotalForUserDate(userId, date)` → SUM(count);  
  - `getApproachesByUserDate(userId, date, dateTo?)` → список подходов;  
  - `getApproachById(id)` → одна строка или null;  
  - `updateApproachCount(id, userId, count)` → обновить count, проверить user_id;  
  - `deleteApproach(id, userId)` → удалить, проверить user_id.
- **shared_chats:**  
  - `isUserInChat(chatId, userId)` → boolean (проверка доступа);  
  - `getChatUserIds(chatId)` → массив user_id (участники чата).
- **Агрегаты по daily_adds (для status/records):**  
  - `getStatusByDate(chatUserIds, date)` → по списку user_id: SUM(count) по date, с сортировкой;  
  - `getRecordsByChat(chatUserIds)` → по списку user_id из daily_adds WHERE migrated = FALSE: best_approach (MAX(count)), best_day_total и best_day_date (GROUP BY date, взять максимум суммы).
- **История:** `getHistoryByUserId(userId)` → из daily_adds SUM(count) GROUP BY date для user_id.
