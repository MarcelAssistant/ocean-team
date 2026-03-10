// Standalone worker entry point — use this if you want to run the worker
// as a separate process instead of embedded in the backend server.
// Usage: pnpm worker
import { startWorker } from "./services/worker.js";

console.log("⚙ ZEUS Worker (standalone mode)");
startWorker();
