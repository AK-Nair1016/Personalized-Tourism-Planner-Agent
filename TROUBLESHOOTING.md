# VibeTrip Troubleshooting and Fix History

This document records the issues encountered during full-flow testing, their root causes, and the implemented fixes.

## 1) Backend startup failed: `Missing GROQ_API_KEY`

### Symptom
- Backend crashed on startup with:
- `Error: Missing GROQ_API_KEY environment variable. Set GROQ_API_KEY before starting the backend.`

### Root Cause
- `groq.ts` read `process.env.GROQ_API_KEY` before env loading was guaranteed.
- Import order made this intermittent depending on how server was started.

### Fix
- Added centralized env bootstrap:
- `backend/src/lib/env.ts`
- `loadEnv()` now tries:
- `process.cwd()/.env`
- `backend/.env` (stable fallback)
- Wired env loading before reading vars in:
- `backend/src/lib/groq.ts`
- `backend/src/lib/prisma.ts`

### Verify
- Run:
- `cd backend && npm run dev`
- Expected: server starts without `Missing GROQ_API_KEY`.

---

## 2) Generate endpoint rejected valid time input

### Symptom
- `POST /api/itinerary/generate` returned `400` with:
- `Arrival and departure time is required`
- even when both times were present.

### Root Cause
- Validation bug:
- `if(!arrivalTime || departureTime)` incorrectly treated any truthy `departureTime` as invalid.

### Fix
- Updated validation in:
- `backend/src/middleware/validate.ts`
- Correct time validation:
- `if (!arrivalTime || !departureTime)`
- Also fixed:
- `firstVisit` required check
- `city` required check

### Verify
- Valid payload with both times should pass middleware.
- Missing either time should return `400`.

---

## 3) Frontend compile errors due to prop mismatches

### Symptom
- Frontend build failed with:
- missing `onDone` prop for `Loading`
- extra `itinerary` prop passed to `Itinerary` interface mismatch

### Root Cause
- `App.tsx` and screen prop interfaces were out of sync.

### Fix
- `frontend/src/screens/Loading.tsx`
- `onDone` made optional and guarded in `useEffect`.
- `frontend/src/screens/Itinerary.tsx`
- Added `itinerary` prop to interface.

### Verify
- `cd frontend && npm run build` passes.

---

## 4) Itinerary JSON not shown on final screen

### Symptom
- Final screen only showed placeholder content; generated JSON was not visible.

### Root Cause
- Itinerary screen did not render API response payload.

### Fix
- Added raw JSON block in:
- `frontend/src/screens/Itinerary.tsx`
- Added style for readable output in:
- `frontend/src/screens/Itinerary.module.css`

### Verify
- After successful generate call, final screen shows JSON in `Raw itinerary JSON` section.

---

## 5) Model decommission error from Groq

### Symptom
- Agent calls failed with:
- `model_decommissioned` for older model IDs.

### Root Cause
- Hardcoded model names in agents became stale.

### Fix
- Centralized model configuration:
- `backend/src/lib/groq.ts`
- All agents now use shared `GROQ_MODEL`.
- Default model is now configurable via env:
- `GROQ_MODEL=...`

### Verify
- No `model_decommissioned` errors in pipeline logs.

---

## 6) Token limit failures (`413`, TPM exceeded)

### Symptom
- Pipeline failed at agent stages with:
- `Request too large ... tokens per minute (TPM)...`
- `providerStatusCode: 413`, `providerErrorCode: rate_limit_exceeded`, `providerErrorType: tokens`

### Root Cause
- Prompt payloads were too large:
- full attraction objects
- pretty-printed JSON
- heavy agent calls running together

### Fix
- Added prompt compaction utilities:
- `backend/src/agents/promptData.ts`
- Trimmed and compacted payloads for all agents.
- Added completion token caps per agent request.
- Updated planner pipeline:
- `backend/src/graph/plannerGraph.ts`
- heavy stages run sequentially (`vibe -> budget -> logistics`)
- attraction list trimmed before agent calls
- automatic retry with smaller attraction subset on token-limit errors
- new env controls:
- `AGENT_ATTRACTION_LIMIT` (default `30`)
- `AGENT_RETRY_ATTRACTION_LIMIT` (default `12`)

### Verify
- Pipeline should no longer fail with TPM errors under normal city payload size.
- If limit still hits, reduce env values further (example: `12` and `5`).

---

## 7) Pipeline logs were noisy and hard to read

### Symptom
- Errors were long raw payload dumps, hard to scan quickly.

### Root Cause
- No normalized error formatting and parallel failures spammed logs.

### Fix
- Improved structured pipeline logging in:
- `backend/src/graph/plannerGraph.ts`
- stage-level `start/success/error`
- provider error normalization (`status/code/type/message`)
- message truncation for readability
- centralized error payload formatting in:
- `backend/src/middleware/errorHandler.ts`
- nested/original errors are normalized, concise, and request-scoped

### Verify
- Logs now show concise stage-local failures with `requestId` and actionable fields.

---

## 8) PostgreSQL SSL warning spam

### Symptom
- Warning seen at runtime:
- SSL mode alias deprecation (`prefer`, `require`, `verify-ca`)

### Root Cause
- Connection URL ssl mode aliases trigger `pg` compatibility warning.

### Fix
- Normalized DB URL at startup in:
- `backend/src/lib/prisma.ts`
- For deprecated aliases and no explicit compatibility flag:
- force `sslmode=verify-full` to keep secure behavior explicit.

### Verify
- Warning should disappear for affected URLs.

---

## Recommended `.env` additions (backend)

Use these as a safe baseline for current pipeline behavior:

```env
GROQ_MODEL=llama-3.1-8b-instant
AGENT_ATTRACTION_LIMIT=20
AGENT_RETRY_ATTRACTION_LIMIT=8
```

If token-limit errors continue, lower to:

```env
AGENT_ATTRACTION_LIMIT=12
AGENT_RETRY_ATTRACTION_LIMIT=5
```

---

## Quick Health Check Commands

```bash
# Backend type-check
cd backend && npx tsc --noEmit

# Frontend build check
cd frontend && npm run build

# Run backend
cd backend && npm run dev
```

