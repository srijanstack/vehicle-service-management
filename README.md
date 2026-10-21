
## Frontend (React + Tailwind + Vite)

Located in `frontend/`. Theme: white, dark green, gray.

```bash
# 1. Backend (from project root) – needs PostgreSQL configured in .env
pip install -r requirements.txt
uvicorn backend.main:app --reload --port 8000     # tables are created on startup

# 2. Frontend
cd frontend
npm install
npm run dev                                       # http://localhost:5173
```

In dev, the frontend calls `/api/*`, which Vite proxies to `http://127.0.0.1:8000`.
For a production build set `VITE_API_URL` (see `frontend/.env.example`) and add the
frontend origin to `CORS_ORIGINS` in the backend `.env`.

Pages: Dashboard, Fleet, Register Vehicle (`/vehicles/register`), Vehicle detail
(maintenance check, service records, inspections, work orders), Work Orders, Maintenance Rules.
