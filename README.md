# PPMap
The PPMap - The Project for Polycule Mapping is a tool/whatevermajig to create and view polycules by making accounts and connecting to people you're in relationships with. Like LinkedIn but for polycules lmao. The goal is to verify the 3-DOS massachusetts trans puppygirl polycule hypothesis.

## How to launch

### Prerequisites
- Node.js and npm
- A running MongoDB instance (local at `mongodb://localhost:27017` or a remote URL)

### 1. Server
```bash
cd server
npm install
cp .env.example .env
# Edit .env — set JWT_SECRET (generate with: openssl rand -hex 32)
# and MONGODB_URL if not using the default local instance.
npm run dev    # nodemon, auto-reloads on changes
# or
npm start      # plain node
```
The API listens on `http://localhost:8000` by default.

### 2. Client
In a second terminal:
```bash
cd client
npm install
npm start
```
The React app opens at `http://localhost:3000`.
