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

1. Drop or pick a photo/PDF, **Paste lines**, or a **demo worksheet** (Chłopi PL, Water cycle EN, Los planetas ES). The card shows **Reading…** then opens Confirm. Demos and pasted text do not need a key; a photo does (`XAI_API_KEY`).
2. Confirm is a **checklist** of detected topics and notes. Uncheck junk (name blanks, signatures, answers you don’t want quizzed). You can also paste/edit the page text and set the worksheet language (BCP-47 / ISO, not limited to pl/en). Primary CTA: **Generate tiny path**.
3. The new pack uses the **same TinyPath** component as built-in Chłopi — home, lobby, rematch. Host picks Tonight’s pack + A/B and Create/Join as usual. Quiz content stays in the homework language.

Student APIs (`/api/rooms`, `/api/packs`, generate/extract responses) **strip** `correctOptionId` / `parentHint`. Keys exist only on `/parent/key`.

`/write` coaches any essay prompt (typed or scanned) in the assignment language. **Chłopi** is one built-in example, not the only path.

### Demo mode (no API key)

If `XAI_API_KEY` is unset, the home, homework, and `/write` screens say **AI is not configured**. Extract does **not** call a model and does **not** pretend every upload is Chłopi. `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` are ignored — there is no fallback to those providers.

**Without a key — prove any topic / any language:**

1. Home or `/homework` → pick a demo: **Chłopi (PL)**, **Water cycle (EN)**, or **Los planetas (ES)** → confirm checklist → **Generate tiny path** → **Create room**.
2. Or **Paste lines** (or drop a `.txt` / `.svg` / text PDF) → edit the page in any language → **Use this text** → generate. A photo without a key opens the same paste editor with a notice; it is not replaced by the Chłopi fixture.
3. Generate builds a deterministic 3–5 node TinyPath from the confirmed topics/facts, with stems in pl / en / es / fr when we know the language (other languages keep the original notes and use English stems). The language field on the confirm step is the language of the pack.

Fixtures:

- `src/data/fixtures/chlopi-worksheet.json` + `public/fixtures/chlopi-worksheet.svg`
- `src/data/fixtures/water-cycle-worksheet.json` + `public/fixtures/water-cycle-worksheet.svg`
- `src/data/fixtures/planetas-worksheet.json` + `public/fixtures/planetas-worksheet.svg`

Without a key, Chłopi generate still clones the built-in pack when the confirmed notes are that demo worksheet (or the text is actually about Chłopi). With `XAI_API_KEY` set, generate always asks Grok — including for a Chłopi page — and rejects a pack that switches an unrelated worksheet onto Chłopi.

### With Grok

Copy `.env.example` to `.env.local`:

```bash
XAI_API_KEY=xai-...
# Optional. Both default to grok-4.6 (text and image input).
# XAI_MODEL=grok-4.6
# XAI_VISION_MODEL=grok-4.6
```

Restart `npm run dev`. Photos go through Grok vision and return structured notes **in the worksheet language** (BCP-47 / ISO — Spanish stays `es`, French `fr`, etc.; we do not coerce to pl/en). PDFs and text files are structured by the text model when they have a text layer; a photo-only PDF should be photographed (JPEG, PNG, WebP, or GIF). After confirm, generate asks Grok for a 3–5 level multiple-choice pack in the language you kept, with guided parent hints rather than an answer dump. If that call fails, a deterministic pack is built from the kept facts (the Chłopi clone is only a last resort when the page was the Chłopi demo).

`GET /api/homework/status` reports `{ mode: "xai" | "fixture", configured, vision, model, visionModel, message, fixtures }`.

Generated packs live in the same Node process as in-memory rooms (about 6 hours). `npm run dev` restart clears them — scan again.

## Writing coach (`/write`)

Any essay prompt, any language. Paste the assignment or scan a page, pick a grade band, and start. Grok returns the same steps — plan, thesis, arguments, example, draft, check — in that language. Hints are one sentence to rewrite. There is **no** button that writes the essay.

**Chłopi · pytanie problemowe** is a built-in example (Klasa 8, ~100 words). It does not call Grok. Open it from `/write` or `/write?preset=chlopi`.

Without `XAI_API_KEY`, a custom prompt still opens a local scaffold (Polish, English, Spanish, or French chrome when we know the language) and the screen says AI is not configured.

- The hint control reveals one sample sentence to adapt
- Parent English notes stay behind a parent-only toggle
- **Read / Czytaj / Leer** opens the source sheet for the active prompt. Dismiss returns to the same step with the draft intact
- Read-aloud is still browser `speechSynthesis` (no paid TTS)
- A homework pack that detected an essay prompt links here as `/write?pack=…`

## Quiz play UX

- Each question card has **Czytaj** (Polish packs) or **Read** (other languages). It reads the stem, plus options when they are short. Same Web Speech API; **Stop** cancels. Prefers a matching voice for the pack language (pl-PL, en-US, es-ES, fr-FR, …), then the default.

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
