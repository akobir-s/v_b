# 💀 Funeral for Stupid Decisions

> Похорони своё тупое решение с полными готическими почестями.
> Bury your stupid decision with full gothic honors.

## Скриншоты / Screenshots

- 🪦 Gothic gravestone with epitaph
- 🕯️ Animated funeral ceremony
- 📜 Hilarious eulogies in Russian & English
- 🗑️ Private cemetery per user

## Быстрый старт / Quick Start

### 1. Клонируем / Clone

```bash
git clone <your-repo-url>
cd vibe_coding
```

### 2. Устанавливаем зависимости / Install dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 3. Запуск / Run

Нужно 2 терминала / Need 2 terminals:

**Терминал 1 — Backend (порт 3000):**
```bash
cd backend
npm run dev
```

**Терминал 2 — Frontend (порт 5173):**
```bash
cd frontend
npm run dev
```

### 4. Открой / Open

```
http://localhost:5173
```

## Технологии / Tech Stack

| Layer    | Tech                |
|----------|---------------------|
| Frontend | React + Vite        |
| Styling  | Vanilla CSS (Gothic)|
| Animations | Framer Motion     |
| Backend  | Node.js + Express   |
| Storage  | JSON file           |
| AI       | Gemini (Vertex AI)  |

## API

| Method | Endpoint            | Description              |
|--------|---------------------|--------------------------|
| POST   | `/api/bury`         | Похоронить ошибку        |
| GET    | `/api/graves`       | Мои могилы (по сессии)   |
| DELETE | `/api/graves/:id`   | Удалить могилу           |
| GET    | `/api/health`       | Статус сервера           |

### Admin Endpoints

Выключены, пока не задан `ADMIN_KEY` / Disabled until `ADMIN_KEY` is set:

```bash
curl http://localhost:3000/api/admin/graves -H "X-Admin-Key: $ADMIN_KEY"
curl http://localhost:3000/api/admin/logs   -H "X-Admin-Key: $ADMIN_KEY"
```

## AI (Gemini)

Надгробия пишет Gemini. Без настроек работают шаблоны. /
Gemini writes the gravestones; with nothing configured the static templates are used.

| Variable | Purpose |
|----------|---------|
| `VERTEX_AI_PROJECT` | Google Cloud project → Gemini on **Vertex AI** |
| `VERTEX_AI_LOCATION` | default `us-central1` |
| `GOOGLE_APPLICATION_CREDENTIALS` | path to a service-account JSON with the *Vertex AI User* role (not needed if `gcloud auth application-default login` was run) |
| `GEMINI_API_KEY` | alternative to Vertex: an AI Studio key |
| `GEMINI_MODEL` | default `gemini-2.5-flash` |

Limits (every burial is a paid AI call): `BURY_PER_IP_PER_MINUTE` (6), `BURY_PER_IP_PER_DAY` (60),
`AI_CALLS_PER_DAY` (2000 — after that, templates until midnight UTC). Mistakes are capped at 500 characters.

## На сервере / Production

```bash
# Backend — listens on 127.0.0.1 only; put nginx in front
cd backend
npm ci
PORT=3000 ADMIN_KEY=<long-random> VERTEX_AI_PROJECT=<project> node server.js

# Frontend — build and let nginx serve dist/, proxying /api to the backend
cd frontend
npm ci && npm run build
```

The frontend calls `/api` on its own origin. Set `VITE_API_URL` at build time only if the
API lives on a different host.

## Лицензия / License

MIT — делай что хочешь 💀
