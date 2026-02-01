# API Documentation (Draft)

This document describes a minimal HTTP API that mirrors the bot functionality.
It is intended for a future web app and can be adjusted as needed.

## Base URL

```
https://<your-domain>/api
```

## Authentication

Bearer token, scoped to allowed chat IDs.

Option 1: single token + single chat:
```
API_TOKEN=...
API_CHAT_ID=...
```

Option 2: multiple tokens and chat lists (JSON):
```
API_TOKENS_JSON={"tokenA":[-100123],"tokenB":[-100123,-100456]}
```

Request header:
```
Authorization: Bearer <token>
```

## Conventions

- Dates use `YYYY-MM-DD`.
- All responses are JSON.
- Errors return `{"error": "message"}`.

## Endpoints

### Health

`GET /health`

Response:
```
{ "ok": true }
```

---

### Add push-ups

`POST /add`

Body:
```
{
  "chat_id": 123,
  "user_id": 456,
  "delta": 10,
  "date": "2026-01-28", // optional, defaults to today
  "user": { "id": 456, "username": "alexei", "first_name": "Alexei", "last_name": null } // optional
}
```

Response:
```
{
  "total": 60
}
```

---

### Status (daily leaderboard)

`GET /status`

Query:
```
?chat_id=123&date=2026-01-28
```

Response:
```
{
  "date": "2026-01-28",
  "rows": [
    {
      "user_id": 456,
      "username": "alexeionline",
      "first_name": "Alexei",
      "last_name": null,
      "count": 60
    }
  ]
}
```

---

### Records (max single add)

`GET /records`

Query:
```
?chat_id=123
```

Response:
```
{
  "rows": [
    {
      "user_id": 456,
      "username": "alexeionline",
      "first_name": "Alexei",
      "last_name": null,
      "max_add": 40,
      "record_date": "2026-01-28"
    }
  ]
}
```

---

### Personal history (calendar)

`GET /history`

Query:
```
?chat_id=123&user_id=456
```

Response:
```
{
  "user_id": 456,
  "chat_id": 123,
  "days": {
    "2026-01-26": 40,
    "2026-01-27": 60,
    "2026-01-28": 100
  }
}
```

---

## Notes

- `username` is stored without `@` in DB responses.
- The API should reuse the same DB schema as the bot.
- The bot deletes its own messages after a delay; the API does not.
