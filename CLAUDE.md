# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands are run from `auction-app/`:

```bash
npm start        # Dev server at localhost:4200
npm run build    # Production build
npm test         # Run unit tests (Vitest)
npm run watch    # Build in watch mode
```

To run a single test file:
```bash
npx vitest run src/app/app.spec.ts
```

## Architecture

**Pure frontend Angular 21 app** — no backend server. Firebase Firestore is the sole backend, acting as both database and real-time pub/sub.

### Real-time sync model

All clients subscribe to a single Firestore document (`rooms/{roomId}`) via `onSnapshot()`. Every user action calls a Firestore **transaction** (atomic read-modify-write), which triggers `onSnapshot` on all connected clients, causing the UI to update. There is no polling or manual WebSocket code.

Data flow:
```
User action → Service transaction → Firestore write → onSnapshot fires → RoomStateService.room$ emits → async pipe re-renders UI
```

### Services (`app/core/services/`)

| File | Responsibility |
|---|---|
| `room.ts` | Room CRUD: create, join, set auctioneer, import players, start auction |
| `room-state.service.ts` | Maintains `room$` BehaviorSubject via Firestore `onSnapshot` listener |
| `auction.service.ts` | Atomic bid/sold/skip operations using Firestore transactions |
| `player-data.service.ts` | Parses `IPL_2026_AllTeams_v3.xlsx` from `src/assests/` into `Player[]` |

### Key data model (`RoomData`)

```typescript
{
  roomId: string;
  teams: string[];
  status: 'waiting' | 'ready' | 'auction' | 'done';
  auctioneer: string | null;
  players: Player[];               // Ordered list for auction
  currentPlayerIndex: number;
  currentBid: number;
  currentBidder: string | null;
  soldPlayers: SoldPlayer[];
  teamBudgets: Record<string, number>;  // ₹100 Cr per team initially
}
```

### Feature routes & user flow

```
/                          → home       — create room
/room/:id/register         → register   — join with team name
/room/:id/lobby            → lobby      — drag-reorder marquee players, pick auctioneer, start
/room/:id/auction          → auction    — live bidding UI
/players                   → player-list — browse player database (utility, not part of auction flow)
```

### Firebase environments

- `environment.development.ts` — Firebase project `ipl-live-auction-dev` (populated)
- `environment.ts` — Production config (placeholder, needs real Firebase project values)

### Player data

Players are loaded from `src/assests/IPL_2026_AllTeams_v3.xlsx`. The lobby screen lets the auctioneer drag-reorder marquee category tiers (BAT1–3, WK1–2, BOWL1–4, AR1–3) before starting the auction. `PlayerDataService` caches the parsed result.

### Concurrency safety

`placeBid()` and `markSold()` use Firestore transactions to prevent race conditions when multiple teams bid simultaneously. A bid only succeeds if `bidAmount > currentBid` AND the team has sufficient budget remaining.
