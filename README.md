# Personalized-Tourism-Planner-Agent

## Documentation

- Troubleshooting and fix history: [`TROUBLESHOOTING.md`](./TROUBLESHOOTING.md)
# Personalized Tourism Planner Agent

AI-powered trip planner with:
- A React multi-step planner UI
- An Express + Prisma backend
- Shared TypeScript contracts across frontend and backend
- Disruption-aware slot replanning

## Monorepo Structure

- `frontend`: Traveler-facing app (Vite + React + TypeScript)
- `backend`: APIs, orchestration pipeline, persistence, replanning
- `shared`: Shared types published locally as `@vibetrip/shared`
- `Docs`: Deep-dive documentation

## Core Features

- Multi-screen trip intake (vibes, dates, budget, constraints)
- AI itinerary generation pipeline:
  - Attraction retrieval + enrichment
  - Budgeting and proximity clustering
  - Diversity balancing
  - LLM vibe scoring + itinerary reconciliation
- Currency-localized costing (INR planning basis, localized output)
- Slot-level replanning (`day + morning/afternoon/evening + reason`)
- Fallback and retry behavior for token/rate safety

## Tech Stack

- Frontend: React 19, Vite, TypeScript, CSS Modules, React-Leaflet
- Backend: Node.js, Express 5, TypeScript, Prisma, PostgreSQL
- AI: Groq SDK (`llama-3.3-70b-versatile` default model)
- Shared Contracts: Local workspace package `@vibetrip/shared`

## Prerequisites

- Node.js 18+ (recommended 20+)
- npm
- PostgreSQL database
- Groq API key
- Optional: Google Places API key for attraction enrichment

## Environment Variables

### Backend (`backend/.env`)

Required:
- `DATABASE_URL`: PostgreSQL connection string
- `GROQ_API_KEY`: Groq API key

Optional:
- `PORT`: Backend port (default `3000`)
- `GROQ_MODEL`: Default `llama-3.3-70b-versatile`
- `GOOGLE_PLACES_KEY`: Enables Google Places enrichment in attractions endpoint
- `AGENT_ATTRACTION_LIMIT`: Candidate attractions sent to LLM stages (default `20`)
- `AGENT_RETRY_ATTRACTION_LIMIT`: Reduced retry set after token limit events (default `10`)

### Frontend (`frontend/.env` or `frontend/.env.local`)

- `VITE_API_URL`: Backend base URL (default `http://localhost:3000`)

## Local Setup

1. Install shared package dependencies:
```bash
cd shared
npm install
```

2. Install backend dependencies:
```bash
cd ../backend
npm install
```

3. Install frontend dependencies:
```bash
cd ../frontend
npm install
```

4. Configure backend env in `backend/.env`.

5. Apply DB migrations and seed data:
```bash
cd ../backend
npx prisma migrate dev
npm run seed:dev
```

## Run The App

Start backend:
```bash
cd backend
npm run dev
```

Start frontend:
```bash
cd frontend
npm run dev
```

Default URLs:
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`

## API Overview

Base: `/api`

- `GET /cities`
  - Returns cities with country metadata
- `GET /attractions?cityId=<id>&category=<name>&maxCost=<number>&query=<text>`
  - Returns seed attractions
  - If `query` is provided and `GOOGLE_PLACES_KEY` exists, returns merged/deduped seed + Google places results
- `POST /itinerary/generate`
  - Validates required planner input
  - Runs full planning graph
  - Stores itinerary in DB
  - Returns localized itinerary + execution metadata
- `POST /itinerary/replan`
  - Input: `itineraryId` + disruption `{ day, slot, description }`
  - Replans only impacted slot/day context and logs replan event

## Useful Scripts

Backend (`backend/package.json`):
- `npm run dev`: Start backend with auto-reload
- `npm run seed:dev`: Seed using `backend/.env`
- `npm run seed:prod`: Seed using `backend/.env.production`
- `npm run seed:verify`: Validate seed integrity
- `npm run test:cases`: Run itinerary generation test cases
- `npm run test:cluster`: Run clustering tests
- `npm run test:replan`: Run full replan-related tests

Frontend (`frontend/package.json`):
- `npm run dev`: Start Vite dev server
- `npm run build`: Type-check + production build
- `npm run lint`: Lint project
- `npm run preview`: Preview production build

## Data Model (Prisma)

Main entities:
- `Country`
- `City`
- `Category`
- `Attraction`
- `Itinerary`
- `ReplanLog`

Schema file:
- `backend/prisma/schema.prisma`

## Additional Documentation

- Troubleshooting: [`TROUBLESHOOTING.md`](./TROUBLESHOOTING.md)
- Project tree snapshot: [`PROJECT_STRUCTURE.md`](./PROJECT_STRUCTURE.md)
- Interview deep-dive: [`Docs/INTERVIEW_GUIDE.md`](./Docs/INTERVIEW_GUIDE.md)
- Frontend notes: [`Docs/FRONTEND_README.md`](./Docs/FRONTEND_README.md)