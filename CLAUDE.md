# Claude instructions

Meme-Tinder is a proof of concept that workshop teams fork and extend: users swipe memes right (like) or left (nope). See [README.md](README.md) for requirements, the API and the quick start, and [deploy/README.md](deploy/README.md) for running in Docker or locally.

## Language

All documents and code should be in english

## Changelog

Update [CHANGELOG.md](CHANGELOG.md) with every change, under `## Unreleased` in the `Added` or `Changed` section. Reference the issue number when there is one, for example `(#8)`.

## Architecture

An npm workspaces monorepo with TypeScript in both workspaces.

- `backend/`: Express 5 API (port 3000). Swipes are stored in SQLite (`node:sqlite`, built into Node 22), in the file given by `DATABASE_FILE` (default `backend/data/meme-tinder.db`).
- `frontend/`: React 19 + Vite (port 5173). The dev server proxies `/api` to the backend. In production the backend serves the built frontend (`STATIC_DIR`), so there is one process on one port.

Backend layers (keep them separate):

- `backend/src/app.ts`: the thin HTTP layer. `createApp(swipeService, options)` validates input, reads the user id from the `X-User-Id` header and maps results and errors to status codes. No business logic.
- `backend/src/swipes/service.ts`: the swipe service, which holds the business logic. It depends only on the meme catalog and a `SwipeRepository`, and is tested without HTTP.
- `backend/src/swipes/repository.ts`: the `SwipeRepository` interface and its in-memory implementation (used in tests). This is where a database plugs in: implement the interface and pass it to `createSwipeService` in `backend/src/index.ts`. Do not change the service for this.
- `backend/src/swipes/sqlite-repository.ts`: the SQLite implementation of `SwipeRepository`, used by the running app. New implementations should pass the shared service tests in `backend/test/service.test.ts`, which run against every repository.
- `backend/src/memes/`: the meme catalog and seed data (`seed.ts`). Images are SVGs in `backend/assets/memes`.
- `backend/src/index.ts`: wires catalog, repository, service and app together.

Frontend: `App.tsx` owns the state and the views, `MemeCard.tsx` handles swiping (buttons, arrow keys, pointer drag, no gesture library), `api.ts` is the only code that calls `fetch`, and `identity.ts` keeps the anonymous user id in localStorage.

## Commands

Run from the repository root.

| Command                                                           | What it does                                                    |
| ----------------------------------------------------------------- | --------------------------------------------------------------- |
| `npm install`                                                     | Installs all workspaces                                         |
| `npm run dev`                                                     | Backend and frontend in watch mode (open http://localhost:5173) |
| `npm test`                                                        | All backend and frontend tests (Vitest)                         |
| `npm run build`                                                   | Builds both workspaces (type checks too)                        |
| `npm test -w backend` / `npm test -w frontend`                    | Tests for one workspace                                         |
| `npx vitest run test/service.test.ts` (inside a workspace folder) | One test file                                                   |
| `npm run lint`                                                    | ESLint in both workspaces (config in `eslint.config.js`)        |
| `npm run format`                                                  | Formats all files with Prettier (`.prettierrc.json`)            |
| `npm run format:check`                                            | Checks formatting without changing files                        |

Run `npm run format`, `npm run lint`, `npm test` and `npm run build` before you finish a change. CI (`.github/workflows/ci.yml`) runs the same checks on every pull request and push to `main`, and `main` requires it to pass.

## Conventions

- TypeScript only. Use `type` imports for types. No `any`.
- Backend imports use the `.js` extension (ESM), for example `./app.js`. Frontend imports have no extension.
- Backend files are lowercase and named for what they hold (`service.ts`). Frontend components are PascalCase files with one component each (`MemeCard.tsx`); other frontend modules are camelCase (`api.ts`).
- Backend modules expose a `createX` factory and an interface, and take their dependencies as arguments (see `createSwipeService`). Follow that pattern for new modules.
- Where new code goes:
  - New endpoint: add the route in `backend/src/app.ts` (validation and status codes only), put the logic in a service method, and add a method to `SwipeRepository` if it needs storage. Document it in the API table in [README.md](README.md).
  - New React component: a new file in `frontend/src/`. Calls to the backend go through a typed function in `frontend/src/api.ts`.
- Tests go in the workspace's `test/` folder as `<name>.test.ts(x)` and test behavior through the public interface: service tests without HTTP, endpoint tests with Supertest (see `backend/test/app.test.ts`), component tests with Testing Library. Add or update tests with every change.
- Errors from the API are JSON `{ "error": "..." }`.
- Do not add dependencies or tooling (such as a linter) without a reason in the task.
