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
- Public pages have stable language prefixes: `/fa/...` for Persian and
  `/en/...` for English. The router selects its basename from that prefix, so
  internal links remain in the active language.
- Redirect every alternate origin at the web-server layer. In particular, the
  HTTPS `www` virtual host must return a permanent redirect rather than serving
  the SPA and relying on its JavaScript fallback:

```nginx
server {
  listen 443 ssl;
  server_name www.edutech.study;

  # Keep the existing certificate directives in this server block.
  return 301 https://edutech.study$request_uri;
}
```

- The HTTP virtual host should likewise redirect both hostnames directly to the
  canonical HTTPS origin:

```nginx
server {
  listen 80;
  server_name edutech.study www.edutech.study;
  return 301 https://edutech.study$request_uri;
}
```

- Redirect the legacy unprefixed homepage to the default Persian URL:

```nginx
location = / {
  return 301 https://edutech.study/fa/;
}
```

- Keep the SPA fallback active for both language trees:

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

- Private SPA routes use rendered `noindex` meta tags. Do not block those routes
  in `robots.txt`, because crawlers must load them to observe the directive.
