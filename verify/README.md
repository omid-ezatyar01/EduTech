# EduTech Certificate Verification

Standalone public certificate verification application.

## Development

```bash
cp .env.example .env.development
npm install
npm run dev
```

The application reads:

- `VITE_API_URL` (preferred shared API base variable)
- `VITE_API_BASE_URL` (backward-compatible fallback)
- `VITE_VERIFY_ENDPOINT`

When both API base variables are set, `VITE_API_URL` takes precedence. The API
base may include `/api/v1`; duplicate API path segments are normalized when the
verification URL is built.

Production builds do not load `.env.development`. Inject the public `VITE_*`
values in the deployment environment or use an untracked `.env.production` file.

## Verification

```bash
npm test
npm run build
```

## Production routing

The public hostname must resolve to the server hosting `dist`, and the web server
must return `index.html` for client-side routes such as
`/verify/ED-2026-ABC123`.

Example nginx location:

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

The backend must allow the verification origin through CORS. The intended
production hostname is `https://verify.edutech.study`.
