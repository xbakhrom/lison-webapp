# Lison Webapp

React and TypeScript Telegram Mini App frontend.

## Local development

```bash
npm ci
npm run dev
```

## Build

```bash
npm run build
docker build -t lison-webapp .
```

The production container serves the SPA through nginx on port `80`. Pushes to `main` publish `ghcr.io/xbakhrom/lison-webapp` and update the production webapp container.
