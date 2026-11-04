# Meme-Tinder

Tinder but for memes

A proof of concept that workshop teams fork and extend. It is an npm workspaces monorepo:

- `backend/`: Express + TypeScript API on port 3000. Serves the seed memes (original SVGs in `backend/assets/memes`).
- `frontend/`: React + Vite + TypeScript on port 5173. The dev server proxies `/api` to the backend.

## Requirements

- Node.js 22 or newer (see `.nvmrc`; run `nvm use` if you use nvm)
- npm 10 or newer

## Quick start

```bash
npm install
npm run dev
```

To run in Docker instead, or for more detail on both options, see [deploy/README.md](deploy/README.md).

Open http://localhost:5173, then swipe memes by dragging the card, with the Like and Nope buttons or with the left and right arrow keys, and use the Likes tab to see what you liked. When all memes are swiped, press Reset to start over.

## Commands

| Command                | What it does                                               |
| ---------------------- | ---------------------------------------------------------- |
| `npm run dev`          | Starts backend and frontend in watch mode                  |
| `npm test`             | Runs all backend and frontend tests                        |
| `npm run build`        | Builds both workspaces                                     |
| `npm run lint`         | Lints both workspaces with ESLint                          |
| `npm run format`       | Formats all files with Prettier                            |
| `npm run format:check` | Checks that all files are formatted, without changing them |

## Continuous integration

Every pull request and every push to `main` runs the CI workflow in `.github/workflows/ci.yml`: `npm ci`, `npm run lint`, `npm run format:check`, `npm test` and `npm run build`. A failing test, a type error, a lint error or unformatted code makes the check red.

ESLint and Prettier are configured once at the repository root (`eslint.config.js`, `.prettierrc.json`). `.gitattributes` keeps LF line endings on every OS so the format check gives the same result on Windows.

### Branch protection on `main`

`main` must require the CI check before merging. This needs admin rights on the repository, so a repository admin sets it once:

1. Open **Settings → Branches** (or **Rules → Rulesets**) and add a rule for `main`.
2. Turn on **Require status checks to pass before merging** and select the check **ci** (it shows up after the workflow has run once).
3. Turn on **Require a pull request before merging** so changes cannot be pushed straight to `main`.

Or with the GitHub CLI (replace `OWNER/REPO`):

```bash
gh api -X PUT repos/OWNER/REPO/branches/main/protection --input - <<'JSON'
{
  "required_status_checks": { "strict": true, "contexts": ["ci"] },
  "enforce_admins": false,
  "required_pull_request_reviews": { "required_approving_review_count": 0 },
  "restrictions": null
}
JSON
```

## API

All endpoints are under `/api` and need an `X-User-Id` header (the frontend creates an anonymous id on first visit and stores it in localStorage).

| Endpoint              | Description                                                                                                                                                                                                                                                                                                                                        |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/memes/next` | `200 { "meme": {...} }` with the next unseen meme, or `200 { "meme": null }` when all memes have been swiped                                                                                                                                                                                                                                       |
| `POST /api/swipes`    | Body `{ "memeId": "...", "direction": "like" \| "nope" }`. `200` with the stored swipe                                                                                                                                                                                                                                                             |
| `GET /api/likes`      | `200 { "memes": [...] }` with the user's liked memes in catalog order (`[]` when nothing is liked)                                                                                                                                                                                                                                                 |
| `GET /api/profile`    | `200 { "profile": { "userId", "nickname", "emoji" } }`. A user without a profile gets one with a generated nickname and a random emoji. Existing swipes and likes are kept                                                                                                                                                                         |
| `PUT /api/profile`    | Body `{ "nickname": "...", "emoji": "..." }`. `200` with the saved profile. `400` for an empty nickname (after trimming), one longer than 30 characters, or an emoji that is not exactly one emoji                                                                                                                                                 |
| `GET /api/people`     | `200 { "people": [...] }`: every other user with `id` (a public hash, not the user id), `nickname`, `emoji`, `sharedCount`, `score` and `memesNeeded`, best match first. The score is the percentage of memes both swiped where you made the same choice, and is `null` until both have swiped at least 5 memes. Never contains user ids or swipes |
| `DELETE /api/swipes`  | Removes all of the user's swipes, including likes. `204 No Content`; safe to call repeatedly                                                                                                                                                                                                                                                       |

Errors are JSON `{ "error": "..." }`: `400` for a missing user id, missing meme id or invalid direction, `404` for an unknown meme id. Swiping the same meme twice is idempotent: the first swipe is kept.

Profiles are stored in the same SQLite file as the swipes (`backend/src/profiles/`). A profile uses the same user id as the swipes, so everything a user did before profiles existed stays theirs.

Swipes are stored in a SQLite database file (`backend/src/swipes/sqlite-repository.ts`, using Node's built-in `node:sqlite`), so likes survive restarts. Locally the file is `backend/data/meme-tinder.db`; set `DATABASE_FILE` to change it. See [deploy/README.md](deploy/README.md) for where Docker keeps it. To use another database, implement `SwipeRepository` (`backend/src/swipes/repository.ts`) and pass it to `createSwipeService` in `backend/src/index.ts`.
