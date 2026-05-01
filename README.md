# Personalized Tourism Planner Agent

An AI-assisted trip planning platform that turns traveler preferences into practical, day-wise itineraries with budget awareness, category diversity, and disruption-aware replanning.

## What This Project Solves

Planning a multi-day trip manually is slow and inconsistent. This project combines deterministic planning logic with LLM reasoning to produce structured itineraries that are:
- personalized to traveler vibe and constraints,
- cost-aware with currency localization,
- operationally safer through retries/fallbacks,
- and extendable for replanning when disruptions happen.

## End-to-End Flow

1. User completes a 4-step profile wizard in the frontend.
2. Frontend sends profile to `POST /api/itinerary/generate`.
3. Backend planner graph executes:
   - attraction fetch + filtering,
   - deterministic budget, clustering, and diversity stages,
   - vibe scoring and reconciliation through LLM agents,
   - fallback generation when LLM output is unavailable/invalid.
4. Itinerary is persisted in PostgreSQL via Prisma.
5. API returns localized costs + execution metadata (`tokensUsed`, fallback/retry info).
6. Frontend renders day tabs, slot cards, cost summary, and map route.

## Tech Stack

- Frontend: React 19, TypeScript, Vite, CSS Modules, React Leaflet
- Backend: Node.js, Express, TypeScript, Prisma ORM, Groq SDK
- Database: PostgreSQL
- Shared Contracts: `@vibetrip/shared` package

## Monorepo Layout

- `frontend/`: traveler UI and API integration
- `backend/`: API, planner graph, agents, processing, persistence
- `shared/`: common TypeScript contracts used by both tiers
- `Docs/`: project documentation and operational context

## Core Backend Modules (Interview Focus)

- `backend/src/graph/plannerGraph.ts`
  - main orchestration layer
  - stage-level logging and error normalization
  - retry/fallback behavior and replan mode handling
- `backend/src/agents/vibeAgent.ts`
  - attraction-vibe scoring with token control
- `backend/src/agents/reconcilerAgent.ts`
  - converts intermediate outputs into final itinerary JSON
- `backend/src/processing/*`
  - deterministic budget allocation, clustering, and diversity balancing
- `backend/src/controllers/itinerary.Controller.ts`
  - request lifecycle, currency localization, response metadata

## Frontend UX Architecture (Interview Focus)

- `frontend/src/App.tsx`
  - wizard state orchestration, API submission, loading flow, replan modal integration
- Screen layer (`frontend/src/screens/*`)
  - `VibePicker`, `TripBasics`, `Constraints`, `FineTune`, `Loading`, `Itinerary`
- Reusable components (`frontend/src/components/*`)
  - progress/navigation, cards, cost summary, day tabs, map, replan modal
- API service (`frontend/src/services/api.ts`)
  - typed request/response wrappers for generate/replan/cities/attractions

## API Surface

- `POST /api/itinerary/generate`
- `POST /api/itinerary/replan`
- `GET /api/cities`
- `GET /api/attractions?cityId=...`

## Environment Variables

Backend required:
- `DATABASE_URL`
- `GROQ_API_KEY`

Backend optional:
- `PORT`
- `GROQ_MODEL`
- `AGENT_ATTRACTION_LIMIT`
- `AGENT_RETRY_ATTRACTION_LIMIT`

Frontend optional:
- `VITE_API_URL` (default: `http://localhost:3000`)

## Local Setup

1. Install dependencies
   - `cd backend && npm install`
   - `cd ../frontend && npm install`
2. Configure backend `.env` with `DATABASE_URL` and `GROQ_API_KEY`
3. Run backend
   - `cd backend && npm run dev`
4. Run frontend
   - `cd frontend && npm run dev`

## Validation and Test Commands

- Frontend build check: `cd frontend && npm run build`
- Backend type checks: `cd backend && npx tsc --noEmit -p tsconfig.json`
- Backend scenario tests: `cd backend && npm run test:cases`
- Replan suite: `cd backend && npm run test:replan`

## Documentation Index

- Project structure: `Docs/PROJECT_STRUCTURE.md`
- Interview-focused technical walkthrough: `Docs/INTERVIEW_GUIDE.md`
- Context history and architecture notes: `Docs/CONTEXT.md`
- Troubleshooting and fix notes: `Docs/TROUBLESHOOTING.md`
- Frontend starter template notes: `Docs/FRONTEND_README.md`
