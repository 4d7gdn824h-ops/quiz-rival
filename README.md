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

1. **Create room (host)** — enter a display name, pick a pack (`Warm-up (EN)`, or **Tonight’s pack** after a scan), pick variant **A** or **B**, tap **Create room**. You get a **4-letter code**.
2. **Join room** — sibling enters the same name field + the 4-letter code, tap **Join room**.
3. Host taps **Start**. Every question has a shared **25 second** countdown (`QUESTION_SECONDS` in `src/lib/constants.ts`). Either player can tap **Pause** to freeze that clock and lock answers; **Resume** continues the same question without resetting scores.
4. Each device answers independently. The live scoreboard updates; student screens never show keys or English parent hints.
5. After the last question: **winner screen**. Host taps **Rematch** (same room, switches A↔B and reshuffles).
6. Parents can open `/parent/key` (also linked from the host winner screen) for keys + English hints.

## Homework scan (scan → play)

Create room stays the first-fold CTA. Directly under it: a **Photo/PDF drop zone**.

Flow: **add up to 6 photos or PDF pages → loading checklist → the quiz plays** (tiny-path node 1). No topic, grade, or name step. The player name defaults to **You**. Topics and difficulty come from the pages.

1. Drop or pick photos/PDFs (one multi-select), or **Paste lines**, or a **demo worksheet** (Water cycle EN, Los planetas ES). Each page shows a thumbnail with a remove button. A 7th page is refused and the pages already chosen stay. A PDF longer than 6 pages contributes only its first 6 when the tray is empty.
2. **Make the quiz** sends every page in one request. The browser shrinks each image (1600px long edge, then smaller and lower quality) so the JSON body stays under about 4MB. The server rejects a larger body with `body_too_large`.
3. The quiz opens on this phone. Questions come from the page content. Student screens never show answer keys.

Student APIs (`/api/rooms`, `/api/packs`, the scan response) **strip** `correctOptionId` / `parentHint`. Keys exist only on `/parent/key`.

### Fixture mode (no API key)

If `XAI_API_KEY` is unset, a photo is not sent to a model. Paste the page or pick a demo worksheet instead.

**Without a key — prove any topic / any language:**

1. Home or `/homework` → pick a demo: **Water cycle (EN)** or **Los planetas (ES)** → the quiz starts.
2. Or **Paste lines** → **Make the quiz**. A photo without a key offers **Paste text instead**.
3. The pack is a deterministic 3–5 node path from the page topics and facts. Stems follow pl / en / es / fr when we know the language.

Fixtures:

- `src/data/fixtures/water-cycle-worksheet.json` + `public/fixtures/water-cycle-worksheet.svg`
- `src/data/fixtures/planetas-worksheet.json` + `public/fixtures/planetas-worksheet.svg`

### With a vision key

Copy `.env.example` to `.env.local` and set the server-only key (never `NEXT_PUBLIC_`):

```bash
XAI_API_KEY=...
# XAI_MODEL=grok-4.20-0309-non-reasoning
```

Restart `npm run dev`. All pages go to xAI in one request and come back as notes **in the worksheet language** (BCP-47 / ISO — Spanish stays `es`, French `fr`, etc.; we do not coerce to pl/en). The file is not written to disk and is not uploaded to xAI file storage. The same request then asks xAI for a 3–5 level multiple-choice pack from those notes; if that call fails it falls back to a deterministic pack from the facts. Difficulty is inferred. The student is not asked to confirm topics.

`GET /api/homework/status` reports `{ mode: "xai" | "fixture", vision, fixtures }`.

The original photo, PDF, or pasted upload is not kept after that request. A generated quiz can live in the same Node process as in-memory rooms (about 6 hours) so one server can host a room. `npm run dev` restart clears it — scan again. On Vercel, practice on one phone without waiting for that memory.

## Quiz play UX

- Each question card has **Czytaj** (Polish packs) or **Read** (other languages). It reads the stem, plus options when they are short. Same Web Speech API; **Stop** cancels. Prefers a matching voice for the pack language (pl-PL, en-US, es-ES, fr-FR, …), then the default.
- **Pause** sits on every question (variants A and B, both seats). It freezes the shared timer, blocks answers, and shows **Paused** with **Resume**. Leave room stays available. Progress and scores stay put.

Short-answer worksheet items were converted to multiple choice so auto-score is reliable.

## Realtime: local fallback vs Supabase

`npm run dev` works **without** any cloud keys.

- **Default:** in-memory room store in the Next.js server + polling (~450ms) and Server-Sent Events. Two phones talking to the **same** `npm run dev` process can play. Two tabs in one browser work the same way.
- **Limitation:** the memory store lives in one Node process. It will not sync across multiple serverless instances (typical production host). Homework packs share that limitation.
- **Vercel without Supabase:** Create room and Join room do not dead-end. They offer **pass and play** on one phone (two players, same 25s timer, rivalry strip, winner screen) and a **tiny path** you can play alone. Students still never see answer keys. Demo worksheets and paste work with no Supabase env.

### Plug in Supabase

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor (creates `rooms`, `players`, `answers` + open RLS for this no-auth MVP). Existing projects also need the `paused` and `paused_remaining_ms` alters in that file.
3. Copy `.env.example` to `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

4. Restart `npm run dev`. The API uses the Supabase tables when both env vars are present (`GET /api/health` or `GET /api/rooms` reports `"store": "supabase"`).

Game logic (scoring, hiding keys) always runs on the server. Clients only receive public question text + live scores.

## Deploy on Vercel (Hobby)

Framework preset: **Next.js**.

| Setting | Value |
| --- | --- |
| Install command | `npm install` |
| Build command | `npm run build` |
| Output | Next.js default (do not set a custom output directory) |

Environment variables (Project → Settings → Environment Variables):

| Name | Required | Notes |
| --- | --- | --- |
| `XAI_API_KEY` | No | Server-only. Homework photos and worksheet text are sent to xAI when this is set. **Do not** use `NEXT_PUBLIC_XAI_API_KEY` or any `NEXT_PUBLIC_` AI key. |
| `XAI_MODEL` | No | Defaults to `grok-4.20-0309-non-reasoning` (fast, vision). Reasoning models get `reasoning_effort: "low"`. |
| `XAI_VISION_MODEL` | No | Model for photo reads. Defaults to `XAI_MODEL`. |
| `NEXT_PUBLIC_SUPABASE_URL` | No | Both Supabase vars are required for two-phone rooms on Vercel. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No | Public anon key. Not an AI secret. |

Without Supabase, a reviewer can still test alone: home → demo worksheet or paste → the quiz on this phone. Create room stays the primary button. Scan stays under it.

Uploads are not stored after processing. There are no third-party analytics or ads.

Privacy and support pages: `/privacy`, `/support`. Replace the operator and contact placeholders in `src/lib/site.ts` before a store listing.

## Scripts

```bash
npm run dev     # demo immediately (fixture homework scan works)
npm run build   # production build
npm start       # serve the build
```

## Tiny levels path

**Warm-up (EN)** is a short path (places / science / school bits). A generated Tonight pack has 3–5 nodes from the scanned pages. Variant B is the rematch wording (same level ids).

- Home (pack selected) and lobby show tappable nodes. Node 1 starts unlocked. Finishing node N unlocks N+1. Already-unlocked nodes stay free to replay.
- Tap a node → room uses `playlistId: "tiny"` plus that `levelId`, so the race is **that micro-round only** (existing `Level` / `getPlayQuestions` seam). Create room without a node still starts the full pack.
- Unlock progress is stored on the device (`quizrival-path-progress`). Both siblings play the same selected node; rivalry strip and live scoring are unchanged.
- **No** skill tree, streaks, hearts, or cosmetics.

## Out of scope (intentionally)

Auth, Stripe, PDF print, paid/cloud TTS (ElevenLabs etc.), STT, Google OAuth, XP shop, stranger matchmaking, chat, streaks, hearts, skill-tree cosmetics.
