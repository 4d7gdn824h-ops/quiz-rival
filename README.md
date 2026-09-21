# QuizRival

Working name (easy to rename). Tagline: **two kids, one quiz, timer, winner.**

Sibling live challenge with hardcoded demo packs **plus** a homework-scan path: photograph tonight’s worksheet, confirm the notes, generate a rivalry pack. No auth or Stripe.

## Run locally

```bash
npm install
npm run dev
```

Two phones on the same Wi-Fi, or **two browser windows** (even in one profile). Each tab keeps its own player in `sessionStorage`, so Create in one window and Join in the other works.

## Create / Join flow

1. **Create room (host)** — enter a display name, pick a pack (`Chłopi (PL)`, `Warm-up (EN)`, or **Tonight’s pack** after a scan), pick variant **A** or **B**, tap **Create room**. You get a **4-letter code**.
2. **Join room** — sibling enters the same name field + the 4-letter code, tap **Join room**.
3. Host taps **Start**. Every question has a shared **25 second** countdown (`QUESTION_SECONDS` in `src/lib/constants.ts`).
4. Each device answers independently. The live scoreboard updates; student screens never show keys or English parent hints.
5. After the last question: **winner screen**. Host taps **Rematch** (same room, switches A↔B and reshuffles).
6. Parents can open `/parent/key` (also linked from the host winner screen) for keys + English hints.

## Homework scan (scan → play)

Create room stays the first-fold CTA. Directly under it: a **Photo/PDF drop zone**.

Flow: **Photo/PDF → “Reading…” → confirm topics → Generate tiny path → Create room / Rematch**.

1. Drop or pick a photo/PDF (or **Demo worksheet** for the hardcoded Chłopi fixture). The card shows **Reading…** then opens Confirm. No keys on this path.
2. Confirm is a **checklist** of detected topics and notes. Uncheck junk (name blanks, signatures, answers you don’t want quizzed). Primary CTA: **Generate tiny path**.
3. The new pack uses the **same TinyPath** component as built-in Chłopi — home, lobby, rematch. Host picks Tonight’s pack + A/B and Create/Join as usual.

Student APIs (`/api/rooms`, `/api/packs`, generate/extract responses) **strip** `correctOptionId` / `parentHint`. Keys exist only on `/parent/key`.

Writing-coach generalization (essay wizard for a scanned prompt) is deferred; `/write` remains the hardcoded Chłopi scaffold.

### Fixture mode (no API key)

If `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` are unset, extract does **not** call a model. It loads the Chłopi demo worksheet:

- Notes: `src/data/fixtures/chlopi-worksheet.json`
- Preview image: `public/fixtures/chlopi-worksheet.svg` (and `.png`) — open `/fixtures/chlopi-worksheet.svg` in the browser
- Home / `/homework` → **Demo worksheet** → confirm checklist → **Generate tiny path** → **Create room**

Generate in fixture mode clones the built-in Chłopi questions into a new pack id so the demo is high quality without keys.

### With a vision key

Copy `.env.example` to `.env.local` and set **one** of:

```bash
OPENAI_API_KEY=sk-...          # preferred when set (images). gpt-4o-mini by default
ANTHROPIC_API_KEY=sk-ant-...   # used if OpenAI is unset; required for PDF document blocks
```

Restart `npm run dev`. Photos go through vision and return structured notes. PDFs: Anthropic document blocks (OpenAI vision here is images-only — photograph the page or set the Anthropic key). After confirm, generate asks the same provider for a 3–5 level MC pack; if that call fails it falls back to a deterministic pack from the kept facts.

`GET /api/homework/status` reports `{ mode: "openai" | "anthropic" | "fixture" }`.

Generated packs live in the same Node process as in-memory rooms (about 6 hours). `npm run dev` restart clears them — scan again.

## Writing coach (`/write`)

Scaffold for the Klasa 8 *Chłopi* problem question (~100 words). **No auto-full-essay button.** A later slice can load a scanned essay prompt into this same wizard.
- **Podpowiedź** still reveals one sample sentence to adapt
- Parent English notes stay behind **Pokaż wskazówki dla rodzica (EN)**
- Persistent **Czytaj** opens the source sheet for the active prompt (Chłopi motifs, or scan facts/topics). Dismiss returns to the same step with the draft intact
- **Na głos** is still browser `speechSynthesis` (no paid TTS)

## Quiz play UX

- Each question card has **Czytaj** (Polish packs) or **Read** (English warm-up). It reads the stem, plus options when they are short. Same Web Speech API; **Stop** cancels. Prefers `pl-PL` or `en-US`/`en-GB` voices, then the default.

Short-answer worksheet items were converted to multiple choice so auto-score is reliable.

## Realtime: local fallback vs Supabase

`npm run dev` works **without** any cloud keys.

- **Default:** in-memory room store in the Next.js server + polling (~450ms) and Server-Sent Events. Two phones talking to the **same** `npm run dev` process can play. Two tabs in one browser work the same way.
- **Limitation:** the memory store lives in one Node process. It will not sync across multiple serverless instances (typical production host). Homework packs share that limitation.

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
npm run dev     # demo immediately (fixture homework scan works)
npm run build   # production build
npm start       # serve the build
```

## Tiny levels path

**Chłopi** is a 5-node linear path (lektura → Jagna → wykluczenie → Boryna–Antek → teza). **Warm-up (EN)** has a shorter path (places / science / school bits). A generated Tonight pack has 3–5 nodes from approved topics. Variant B is the rematch wording (same level ids).

- Home (pack selected) and lobby show tappable nodes. Node 1 starts unlocked. Finishing node N unlocks N+1. Already-unlocked nodes stay free to replay.
- Tap a node → room uses `playlistId: "tiny"` plus that `levelId`, so the race is **that micro-round only** (existing `Level` / `getPlayQuestions` seam). Create room without a node still starts the full pack.
- Unlock progress is stored on the device (`quizrival-path-progress`). Both siblings play the same selected node; rivalry strip and live scoring are unchanged.
- **No** skill tree, streaks, hearts, or cosmetics.

## Out of scope (intentionally)

Auth, Stripe, PDF print, paid/cloud TTS (ElevenLabs etc.), STT, Google OAuth, XP shop, stranger matchmaking, chat, streaks, hearts, skill-tree cosmetics.
