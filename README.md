# Multiplayer Coding Battle — Backend

Real-time 1v1 coding battle platform. Two players compete to solve the same problem first.

## Tech Stack

- **Node.js + Express + TypeScript** — REST API
- **MongoDB Atlas + Mongoose** — Database
- **Socket.io** — Real-time battle events
- **JWT + bcryptjs** — Authentication
- **Zod** — Request validation
- **Judge0 API** — Code execution

## Setup

```bash
npm install
cp .env.example .env   # fill in your values
npm run dev
```

## Environment Variables

```env
PORT=5000
MONGODB_URI=your_atlas_uri
JWT_SECRET=your_secret_key
JUDGE0_API_URL=https://judge0-ce.p.rapidapi.com
JUDGE0_API_KEY=your_rapidapi_key
CLIENT_URL=http://localhost:5173
```

## API Routes

```
POST   /api/auth/register       create account
POST   /api/auth/login          login + get token
GET    /api/auth/me             get profile (protected)

GET    /api/problems            list problems
POST   /api/problems            create problem (protected)
GET    /api/problems/:id        get problem by id

POST   /api/battles/create      create battle room (protected)
GET    /api/battles/:roomCode   get room (protected)
GET    /api/battles/active      list open rooms (protected)

POST   /api/submissions         submit code (protected)
GET    /api/submissions/my      my submissions (protected)
```

## Socket Events

| Client → Server | Description |
|----------------|-------------|
| `JOIN_ROOM` | Join a battle room |
| `PLAYER_READY` | Mark as ready |
| `CODE_CHANGE` | Broadcast typing to opponent |
| `SUBMIT_CODE` | Submit solution |

| Server → Client | Description |
|----------------|-------------|
| `BATTLE_STARTED` | Problem revealed to both players |
| `COUNTDOWN` | 5 second countdown |
| `SUBMISSION_RESULT` | Pass/fail result |
| `BATTLE_FINISHED` | Winner announced |

## Scripts

```bash
npm run dev      # development with hot reload
npm run build    # compile TypeScript
npm start        # run production build
```

## Author

Samarth — MERN Developer