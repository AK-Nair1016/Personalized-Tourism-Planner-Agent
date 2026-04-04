# VibeTrip Context

## Current Status
- Day 4 complete
- Full generate flow wired: frontend → backend → agents → DB

## What's Built

### Shared
- `shared/types/userProfile.ts` — single source of truth for UserProfile interface, defaultUserProfile, all union types

### Frontend
- `App.tsx` — state, updateProfile, goNext, goBack, handleSubmit (calls generateItinerary, navigates to loading → itinerary)
- `services/api.ts` — generateItinerary, replanItinerary, getCities, getAttractions (real fetch calls)
- `utils/validation.ts` — validateScreen(screen, profile)
- `components/cards/OptionCard.tsx` + `OptionCard.module.css`
- `components/cards/VibeCard.tsx` + `VibeCard.module.css`
- `components/cards/CityCard.tsx` + `CityCard.module.css`
- `components/ui/ProgressBar.tsx`
- `components/ui/ChipSelect.tsx` + `ChipSelect.module.css`
- `components/ui/NavigationButtons.tsx` + `NavigationButtons.module.css`
- `screens/VibePicker.tsx` — vibe cards, firstVisit, group
- `screens/TripBasics.tsx` — city cards, dates, times, hotel area
- `screens/Constraints.tsx` — budget, budgetSplit, pace, wakeUpStyle, transport
- `screens/FineTune.tsx` — dietary, mobility, ageGroup, mustVisit, avoid
- `screens/Loading.tsx` — static agent progress display (real animation Day 5)
- `screens/Itinerary.tsx` — raw JSON dump placeholder (real UI Day 5)

### Backend
- `lib/prisma.ts` — Prisma client singleton
- `lib/groq.ts` — Groq client singleton
- `middleware/validate.ts` — validateItineraryInput
- `middleware/errorHandler.ts` — global error handler
- `controllers/itinerary.Controller.ts` — generateItinerary, replanItinerary
- `controllers/cities.Controller.ts` — getCities
- `controllers/attractions.Controller.ts` — getAttractions
- `routes/itinerary.Routes.ts` — POST /api/itinerary/generate, POST /api/itinerary/replan
- `routes/cities.Routes.ts` — GET /api/cities
- `routes/attractions.Routes.ts` — GET /api/attractions
- `agents/vibeAgent.ts` — scores attractions by vibe fit
- `agents/budgetAgent.ts` — allocates budget across days
- `agents/logisticsAgent.ts` — clusters attractions by proximity
- `agents/diversityAgent.ts` — ensures category spread
- `agents/reconcilerAgent.ts` — builds final itinerary JSON
- `graph/plannerGraph.ts` — runs 4 agents in parallel, passes to reconciler, stores in DB
- `index.ts` — Express app entry point

## Decisions Made
- CSS approach: `.module.css` per component
- Tailwind installed but CSS modules used for component-level styling
- Cards share same color system: blue (#3b82f6) selected, gray (#d1d5db) unselected
- VibeCard: center-aligned with emoji, larger than OptionCard
- CityCard: city name + country with more padding
- Shared types package: `@vibetrip/shared` — both frontend and backend import from here
- Controller pattern: routes are thin, logic lives in controllers
- File naming: `*.Controller.ts` and `*.Routes.ts`
- Prisma 7: reads DATABASE_URL from .env automatically
- API base URL: `VITE_API_URL` in `frontend/.env`

## Environment Variables
### frontend/.env