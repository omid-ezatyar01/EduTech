# Teacher App

This is the instructor portal for EduTech. It is a Vite + React single-page app that talks to the backend API.

## Environment

Copy `.env.example` to `.env` and set:

```bash
VITE_API_URL=https://api.example.com/api/v1
```

Notes:

- `VITE_API_URL` should point to the backend API base, including `/api/v1`.
- If `VITE_API_URL` is missing in production, the app now falls back to `window.location.origin + /api/v1`, which works when your reverse proxy serves the frontend and API on the same host.

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Deployment Notes

- This app uses `BrowserRouter`, so your web server must rewrite unknown routes to `index.html`.
- Nginx example:

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

- If the frontend and backend are on different origins, make sure backend CORS allows the teacher app origin.
- Do not deploy the local `.env` values from development to production.
