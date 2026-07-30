# EduTech Certificate Verification

Standalone public certificate verification application.

## Development

```bash
npm install
npm run dev
```

The application reads:

- `VITE_API_BASE_URL`
- `VITE_VERIFY_ENDPOINT`

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
