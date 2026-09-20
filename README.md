# QuizRival

Working name (easy to rename). Tagline: **two kids, one quiz, timer, winner.**

Week-1 MVP: a **sibling live challenge** with hardcoded quiz packs. No auth, Stripe, uploads, PDF, or paid voice APIs.

## Run locally

```bash
npm install
npm run dev
```

Two phones on the same Wi-Fi, or **two browser windows** (even in one profile). Each tab keeps its own player in `sessionStorage`, so Create in one window and Join in the other works.

## Create / Join flow

1. **Create room (host)** — enter a display name, pick a pack (`Chłopi (PL)` or `Warm-up (EN)`), pick variant **A** or **B**, tap **Create room**. You get a **4-letter code**.
2. **Join room** — sibling enters the same name field + the 4-letter code, tap **Join room**.
3. Host taps **Start**. Every question has a shared **25 second** countdown (`QUESTION_SECONDS` in `src/lib/constants.ts`).
4. Each device answers independently. The live scoreboard updates; student screens never show keys or English parent hints.
5. After the last question: **winner screen**. Host taps **Rematch** (same room, switches A↔B and reshuffles).
6. Parents can open `/parent/key` (also linked from the host winner screen) for keys + English hints.

## Writing coach (`/write`)

Homework helper for the Klasa 8 *Chłopi* problem question (~100 words), due 26 September 2026.

- Home page: **Napisz wypracowanie** / Write essay
- Student UI is Polish. Step wizard: question → Tak/Nie/Częściowo → 1–3 themes → her own modern example → sentence boxes (thesis / book link / example / close) with a live word counter → assembled text + **Kopiuj**
- Does **not** dump a finished essay. **Podpowiedź** reveals one sample sentence to adapt
- Parent English coaching notes are hidden until **Pokaż wskazówki dla rodzica (EN)**
- Persistent **Czytaj** (header) opens the *Chłopi* source sheet/overlay: problem question, short lektura facts, and the three motifs (Jagna / wykluczenie / Boryna–Antek). Dismiss (**Zamknij**, backdrop, Escape) returns to the **same step** with the draft intact. Motif notes only — no model essay, no quiz keys.
- **Na głos** (browser Web Speech API, `speechSynthesis`) is the secondary read-aloud: current step, revealed **Podpowiedź** tips, or the assembled final paragraph. Tap **Stop** to cancel. Prefers a `pl-PL` voice; no API keys. If the browser has no speech synthesis, a one-line notice is shown instead.
- No quiz answer keys on this page

## Quiz play UX

- Each question card has **Czytaj** (Polish packs) or **Read** (English warm-up). It reads the stem, plus options when they are short. Same Web Speech API; **Stop** cancels. Prefers `pl-PL` or `en-US`/`en-GB` voices, then the default.

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

## Tiny levels path

**Chłopi** is a 5-node linear path (lektura → Jagna → wykluczenie → Boryna–Antek → teza). **Warm-up (EN)** has a shorter path (places / science / school bits). Variant B is the rematch wording (same level ids).

- Home (pack selected) and lobby show tappable nodes. Node 1 starts unlocked. Finishing node N unlocks N+1. Already-unlocked nodes stay free to replay.
- Tap a node → room uses `playlistId: "tiny"` plus that `levelId`, so the race is **that micro-round only** (existing `Level` / `getPlayQuestions` seam). Create room without a node still starts the full 8-question pack.
- Unlock progress is stored on the device (`quizrival-path-progress`). Both siblings play the same selected node; rivalry strip and live scoring are unchanged.
- **No** skill tree, streaks, hearts, or cosmetics.

## Out of scope (intentionally)

Auth, Stripe, file upload / vision, PDF print, paid/cloud TTS (ElevenLabs etc.), STT, Google OAuth, XP shop, stranger matchmaking, chat, streaks, hearts, skill-tree cosmetics.
