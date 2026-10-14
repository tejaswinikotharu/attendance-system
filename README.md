# AttendWise — Smart Attendance & Bunk Planner

**AttendWise** is a full-stack student productivity application designed for colleges and universities. It allows students to manage their semester calendar, import or create weekly timetables, track daily class attendance, and utilize integer-safe mathematical models to calculate safe-bunk cushions and deficit recovery requirements.

---

## Technology Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, TanStack Query, React Hook Form, Zod, Recharts, Lucide Icons.
- **Backend**: Node.js, Express.js, TypeScript, MySQL 8.0, Prisma ORM 6.4.1, bcrypt (12 rounds), JWT in-memory authentication, RFC-4180 CSV export/import.
- **Testing**: Vitest, React Testing Library, Supertest (110 automated tests total: 100 backend, 10 frontend).

---

## Architectural Highlights

1. **Integer-Safe Bunk Arithmetic**:
   - Safe bunk calculation: $k = \max(0, \lfloor \frac{100 \cdot A - T \cdot C}{T} \rfloor)$
   - Deficit recovery calculation: $n = \lceil \frac{T \cdot C - 100 \cdot A}{100 - T} \rceil$
   - Unevaluated state ($C = 0$): Displays neutral indicator `—`, preventing misleading 0% or 100% figures.
2. **In-Memory JWT Authentication**:
   - Access tokens are strictly stored in React in-memory state; tokens are never persisted in `localStorage`.
   - On page reload, unauthenticated routes automatically redirect to `/login`.
3. **What-If Attendance Simulator**:
   - Students can stage future sessions as attended or missed to forecast hypothetical percentages without mutating database rows.
4. **Data Isolation & IDOR Guards**:
   - Multi-tenant tenant scoping ensures each authenticated student only accesses their own semesters, subjects, slots, and records.

---

## Project Structure

```
├── backend/
│   ├── src/
│   │   ├── controllers/      # Express controllers
│   │   ├── middleware/       # JWT auth & centralized error middleware
│   │   ├── routes/           # REST endpoints
│   │   ├── schemas/          # Zod validation schemas
│   │   ├── services/         # Attendance math & business logic
│   │   └── utils/            # Prisma client & IDOR scoping
│   ├── prisma/
│   │   └── schema.prisma     # MySQL database schema & migrations
│   └── tests/                # 100 passing unit and integration tests
├── frontend/
│   ├── src/
│   │   ├── api/client.ts     # Typed centralized API client with auth injection
│   │   ├── components/       # UI primitives, charts, and layout
│   │   ├── context/          # In-memory AuthContext and SemesterContext
│   │   ├── pages/            # Login, Register, Dashboard, Timetable, Daily, History, Planner
│   │   ├── types/            # Fully typed entity models and payloads
│   │   └── tests/            # Vitest + React Testing Library test suites
│   ├── index.html            # Inter font & responsive viewport
│   └── tailwind.config.js    # Restrained indigo/blue SaaS theme
├── package.json              # Monorepo root scripts
└── README.md
```

---

## Local Setup & Running Instructions

### 1. Prerequisites
- Node.js (v18+)
- MySQL (v8.0+) running on port 3306

### 2. Backend Configuration
Create `backend/.env` with:
```env
DATABASE_URL="mysql://root:root123@localhost:3306/attendwise"
PORT=5000
NODE_ENV=development
JWT_SECRET=your_secure_development_jwt_secret_key_at_least_32_chars
```

Install backend dependencies and generate Prisma client:
```bash
cd backend
npm install
npx prisma generate
```

### 3. Frontend Configuration
Create `frontend/.env` (or use `.env.example`):
```env
VITE_API_BASE_URL=http://localhost:5000/api
```

Install frontend dependencies:
```bash
cd frontend
npm install
```

---

## Running the Application

From the root directory:

```bash
# Start backend API server (runs on http://localhost:5000)
npm run dev:backend

# Start frontend Vite dev server (runs on http://localhost:5173)
npm run dev:frontend
```

---

## Running Test Suites

```bash
# Run all 100 backend tests
npm run test:backend

# Run all 10 frontend tests
npm run test:frontend

# Run full monorepo test suite (110 tests)
npm test
```

---

## Building for Production

```bash
# Production TypeScript compile & bundle
npm run build:backend
npm run build:frontend
```
