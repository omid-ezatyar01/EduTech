# EduTech

EduTech is split into five independent Node applications. It is not configured as
an npm workspace, so commands are run inside each application directory.

| Directory | Purpose | Local port |
| --- | --- | ---: |
| `backend/` | Express, MongoDB/Mongoose, Socket.IO, payments, email, push, and integrations | 5000 |
| `frontend/` | Public website, student portal, and support-staff workspace | 5173 |
| `teacher/` | Teacher portal | 5174 |
| `admin/` | Administration portal | 5175 |
| `verify/` | Public certificate verification | 5176 |

## Requirements

- Node.js 20.19 or newer (Node 22 is recommended)
- npm
- MongoDB
- Ollama only when the local AI assistant is enabled
- Credentials for any optional payment, email, Google, push, or Telegram integrations

## Local setup

Each application has a sanitized `.env.example`. On a fresh clone, create local
development files without committing them:

```bash
cp backend/.env.example backend/.env.development
cp frontend/.env.example frontend/.env.development
cp teacher/.env.example teacher/.env.development
cp admin/.env.example admin/.env.development
cp verify/.env.example verify/.env.development
```

Fill the required backend values, then install and start each application in its
own terminal:

```bash
cd backend && npm install && npm run dev
cd frontend && npm install && npm run dev
cd teacher && npm install && npm run dev
cd admin && npm install && npm run dev
cd verify && npm install && npm run dev
```

The backend health endpoint is `GET http://localhost:5000/api/v1/health`.

## Production configuration

Vite production builds do not load `.env.development`. Supply client `VITE_*`
values through the deployment environment or an untracked `.env.production` file
inside each client directory. The backend production command loads `backend/.env`
and then `backend/.env.production`; deployment secrets must be supplied through one
of those untracked files or the process environment.

The root `ecosystem.config.cjs` starts only the backend with PM2. Client `dist/`
directories should be served by a static web server with SPA fallback routing.

## Validation

```bash
cd backend && npm test
cd frontend && npm test && npm run lint && npm run build
cd teacher && npm test && npm run lint && npm run build
cd admin && npm run lint && npm run build
cd verify && npm test && npm run build
```

Environment files and runtime uploads are intentionally ignored by Git. Commit
only the sanitized `.env.example` templates.
