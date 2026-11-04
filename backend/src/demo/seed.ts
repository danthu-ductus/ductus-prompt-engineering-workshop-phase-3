import type { MemeCatalog } from "../memes/catalog.js";
import type { ProfileRepository } from "../profiles/repository.js";
import type { SwipeRepository } from "../swipes/repository.js";
import { DEMO_PERSONAS, demoUserId } from "./personas.js";

/**
 * Makes sure the demo personas exist, so there is always someone to match with, even on day one.
 * It is safe to call on every start: a persona that already has a profile or swipes is left as it
 * is, so nothing is duplicated and nothing a user changed is overwritten.
 */
export function seedDemoPersonas(
  catalog: MemeCatalog,
  profiles: ProfileRepository,
  swipes: SwipeRepository,
): void {
  const memes = catalog.list();
  for (const persona of DEMO_PERSONAS) {
    const userId = demoUserId(persona);
    if (!profiles.get(userId)) {
      profiles.save({ userId, nickname: persona.nickname, emoji: persona.emoji, demo: true });
    }
    if (swipes.listByUser(userId).length === 0) {
      memes.forEach((meme, position) => {
        swipes.add(userId, {
          memeId: meme.id,
          direction: persona.likes(position) ? "like" : "nope",
        });
      });
    }
  }
}
