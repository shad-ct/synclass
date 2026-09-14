# SynClass

**Real-time interactive classroom & quiz system.** Run live quizzes, polls, and interactive sessions with your class in real time. Attendees join by 6-character room code or QR code — no sign-up or install needed.

## Features

### For hosts (Presenter Command Center)

- **Kahoot-style quizzes** — timed multiple-choice questions with live countdowns, per-question results, a running leaderboard, and a final 3-place podium with confetti
- **Live polling** — create ad-hoc polls, stream results in real time, and close them anytime
- **Confusion meter** — attendees flag when they're lost; the host sees a live aggregate
- **Screen freeze & buzz** — pause everyone's screen or buzz selected/all attendees to grab attention
- **Ad-hoc attendance** — trigger an attendance check and review the acknowledgement log
- **Code/snippet broadcasting** — push text or code snippets to every attendee's device
- **Instant file drops** — upload resources and push them to the room
- **Live attendee roster** — online status, hand-raise notifications (with optional questions), and kick/control tools

### For attendees

- Join with a **6-character room code** or by scanning the **QR code** on the presentation screen
- Custom **avatar** (six styles, shuffle-able) that persists across refreshes
- Answer quizzes, participate in polls, raise hands, flag confusion, and receive broadcast content and pushed files in real time

### Presentation view

- Dedicated projector screen with lobby (QR + physics-floating attendee bubbles), question view with countdown, animated results bars, scoreboard, and podium with confetti rain

## Importing Quiz Sets

You can bulk-import questions into a Quiz Set from the **Quiz Sets** panel → **Import** button. The file is parsed entirely in the browser — nothing is saved until you hit **Save Quiz Set** in the editor.

Supported formats: **JSON** and **CSV**.

---

### JSON format

The preferred format. Supports a named quiz set with full control over every field.

```json
{
  "title": "JavaScript Basics",
  "questions": [
    {
      "text": "What keyword declares a block-scoped variable?",
      "options": ["var", "let", "const", "define"],
      "correctIndex": 1,
      "timeLimit": 20
    },
    {
      "text": "Which method converts JSON to a JavaScript object?",
      "options": ["JSON.stringify()", "JSON.parse()", "JSON.toObject()", "JSON.decode()"],
      "correctIndex": 1,
      "timeLimit": 15
    }
  ]
}
```

**JSON field reference:**

| Field | Type | Required | Notes |
|---|---|---|---|
| `title` | `string` | No | Pre-fills the quiz set name; you can edit it before saving |
| `questions` | `array` | Yes | Array of question objects (min 1) |
| `questions[].text` | `string` | Yes | The question prompt. Also accepted as `"question"` |
| `questions[].options` | `string[]` | Yes | 2–4 answer choices |
| `questions[].correctIndex` | `number` | Yes | 0-based index of the correct option (0 = first option) |
| `questions[].timeLimit` | `number` | No | Seconds per question (default: `20`) |

> **Tip:** You can also pass a bare array of question objects (without a wrapping `title`/`questions` envelope) and the title will default to blank.

---

### CSV format

Good for spreadsheet-based workflows. Each row is one question.

```csv
text,optionA,optionB,optionC,optionD,correctIndex,timeLimit
What is 2 + 2?,1,2,4,8,2,15
What color is the sky?,Red,Blue,Green,Yellow,B,20
Who wrote Hamlet?,Dickens,Shakespeare,Tolstoy,Austen,1,20
```

**CSV field reference:**

| Column | Required | Notes |
|---|---|---|
| `text` | Yes | Question prompt (also accepted as `question`) |
| `optionA` / `optionB` / `optionC` / `optionD` | Yes | Answer choices (at least A & B required) |
| `correctIndex` | Yes | Zero-based number (`0` = A, `1` = B …) **or** letter (`A`, `B`, `C`, `D`) |
| `timeLimit` | No | Seconds; defaults to `20` if omitted |

> **Note:** The first row must be a header row exactly matching the column names above (case-insensitive). CSV does not support setting a quiz title — you'll be prompted to name it in the editor.

---

## Tech stack


| Layer    | Tech                                                       |
| -------- | ---------------------------------------------------------- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, Socket.io-client |
| Backend  | Node.js, Express, Socket.io                                |
| Database | MongoDB (Mongoose)                                         |
| Misc     | boring-avatars, recharts, react-qr-code                    |

## Getting started

### Prerequisites

- Node.js (18+)
- MongoDB (local instance, or a connection string e.g. MongoDB Atlas)

### 1. Backend

```bash
cd server
npm install
cp .env.example .env
npm run dev   # starts on http://localhost:3001 (nodemon)
```

### 2. Frontend

```bash
npm install
npm run dev   # starts on http://localhost:5173
```

Vite proxies `/api` and `/uploads` to `http://localhost:3001` in development, so no env config is required to run locally.

Open http://localhost:5173, create a room, and share the room code (or the QR from the presentation view) with attendees.

## Environment variables

| Variable                      | Where                   | Description                                       | Default                                                                |
| ----------------------------- | ----------------------- | ------------------------------------------------- | ---------------------------------------------------------------------- |
| `VITE_SERVER_URL`             | Frontend (`.env`)       | Backend base URL used by the client in production | `https://synclass.onrender.com` (prod) / `http://localhost:3001` (dev) |
| `MONGO_URI`                   | Backend (`server/.env`) | MongoDB connection string                         | `mongodb://localhost:27017/synclass`                                   |
| `PORT`                        | Backend (`server/.env`) | Server port                                       | `3001`                                                                 |
| `FRONTEND_URL` / `CLIENT_URL` | Backend (`server/.env`) | Allowed CORS origin(s) for the frontend           | `https://synclass.netlify.app`                                         |

## Project structure

```
├── src/                    # React frontend
│   ├── components/         # Host dashboard panels, shared UI
│   ├── pages/              # HostDashboard, JoinSession, AttendeeDashboard, PresentQuiz
│   ├── hooks/              # useSocket, useLocalStorage
│   ├── config.ts           # Server URL resolution
│   ├── socket.ts           # Socket.io client
│   └── types/              # Shared TypeScript types
├── server/                 # Express + Socket.io backend
│   ├── config/             # MongoDB connection
│   ├── models/             # Mongoose models
│   ├── routes/             # REST routes (sessions, resources, quiz)
│   ├── socket/             # Socket.io controller & events
│   └── server.js           # Entry point
├── public/                 # Static assets, favicons, OG image
└── index.html              # App shell + SEO/Open Graph metadata
```

## Scripts

| Command                      | Description                         |
| ---------------------------- | ----------------------------------- |
| `npm run dev`                | Start Vite dev server (frontend)    |
| `npm run build`              | Type-check and build for production |
| `npm run lint`               | Run ESLint                          |
| `npm run preview`            | Preview the production build        |
| `npm run dev` (in `server/`) | Run the backend with nodemon        |

## Deployment

- **Frontend** is a static Vite build, deployable to any static host (e.g. Netlify). `public/_redirects` enables SPA fallback routing (`/* -> /index.html`).
- **Backend** runs on Node.js with MongoDB (e.g. Render + MongoDB Atlas). Set `MONGO_URI` and `FRONTEND_URL` (CORS origin) on the host.

## License

MIT
