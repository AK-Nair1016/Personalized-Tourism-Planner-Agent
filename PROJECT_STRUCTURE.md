# Project Structure

_Generated on 2026-04-18 (UTC)._

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
