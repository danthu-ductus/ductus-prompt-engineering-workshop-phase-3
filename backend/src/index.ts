import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { seedDemoPersonas } from "./demo/seed.js";
import { createCompatibilityService } from "./compatibility/service.js";
import { createSqliteMatchRepository } from "./matches/sqlite-repository.js";
import { createMatchService } from "./matches/service.js";
import { createMemeCatalog } from "./memes/catalog.js";
import { createProfileService } from "./profiles/service.js";
import { createStatsService } from "./stats/service.js";
import { createSqliteProfileRepository } from "./profiles/sqlite-repository.js";
import { createSqliteSwipeRepository } from "./swipes/sqlite-repository.js";
import { createSwipeService } from "./swipes/service.js";

const port = Number(process.env.PORT ?? 3000);

// Swipes and profiles are stored in this SQLite file so they survive restarts. The default is backend/data/,
// resolved from this file so it is the same whether the backend runs from src/ or dist/.
const databaseFile =
  process.env.DATABASE_FILE ?? fileURLToPath(new URL("../data/meme-tinder.db", import.meta.url));

const swipeRepository = createSqliteSwipeRepository(databaseFile);
const profileRepository = createSqliteProfileRepository(databaseFile);
const catalog = createMemeCatalog();
const swipeService = createSwipeService(catalog, swipeRepository);

// There is always someone to match with: the labeled demo personas, created once and kept.
seedDemoPersonas(catalog, profileRepository, swipeRepository);

const profileService = createProfileService(profileRepository);
const compatibilityService = createCompatibilityService(swipeRepository, profileRepository);
const matchService = createMatchService(
  swipeRepository,
  profileRepository,
  createSqliteMatchRepository(databaseFile),
);

const statsService = createStatsService(catalog, swipeRepository);

// Set STATIC_DIR to the built frontend (frontend/dist) to serve it from this process, as the container does.
const staticDir = process.env.STATIC_DIR;

createApp(swipeService, profileService, compatibilityService, matchService, statsService, {
  staticDir,
}).listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
  console.log(`Swipes are stored in ${databaseFile}`);
});
