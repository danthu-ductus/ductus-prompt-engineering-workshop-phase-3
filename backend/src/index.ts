import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { createMemeCatalog } from "./memes/catalog.js";
import { createSqliteSwipeRepository } from "./swipes/sqlite-repository.js";
import { createSwipeService } from "./swipes/service.js";

const port = Number(process.env.PORT ?? 3000);

// Swipes are stored in this SQLite file so they survive restarts. The default is backend/data/,
// resolved from this file so it is the same whether the backend runs from src/ or dist/.
const databaseFile =
  process.env.DATABASE_FILE ?? fileURLToPath(new URL("../data/meme-tinder.db", import.meta.url));

const swipeService = createSwipeService(
  createMemeCatalog(),
  createSqliteSwipeRepository(databaseFile),
);

// Set STATIC_DIR to the built frontend (frontend/dist) to serve it from this process, as the container does.
const staticDir = process.env.STATIC_DIR;

createApp(swipeService, { staticDir }).listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
  console.log(`Swipes are stored in ${databaseFile}`);
});
