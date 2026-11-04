# Changelog

<!-- All notable changes below this line -->

## Unreleased

### Added

- Always someone to match with (#15): six labeled demo personas with fixed, different tastes (Like-It-All Larry, Grumpy Greta, Even Steven, Odd Todd, Picky Pia, Streaky Sam) are created at startup and have swiped every meme, so a user alone in the app gets compatibility scores and can match. Seeding is idempotent. Profiles get an optional `demo` flag (new SQLite column, added to existing databases automatically), shown as a "demo" badge in People like you and in "It's a Match!". User ids starting with `demo-` are reserved (`403`), so nobody can act as a persona

- It's a Match! (#17): two users match at a compatibility score of at least 70% with at least 5 memes swiped by both. `POST /api/matches/check` finds new matches, stores each once per pair in SQLite (so it survives restarts and is never made twice, even when the score drops later), and returns it once to each of the two people. The app checks after every swipe, on start and every 10 seconds, and shows a full-screen "It's a Match!" with both nicknames, confetti (the reusable `Confetti`), a short jingle that stays silent when audio is blocked, and Escape or "Keep swiping" to close. Respects `prefers-reduced-motion`

- Compatibility score and People like you (#13): `GET /api/people` lists every other user with a compatibility score, best match first, built by a new compatibility service (`createCompatibilityService`). The score is the percentage of memes both swiped where they made the same choice, and needs at least 5 memes swiped by both (below that the list shows how many more are needed). A People tab shows "You and Sara are 91% compatible!". Other users appear with a public hash id, nickname and emoji only, never their user id or swipes. `ProfileRepository` gets `list()`

- Feel the swipe: a green LIKE and a red NOPE stamp with a matching color tint that fade in with the drag distance, the same stamp and a fly-off animation for buttons and arrow keys, and an entrance animation for the next card; the card comes back if the swipe request fails (#3)
- Celebrations: a confetti burst and a "5 likes in a row" message on every streak of five likes (a nope starts over), and a bigger celebration on the 100th swipe ever made in the browser (counted in localStorage, so Reset does not restart it) (#3)
- A reusable `Confetti` component, not tied to the like streak, so other celebrations such as "It's a Match!" can use it (#17)
- `prefers-reduced-motion` support: the stamps, tint and messages stay, while the entrance, fly-off, pop and confetti are dropped; built with CSS and React only, no animation library (#3)
- Frontend tests for the stamps, tint and fly-off, the streak and milestone logic, the confetti and the celebrations in the app (#3)
- Profiles (#11): every user has a nickname and an emoji, stored in SQLite next to the swipes and keyed by the same user id, so existing users keep all swipes and likes. A user without a profile gets a generated nickname and a random emoji on first use. `GET /api/profile` and `PUT /api/profile` (nickname required, trimmed, at most 30 characters; exactly one emoji; `400` otherwise), `createProfileService` with a `ProfileRepository` (in-memory and SQLite), a Profile view to change both, and the profile shown in the app header
- Server error messages (`{ "error": "..." }`) are shown by the frontend instead of only the HTTP status

- Vision 002 ("It's a Match!") from the upstream repository in `vision/002-pivot.md`, formatted with Prettier

- Likes survive restarts: a SQLite implementation of `SwipeRepository` (`createSqliteSwipeRepository`, using Node's built-in `node:sqlite`, no new dependency) wired in at startup, with the file set by `DATABASE_FILE` (default `backend/data/meme-tinder.db`); the Docker image stores it in `/app/data`, a named volume in `docker-compose.yml`; the service tests now run against both repositories, plus restart tests with a real database file (#2)

- Guardrails: a GitHub Actions CI workflow (`.github/workflows/ci.yml`) that runs lint, format check, tests and build on every pull request and push to `main`; ESLint (typescript-eslint recommended, React hooks and React refresh rules) and Prettier (`printWidth` 100) configured at the root; `npm run lint`, `npm run format` and `npm run format:check`; `.gitattributes` for LF line endings; README steps for requiring the CI check on `main` (#1)

- 20 more memes (SVG assets and seed entries), bringing the catalog to 30

- Agent guidance in `CLAUDE.md`: architecture, folder structure, commands, coding conventions, extension points (`SwipeRepository`, service vs. HTTP layer) and the rule that `CHANGELOG.md` is updated with every change (#8)

- Docker setup in `deploy/`: multi-stage `Dockerfile` (`node:22-alpine`), `docker-compose.yml` and a `README.md` for Docker and local start; root `.dockerignore` and a link from the root README (#4)
- The backend serves the built frontend when `STATIC_DIR` is set, with an SPA fallback that never answers `/api` paths, plus Supertest tests for it (#4)

- Drag gestures on the swipe card using pointer events (touch and mouse, no gesture library): the card follows the pointer, a release past 100 px likes or nopes, and a shorter release snaps back (#7)
- Left and right arrow keys swipe (nope and like) in the swipe view only, and are ignored while a swipe request is in flight (#7)
- Frontend tests for the `MemeCard` buttons, arrow keys and drag threshold, and for arrow keys and double-swipe protection in the app (#7)

- `GET /api/likes` returns `{ "memes": [...] }` with the user's liked memes in catalog order, and `listLikedMemes` on the swipe service (#6)
- Frontend likes view (`LikesView`) with an empty message, Swipe/Likes navigation and a typed `fetchLikes()` in the API client (#6)
- Service, Supertest and frontend tests for the likes list and likes view (#6)

- Reset of a user's swipes (including likes): `DELETE /api/swipes` (`204`), `resetSwipes` on the swipe service and `clearByUser` on `SwipeRepository` (#5)
- Frontend empty state ("You have seen all memes") with a Reset button, and a typed `resetSwipes()` in the API client (#5)
- Service, Supertest and frontend tests for the reset flow and the empty state (#5)

- Swipe service and in-memory swipe repository (behind a `SwipeRepository` interface) in the backend (#3)
- `POST /api/swipes` endpoint; swiped memes are never returned again, repeated swipes keep the first one (#3)
- Anonymous user id (localStorage) sent as `X-User-Id`, plus Like and Nope buttons in the frontend (#3)
- Frontend error message when the backend is unreachable or returns an error (#3)
- Unit tests for the swipe service, Supertest tests for the swipe endpoints and frontend swipe tests (#3)

- npm workspaces monorepo with `backend` (Express + TypeScript) and `frontend` (React + Vite + TypeScript) (#2)
- Ten original SVG programmer-humour memes with captions and a meme catalog in the backend (#2)
- `GET /api/memes/next` endpoint and static serving of meme images under `/api/memes/images` (#2)
- Frontend that fetches a meme and shows it as a static card, with `/api` proxied to the backend (#2)
- Vitest example tests in both workspaces (Supertest for the backend, Testing Library for the frontend) (#2)
- `.nvmrc` and `engines` requiring Node 22+ and npm 10+; README with requirements and quick start (#2)

### Changed

- `createApp` now takes a match service as its fourth argument (#17)
- `createApp` now takes a compatibility service as its third argument (#13)
- `createApp` now takes a profile service as its second argument (#11)
- All existing code and docs reformatted with Prettier, and the two existing lint errors fixed (the first meme load is deferred out of the effect body in `App.tsx`) (#1)
- The CI job (and so the required status check on `main`) is named `ci`, matching the branch protection rule (#1)
- `MemeCard` now takes `onSwipe(direction)` and owns the Like and Nope buttons, which moved out of `App`; buttons are disabled while a swipe request is in flight (#7)
- The plain "No more memes." text is replaced by the `EmptyState` component (#5)
- `GET /api/memes/next` is now per user (requires `X-User-Id`) and returns `{ "meme": ... }`, with `{ "meme": null }` when all memes are swiped (#3)
- `createApp` now takes a swipe service instead of the meme catalog (#3)
