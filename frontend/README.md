# EduTech Frontend

## Environment

Create a local env file from [`frontend/.env.example`](./.env.example).

Required values:

- `VITE_API_URL`
  - Example: `https://api.example.com/api/v1`
- `VITE_SITE_URL`
  - Example: `https://app.example.com`
  - Used for canonical URLs, Open Graph tags, and structured data.

## Development

```bash
npm install
npm run dev
```

## Production Build

```bash
npm run build
```

## Deployment Notes

- This app uses `BrowserRouter`, so your web server must rewrite unknown routes to `index.html`.
- Deep links like `/course/:id`, `/teacher/:id`, and `/student/...` will break without SPA fallback rewrites.
- `VITE_SITE_URL` should be your real public frontend origin in production.
- `VITE_API_URL` should point to your deployed backend API.
