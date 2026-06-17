// modules/xbox/xbox.utils.ts
// deriveGameStatus lives in lib/game.utils.ts — re-exported here so
// xbox.services.ts imports from its own module boundary, same as steam does.
export { deriveGameStatus } from "../../lib/game.utils";
