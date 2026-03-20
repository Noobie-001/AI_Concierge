# AI Event Concierge

A local full-stack technical-assignment project that turns a natural-language corporate offsite brief into a structured venue proposal.

## What it includes

- Next.js frontend with a polished single-page dashboard
- API endpoint at `POST /api/proposals`
- OpenAI structured-output integration
- SQLite persistence with refresh-safe search history
- Loading states, current result card, and previous-search cards

## Tech stack

- Next.js 16
- React 19
- OpenAI Node SDK
- SQLite via `better-sqlite3`
- Zod for validation and structured parsing

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Copy the environment template:

```bash
cp .env.example .env.local
```

3. Add your OpenAI API key to `.env.local`:

```bash
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-5-mini
ALLOW_DEMO_MODE=false
```

4. Start the app:

```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000)

## Demo fallback

If you want to test the UI without an API key, set:

```bash
ALLOW_DEMO_MODE=true
```

This keeps the app functional locally, but the real assignment flow should be run with a valid OpenAI key.

## Database persistence

- Local development stores proposals in `data/concierge.db`
- Netlify deploys store proposals in Netlify Blobs
- Refreshing the page keeps prior searches visible
- Each saved record includes the original prompt, generated venue proposal, timestamp, and source mode

## API contract

### `POST /api/proposals`

Request body:

```json
{
  "prompt": "A 10-person leadership retreat in the mountains for 3 days with a $4k budget."
}
```

Response body:

```json
{
  "proposal": {
    "id": 1,
    "prompt": "A 10-person leadership retreat in the mountains for 3 days with a $4k budget.",
    "venueName": "Blue Pine Lodge",
    "location": "Asheville, North Carolina",
    "estimatedCost": "$3,800 - $4,050 total",
    "whyItFits": "Blue Pine Lodge gives your 10-person team a focused mountain retreat setting...",
    "highlights": ["Scenic strategy sessions", "Overnight lodge rooms", "Private breakout areas"],
    "source": "openai",
    "createdAt": "2026-03-18T11:55:00.000Z"
  }
}
```

### `GET /api/proposals`

Returns all saved proposals in reverse chronological order.

## Notes for deployment

- Local development uses SQLite for simplicity and fast setup
- Netlify deploys automatically switch to Netlify Blobs so the app does not rely on a writable local filesystem
- If you want to deploy anywhere other than Netlify, the next easiest upgrade is swapping the database layer to Supabase, PostgreSQL, or MongoDB
