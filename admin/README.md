# Admin App

This is the EduTech admin panel built with Vite and React.

## Environment

Copy `.env.example` to `.env` and set:

```bash
VITE_API_URL=https://api.example.com/api/v1
```

Notes:

- `VITE_API_URL` should point to the backend API base, including `/api/v1`.
- If the admin app and backend are served on different origins, make sure backend CORS allows the admin origin.

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

- This app is a single-page app, so your web server must rewrite unknown routes to `index.html`.
- Nginx example:

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```
