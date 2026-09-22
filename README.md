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

## «Temur Moskvada» — the 3D grammar game

The `Игра` tab holds a serial Three.js game that drills one grammar topic per
episode. It runs entirely in the browser: no API calls, progress and the spaced
repetition queue live in `localStorage` under `temur-moskvada-save`, and the
whole engine is lazy-loaded so the other tabs stay light.

Content is data, not code. Each episode is one JSON file in
`src/game/content/`, listed in `manifest.json`; a new episode is a new file plus
a manifest entry, with no code change. Interface strings live in
`src/game/i18n/uz.json`.

```bash
npm run content-check
```

validates every episode against `src/game/content/validate.ts` — item counts,
answer options, the scene layout and the spec's mandatory exceptions (each must
appear in at least two items and be asked by the boss). `npm run build` runs it
first, so broken content fails the build instead of reaching production.
Episodes listed in the manifest without a content file show as «tez orada».
