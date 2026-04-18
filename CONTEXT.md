# VibeTrip Context (Day 1 to Present)

## Purpose
- This file is the single long-form context handoff for future context windows.
- It captures what was built from Day 1 onward, current architecture, contracts, fixes, and known gaps.
- Last updated: 2026-04-18.

## Project Summary
- Product: Personalized tourism planner that converts user preferences into a day-wise itinerary.
- Stack:
- Frontend: React + TypeScript + Vite + CSS modules + React Leaflet.
- Backend: Express + TypeScript + Prisma + Groq.
- Data: PostgreSQL via Prisma schema.
- Shared package: `@vibetrip/shared` for cross-tier types.

## High-Level Architecture Diagram
```mermaid
flowchart LR
    U[Traveler] --> FE[Frontend<br/>React + TypeScript + Vite]
    FE -->|UserProfile payload| API[/Express API<br/>/api/itinerary, /api/cities, /api/attractions/]
    SH[@vibetrip/shared<br/>UserProfile + Itinerary types] -. contracts .- FE
    SH -. contracts .- API

    API --> MW[Validation + Controllers]
    MW --> PG[Planner Graph Orchestrator]

    PG --> D1[Pre-filtering]
    D1 --> D2[Budget Processing]
    D2 --> D3[Proximity Clustering]
    D3 --> D4[Diversity Balancing]
    D4 --> VA[Vibe Agent (LLM)]
    VA --> RA[Reconciler Agent (LLM)]
    RA --> FB[Fallback/Retry Logic]
    FB --> DB[(Prisma + PostgreSQL)]

    DB --> RESP[API Response<br/>itinerary + tokensUsed + meta]
    RESP --> FE
```

## Current Architecture (v2.0 Hybrid)
Flow:
- User input
- pre-filtering (deterministic TS)
- budget processing (deterministic TS)
- proximity clustering (deterministic TS)
- diversity balancing (deterministic TS)
- vibe scoring (LLM)
- reconciler (LLM)
- fallback mode when needed
- itinerary persistence + API response

Key files:
- `backend/src/graph/plannerGraph.ts`
- `backend/src/processing/calculateBudget.ts`
- `backend/src/processing/clusterByProximity.ts`
- `backend/src/processing/ensureDiversity.ts`
- `backend/src/agents/vibeAgent.ts`
- `backend/src/agents/reconcilerAgent.ts`
- `backend/src/controllers/itinerary.Controller.ts`
- `backend/src/utils/retry.ts`

## Day-by-Day Build Log

### Day 1: Foundation and scaffolding (2026-03-24 to 2026-03-26)
Commits:
- `a102e7b` Initial commit
- `7d80933` Initial setup
- `9770323` Set up frontend and backend project scaffold
- `af5440d` scaffold `App.tsx` with state, profile updater, navigation logic
- `3ad7027` UI components/cards added
- `.gitignore` and branch scaffolding/merge groundwork

Implemented:
- Monorepo layout with `frontend`, `backend`, `shared`.
- Shared `UserProfile` type and defaults in `shared/types/userProfile.ts`.
- Frontend app-level state and multi-step flow shell in `frontend/src/App.tsx`.
- Reusable UI cards and navigation primitives.

### Day 2: Complete screen flow (2026-03-30)
Commit:
- `7ce0053` added all 6 screens and styles

Implemented:
- All main screens:
- `VibePicker`
- `TripBasics`
- `Constraints`
- `FineTune`
- `Loading`
- `Itinerary`
- Screen-level CSS modules for each screen.
- Progress bar and step-based wizard UX.

### Day 3: Backend planner core and integration (2026-03-31)
Commits:
- `339541b` backend agents/routes/middleware/prisma/groq
- `a3f68f1` backend services + prisma schema + frontend API integration
- `67d04b1` merge backend feature work

Implemented:
- Express server with routes for cities, attractions, itinerary generate/replan.
- Prisma schema and model layer.
- Initial multi-agent pipeline (legacy shape) for vibe/budget/logistics/diversity/reconciler.
- Frontend service layer hitting backend endpoints.

### Day 4: Refactor and operational fixes (2026-04-01 to 2026-04-04)
Commits:
- `2525099` controller extraction + standardized naming
- `3fc4a2a` real fetch wiring in frontend api service

Implemented:
- Route/controller separation:
- `*.Routes.ts` thin routing
- `*.Controller.ts` business logic
- Middleware validation for itinerary input.
- Operational hardening and troubleshooting fixes:
- env bootstrap ordering (`loadEnv`)
- model/env handling
- validation bug fixes
- improved logging/error handling

### Day 5: Itinerary UI polish and map experience (2026-04-09)
Commit:
- `5bc66c0` Day 5 complete

Implemented:
- Structured itinerary UI:
- day tabs
- slot cards
- cost summary bars
- map with route polyline and popups
- loading animation/progress sequence
- moved from placeholder JSON-only viewing toward full itinerary UX.

### Post-Day 5: Hybrid architecture and reliability upgrades (current branch state, 2026-04-16 to 2026-04-17)
Current working changes include:
- Deleted legacy agent modules:
- `backend/src/agents/budgetAgent.ts`
- `backend/src/agents/logisticsAgent.ts`
- `backend/src/agents/diversityAgent.ts`
- Added deterministic processing modules:
- `backend/src/processing/calculateBudget.ts`
- `backend/src/processing/clusterByProximity.ts`
- `backend/src/processing/ensureDiversity.ts`
- Refactored planner graph to sequential deterministic + LLM stages.
- Added retry utility with retry callback metadata.
- Added execution metadata (`usedFallback`, `retryCount`, `llmSuccess`) in vibe/reconciler/planner outputs.
- API `/generate` response now includes itinerary + `tokensUsed` + `meta`.
- Added test tooling:
- `backend/src/tests/testCases.ts`
- `backend/src/tests/seedIntegrity.ts`
- `backend/package.json` script `test:cases`.

## Full Feature Inventory

### Shared Layer
- `shared/types/userProfile.ts`
- canonical user profile interface and enums/unions
- `defaultUserProfile`
- `shared/types/Itinerary.ts`
- itinerary data contract used by frontend/backend

### Frontend Features
- Multi-step wizard in `frontend/src/App.tsx`:
- Step 1 `VibePicker`: select up to 2 vibes, first-visit, group type
- Step 2 `TripBasics`: city/date/time/hotel area
- Step 3 `Constraints`: budget + budget split + pace + wake-up style + transport
- Step 4 `FineTune`: dietary + mobility + age group + must-visit + avoid
- Step 5 `Loading`: staged progress over planning agents
- Step 6 `Itinerary`: day tabs, map, slot cards, cost summary
- UI components:
- `ProgressBar`, `NavigationButtons`, `ChipSelect`, `DayTabs`, `CostSummary`, `ItineraryMap`
- Card components:
- `VibeCard`, `OptionCard`, `CityCard`, `SlotCard`
- API service layer in `frontend/src/services/api.ts`:
- `generateItinerary`
- `replanItinerary`
- `getCities`
- `getAttractions`
- Validation utilities in `frontend/src/utils/validation.ts` for field/screen-level checks.

### Backend Features
- Express app wiring in `backend/src/index.ts`:
- `/api/cities`
- `/api/attractions`
- `/api/itinerary`
- Controllers:
- `cities.Controller.ts`: list cities with country relation
- `attractions.Controller.ts`: filter by city/category/maxCost
- `itinerary.Controller.ts`: generate and replan entry points
- Routes:
- `cities.Routes.ts`, `attractions.Routes.ts`, `itinerary.Routes.ts`
- Middleware:
- `validate.ts`: required profile fields for generate
- `errorHandler.ts`: normalized pipeline/provider-aware error payloads

### Planner and Agent Features
- `plannerGraph.ts`:
- stage-level start/success/error logs
- stage timing and request IDs
- token-limit aware retry path with reduced attraction payload
- deterministic pre-processing before LLM stages
- DB persistence of final itinerary
- `vibeAgent.ts`:
- compact prompt payload
- hard attraction cap (20)
- retry wrapper
- parse/clean/validate output
- deterministic fallback scores on failure
- token usage extraction
- meta output (`usedFallback`, `retryCount`, `llmSuccess`)
- `reconcilerAgent.ts`:
- compressed prompt format for token control
- strict JSON normalization pipeline
- robust fallback itinerary builder from deterministic inputs
- retry wrapper + token extraction + execution meta output
- `promptData.ts`:
- compactors for profile, attractions, vibe output, logistics output, diversity output
- `retry.ts`:
- exponential backoff retry helper with `onRetry` callback hooks

### Deterministic Processing Layer
- `calculateBudget.ts`:
- effective day count
- daily budget cap
- budget allocation by split mode
- expensive attraction flagging
- `clusterByProximity.ts`:
- pace-driven slot planning
- arrival/departure-aware slot trimming
- nearest-neighbor ordering by haversine distance
- must-visit prioritization
- `ensureDiversity.ts`:
- per-day category-frequency checks
- replacement suggestions based on vibe-category mapping
- adjusted clusters + flagged days output

### Data and Persistence Features
Prisma models in `backend/prisma/schema.prisma`:
- `Country`, `City`, `Category`, `Attraction`, `Itinerary`, `ReplanLog`

Persisted behavior:
- itinerary requests save full profile JSON + itinerary JSON + estimated total cost.

### Testing and Verification Features
- `backend/src/tests/testCases.ts`:
- scenario-based E2E generate testing
- endpoint reachability checks
- rate-limit/TPD-aware classification
- fallback-vs-true-LLM reporting via response meta
- token usage aggregation and summary
- default suite subset: first 4 test cases
- default inter-test delay: 35000ms
- `backend/src/tests/seedIntegrity.ts`:
- DB seed completeness/integrity assertions for countries/cities/categories/attractions

## API Contracts (Current)

### POST `/api/itinerary/generate`
Input:
- `UserProfile` payload from shared types.

Response:
- itinerary fields:
- `city`, `currency`, `total_cost_estimate`, `days`
- plus execution fields:
- `tokensUsed: number`
- `meta` object:
- `vibeFallback`
- `reconcilerFallback`
- `vibeRetryCount`
- `reconcilerRetryCount`
- `usedFallback`
- `retryCount`
- `llmSuccess`

### POST `/api/itinerary/replan`
Current status:
- placeholder endpoint exists
- validates `itinerary_id` and `disruption`
- returns "Replan coming Day 6"

### GET `/api/cities`
- returns cities with country relation.

### GET `/api/attractions?cityId=...&category=...&maxCost=...`
- city required
- optional category and maxCost filters.

## Environment and Runtime Controls

### Backend required
- `DATABASE_URL`
- `GROQ_API_KEY`

### Backend optional tuning
- `GROQ_MODEL`
- `AGENT_ATTRACTION_LIMIT`
- `AGENT_RETRY_ATTRACTION_LIMIT`
- `PORT`
- test runner variables:
- `TEST_CASES_URL`
- `TEST_CASES_DELAY_MS`
- seed integrity variables:
- `SEED_CHECK_STRICT_IDS`
- `EXPECTED_ATTRACTIONS_TOTAL`
- `EXPECTED_MIN_ATTRACTIONS_BY_CITY`

### Frontend
- `VITE_API_URL` (falls back to `http://localhost:3000`)

## Major Reliability/Debugging Work Completed
- Env bootstrap ordering fixed to prevent intermittent missing env crashes.
- Prisma connection normalization for noisy/deprecated SSL mode warnings.
- Structured pipeline logs with request IDs and stage durations.
- Provider error normalization in graph + global error middleware.
- Token-limit handling via payload caps, compaction, retries, and fallbacks.
- API-level visibility of fallback mode and retry counts.
- Test runner corrected to distinguish fallback from true LLM success.

## Historical Fixes (From Troubleshooting Cycle)
- Backend startup fix: resolved `Missing GROQ_API_KEY` startup crash by loading env early and consistently.
- Validation fix: corrected arrival/departure time validation logic in middleware.
- Frontend type/props fix: resolved compile mismatches between `App.tsx`, `Loading`, and `Itinerary` props.
- Itinerary rendering fix: moved from placeholder output to structured itinerary rendering with map/cards/summary.
- Model config fix: centralized Groq model handling and removed stale hardcoded model coupling.
- Token failure mitigation: reduced prompt size, added attraction caps, retries, and fallback logic.
- Logging quality fix: normalized provider error fields and reduced noisy payload logging.
- DB warning fix: normalized deprecated postgres SSL mode aliases in Prisma connection handling.

## Known Gaps and Pending Work
- Replan feature is stubbed and not fully implemented.
- Loading screen labels still mention legacy Budget/Logistics/Diversity agents even though runtime now uses deterministic TS processing for those stages.
- Frontend `generateItinerary` currently validates and returns itinerary shape only; it does not surface `tokensUsed`/`meta` in UI.
- `CONTEXT.md` is intentionally ignored by git (`.gitignore`), so this doc is for local context-hand-off use unless ignore rules are changed.

## Quick Health Commands
- Backend type-check:
- `cd backend && npx tsc --noEmit -p tsconfig.json`
- Frontend build check:
- `cd frontend && npm run build`
- Backend run:
- `cd backend && npm run dev`
- Test cases runner:
- `cd backend && npm run test:cases`

## Current Branch Snapshot
- Active branch: `feat/hybrid-architecture`
- Working tree includes hybrid-architecture changes plus this updated context document.
- Planned merge target requested: `dev-v1` after review/commit.

## Full Project Structure

_Generated on 2026-04-18 (UTC). Source snapshot: [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md)._

```text
.
├── .codex
├── .gitignore
├── CONTEXT.md
├── PROJECT_STRUCTURE.md
├── README.md
├── TROUBLESHOOTING.md
├── backend
│   ├── .env
│   ├── .env.production
│   ├── generated
│   │   └── prisma
│   │       ├── browser.ts
│   │       ├── client.ts
│   │       ├── commonInputTypes.ts
│   │       ├── enums.ts
│   │       ├── internal
│   │       │   ├── class.ts
│   │       │   ├── prismaNamespace.ts
│   │       │   └── prismaNamespaceBrowser.ts
│   │       ├── models
│   │       │   ├── Attraction.ts
│   │       │   ├── Category.ts
│   │       │   ├── City.ts
│   │       │   ├── Country.ts
│   │       │   ├── Itinerary.ts
│   │       │   └── ReplanLog.ts
│   │       └── models.ts
│   ├── package-lock.json
│   ├── package.json
│   ├── prisma
│   │   ├── migrations
│   │   │   ├── 20260324125106_init
│   │   │   │   └── migration.sql
│   │   │   └── migration_lock.toml
│   │   └── schema.prisma
│   ├── prisma.config.ts
│   ├── src
│   │   ├── agents
│   │   │   ├── promptData.ts
│   │   │   ├── reconcilerAgent.ts
│   │   │   └── vibeAgent.ts
│   │   ├── controllers
│   │   │   ├── attractions.Controller.ts
│   │   │   ├── cities.Controller.ts
│   │   │   └── itinerary.Controller.ts
│   │   ├── graph
│   │   │   └── plannerGraph.ts
│   │   ├── index.ts
│   │   ├── lib
│   │   │   ├── env.ts
│   │   │   ├── groq.ts
│   │   │   └── prisma.ts
│   │   ├── middleware
│   │   │   ├── errorHandler.ts
│   │   │   └── validate.ts
│   │   ├── processing
│   │   │   ├── calculateBudget.ts
│   │   │   ├── clusterByProximity.ts
│   │   │   └── ensureDiversity.ts
│   │   ├── routes
│   │   │   ├── attractions.Routes.ts
│   │   │   ├── cities.Routes.ts
│   │   │   └── itinerary.Routes.ts
│   │   ├── tests
│   │   │   ├── seedIntegrity.ts
│   │   │   └── testCases.ts
│   │   └── utils
│   │       └── retry.ts
│   └── tsconfig.json
├── frontend
│   ├── .env.frontend
│   ├── README.md
│   ├── eslint.config.js
│   ├── index.html
│   ├── package-lock.json
│   ├── package.json
│   ├── postcss.config.js
│   ├── public
│   │   ├── favicon.svg
│   │   ├── icons.svg
│   │   └── vite.svg
│   ├── src
│   │   ├── App.css
│   │   ├── App.tsx
│   │   ├── assets
│   │   │   ├── hero.png
│   │   │   ├── react.svg
│   │   │   └── vite.svg
│   │   ├── components
│   │   │   ├── cards
│   │   │   │   ├── CityCard.module.css
│   │   │   │   ├── CityCard.tsx
│   │   │   │   ├── OptionCard.module.css
│   │   │   │   ├── OptionCard.tsx
│   │   │   │   ├── SlotCard.module.css
│   │   │   │   ├── SlotCard.tsx
│   │   │   │   ├── VibeCard.module.css
│   │   │   │   └── VibeCard.tsx
│   │   │   └── ui
│   │   │       ├── ChipSelect.module.css
│   │   │       ├── ChipSelect.tsx
│   │   │       ├── CostSummary.module.css
│   │   │       ├── CostSummary.tsx
│   │   │       ├── DayTabs.module.css
│   │   │       ├── DayTabs.tsx
│   │   │       ├── ItineraryMap.tsx
│   │   │       ├── NavigationButtons.module.css
│   │   │       ├── NavigationButtons.tsx
│   │   │       ├── ProgressBar.module.css
│   │   │       └── ProgressBar.tsx
│   │   ├── index.css
│   │   ├── main.tsx
│   │   ├── screens
│   │   │   ├── Constraints.module.css
│   │   │   ├── Constraints.tsx
│   │   │   ├── FineTune.module.css
│   │   │   ├── FineTune.tsx
│   │   │   ├── Itinerary.module.css
│   │   │   ├── Itinerary.tsx
│   │   │   ├── Loading.module.css
│   │   │   ├── Loading.tsx
│   │   │   ├── TripBasics.module.css
│   │   │   ├── TripBasics.tsx
│   │   │   ├── VibePicker.module.css
│   │   │   └── VibePicker.tsx
│   │   ├── services
│   │   │   └── api.ts
│   │   ├── utils
│   │   │   └── validation.ts
│   │   └── vite-env.d.ts
│   ├── tailwind.config.js
│   ├── tsconfig.app.json
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   ├── tsconfig.tsbuildinfo
│   └── vite.config.ts
└── shared
    ├── package.json
    └── types
        ├── Itinerary.ts
        └── userProfile.ts
```
