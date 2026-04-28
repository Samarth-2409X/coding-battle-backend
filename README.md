# Multiplayer Coding Battle Platform — Backend

A real-time multiplayer coding battle platform where two developers compete head-to-head to solve the same coding problem first. Built with the MERN stack + TypeScript + Socket.io.

---

## Tech Stack

| Technology | Purpose |
|------------|---------|
| Node.js + Express | REST API server |
| TypeScript | Type safety across entire codebase |
| MongoDB Atlas + Mongoose | Database + ODM |
| Socket.io | Real-time battle communication |
| JWT + bcryptjs | Authentication + password hashing |
| Zod | Request body validation |
| Judge0 API | Sandboxed code execution |
| Axios | HTTP client for Judge0 |

---

## Project Structure

```
coding-battle-backend/
├── src/
│   ├── server.ts                     # Entry point — HTTP server + Socket.io init
│   ├── app.ts                        # Express setup, CORS, route registration
│   ├── types/
│   │   └── index.ts                  # All shared TypeScript interfaces and types
│   ├── config/
│   │   └── db.ts                     # MongoDB Atlas connection
│   ├── models/
│   │   ├── User.ts                   # User schema — stats, rating, password hash
│   │   ├── Problem.ts                # Problem schema — test cases, starter code
│   │   ├── BattleRoom.ts             # Room schema — players, status, timer
│   │   └── Submission.ts             # Submission schema — code, results, status
│   ├── middleware/
│   │   ├── auth.ts                   # JWT verification + token generator
│   │   ├── errorHandler.ts           # Global error handler + 404
│   │   └── validate.ts               # Zod schema validation middleware
│   ├── services/
│   │   └── judge.service.ts          # Judge0 API — submit + poll + map results
│   ├── controllers/
│   │   ├── auth.controller.ts        # Register, login, profile, leaderboard
│   │   ├── problem.controller.ts     # CRUD for coding problems
│   │   ├── battle.controller.ts      # Create room, get room, battle history
│   │   └── submission.controller.ts  # Submit code, view submissions
│   ├── routes/
│   │   ├── auth.routes.ts            # /api/auth/*
│   │   ├── problem.routes.ts         # /api/problems/*
│   │   ├── battle.routes.ts          # /api/battles/*
│   │   └── submission.routes.ts      # /api/submissions/*
│   └── socket/
│       └── battle.socket.ts          # All real-time Socket.io battle logic
├── .env                              
├── .gitignore
├── tsconfig.json
└── package.json
```

---

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

Create a `.env` file in the root folder:

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/Coding_battle
JWT_SECRET=your_long_random_secret_key_here
JWT_EXPIRES_IN=7d
JUDGE0_API_URL=https://judge0-ce.p.rapidapi.com
JUDGE0_API_KEY=your_rapidapi_key_here
CLIENT_URL=http://localhost:5173
```

**Where to get the keys:**
- `MONGODB_URI` → [MongoDB Atlas](https://mongodb.com/atlas) — free M0 cluster → Connect → Drivers
- `JUDGE0_API_KEY` → [RapidAPI](https://rapidapi.com) → search "Judge0 CE" → subscribe to Basic plan

### 3. Start the server

```bash
npm run dev
```

Expected output:
```
✅ MongoDB Connected: cluster0.xxxxx.mongodb.net
=======================================
  Coding Battle Server
  Running on: http://localhost:5000
  Health:     http://localhost:5000/health
  Env:        development
=======================================
```

---

## API Routes

### Auth — `/api/auth`

| Method | Route | Protected | Description |
|--------|-------|-----------|-------------|
| POST | `/register` | No | Create a new account |
| POST | `/login` | No | Login and receive JWT token |
| GET | `/me` | Yes | Get logged-in user profile |
| GET | `/leaderboard` | No | Top 20 players by rating |

**Register body:**
```json
{
  "username": "samarth",
  "email": "samarth@example.com",
  "password": "123456"
}
```

**Login response includes:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": { "username": "samarth", "stats": { "rating": 1000 } }
  }
}
```

---

### Problems — `/api/problems`

| Method | Route | Protected | Description |
|--------|-------|-----------|-------------|
| GET | `/` | No | List all problems |
| GET | `/random` | No | Get a random problem |
| GET | `/:id` | No | Get problem by ID |
| POST | `/` | Yes | Create a new problem |
| PUT | `/:id` | Yes | Update a problem |
| DELETE | `/:id` | Yes | Delete a problem |

**Query filters for GET `/`:**
```
?difficulty=easy|medium|hard
?tags=arrays,strings
?page=1&limit=20
```

---

### Battles — `/api/battles`

All routes protected.

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/create` | Create a new battle room |
| GET | `/active` | List all open rooms |
| GET | `/history` | Your past battles |
| GET | `/:roomCode` | Get room by 6-char code |

**Create room body:**
```json
{
  "mode": "1v1",
  "timeLimit": 30
}
```

---

### Submissions — `/api/submissions`

All routes protected.

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/` | Submit code for a problem |
| GET | `/my` | Your submission history |
| GET | `/:id` | Get a single submission |

**Submit code body:**
```json
{
  "problemId": "64f1a2b3...",
  "code": "function solve() { ... }",
  "language": "javascript"
}
```

**Supported languages:** `javascript` · `python` · `cpp` · `java`

---

## Real-time Socket.io

Connect with JWT token:
```javascript
const socket = io("http://localhost:5000", {
  auth: { token: "your_jwt_token" }
});
```

### Events — Client to Server

| Event | Payload | Description |
|-------|---------|-------------|
| `JOIN_ROOM` | `{ roomCode }` | Join a battle room |
| `LEAVE_ROOM` | `{ roomCode }` | Leave the room |
| `PLAYER_READY` | `{ roomCode }` | Mark yourself ready to start |
| `CODE_CHANGE` | `{ roomCode, code, language }` | Broadcast code update to opponent |
| `SUBMIT_CODE` | `{ roomCode, code, language, languageId }` | Submit your solution |

### Events — Server to Client

| Event | Payload | Description |
|-------|---------|-------------|
| `ROOM_UPDATED` | `{ room }` | Room state changed |
| `PLAYER_JOINED` | `{ userId, username }` | Opponent joined |
| `PLAYER_LEFT` | `{ userId, username }` | Opponent left |
| `COUNTDOWN` | `{ seconds }` | Battle starting in N seconds |
| `BATTLE_STARTED` | `{ problem, timeLimit }` | Problem revealed — battle is live |
| `OPPONENT_CODE_CHANGE` | `{ userId, language }` | Opponent is coding |
| `SUBMISSION_RESULT` | `{ userId, status, passedCases, total }` | Test case results |
| `BATTLE_FINISHED` | `{ winnerId, winnerUsername }` | Battle over — winner announced |
| `ERROR` | `{ message }` | Something went wrong |

---

## Battle Flow

```
1. Player A creates a room         → gets roomCode "ABC123"
2. Player B joins with roomCode    → both players visible in room
3. Both players click Ready        → 5 second countdown begins
4. Countdown ends                  → same random problem shown to both
5. Players write their solution    → opponent sees language change live
6. Player submits code             → Judge0 runs all test cases
7. All test cases pass             → BATTLE_FINISHED sent to both players
8. Ratings updated                 → winner +25, loser -15
```

---

## How Authentication Works

1. User registers or logs in → server returns a JWT token
2. Frontend stores the token
3. Every protected request sends: `Authorization: Bearer <token>`
4. `auth.ts` middleware verifies the token before the controller runs
5. Socket.io also verifies JWT on connection via `socket.handshake.auth.token`

---

## Scripts

```bash
npm run dev      
npm run build   
npm start        
```

---

## 👨‍💻 Author

**Samarth**
GitHub: [Samarth-2409X](https://github.com/Samarth-2409X)
