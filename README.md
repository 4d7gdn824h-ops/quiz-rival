# QuizRival

Working name (easy to rename). Tagline: **two kids, one quiz, timer, winner.**

Week-1 MVP: a **sibling live challenge** with hardcoded quiz packs. No auth, Stripe, uploads, PDF, or voice.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) on two phones on the same Wi-Fi, or two browser windows / profiles on one computer.

## Create / Join flow

1. **Create room (host)** — enter a display name, pick a pack (`Chłopi (PL)` or `Warm-up (EN)`), pick variant **A** or **B**, tap **Create room**. You get a **4-letter code**.
2. **Join room** — sibling enters the same name field + the 4-letter code, tap **Join room**.
3. Host taps **Start**. Every question has a shared **25 second** countdown (`QUESTION_SECONDS` in `src/lib/constants.ts`).
4. Each device answers independently. The live scoreboard updates; student screens never show keys or English parent hints.
5. After the last question: **winner screen**. Host taps **Rematch** (same room, switches A↔B and reshuffles).
6. Parents can open `/parent/key` (also linked from the host winner screen) for keys + English hints.

Short-answer worksheet items were converted to multiple choice so auto-score is reliable.

## Realtime: local fallback vs Supabase

`npm run dev` works **without** any cloud keys.

- **Default:** in-memory room store in the Next.js server + polling (~450ms) and Server-Sent Events. Two phones talking to the **same** `npm run dev` process can play. Two tabs in one browser work the same way.
- **Limitation:** the memory store lives in one Node process. It will not sync across multiple serverless instances (typical production host).

### Plug in Supabase

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor (creates `rooms`, `players`, `answers` + open RLS for this no-auth MVP).
3. Copy `.env.example` to `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

4. Restart `npm run dev`. The API uses the Supabase tables when both env vars are present (`GET /api/health` or `GET /api/rooms` reports `"store": "supabase"`).

Game logic (scoring, hiding keys) always runs on the server. Clients only receive public question text + live scores.

## Scripts

```bash
npm run dev     # demo immediately
npm run build   # production build
npm start       # serve the build
```

## Out of scope (intentionally)

Auth, Stripe, file upload / vision, PDF print, voice TTS/STT, Google OAuth, XP shop, stranger matchmaking, chat.
