// Windows + ts-node-dev/concurrently frequently leave an orphaned node
// process still LISTENing on PORT after a terminal is closed with Ctrl+C
// (the respawn child doesn't reliably receive the signal through that
// multi-level process tree) - the next `npm run dev` then crashes with
// EADDRINUSE instead of starting. Run automatically as "predev" (see
// package.json) to clear that stale listener first, so a bad previous
// shutdown never blocks the next start. Safe to run even when the port is
// already free - it just finds nothing to kill.
const { execSync } = require("child_process");
require("dotenv").config();

const port = Number(process.env.PORT || 5000);

const run = (cmd) => {
  try {
    return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString();
  } catch {
    return "";
  }
};

if (process.platform === "win32") {
  const output = run(`netstat -ano -p tcp | findstr :${port}`);
  const pids = new Set();
  output.split("\n").forEach((line) => {
    const parts = line.trim().split(/\s+/);
    const state = parts[3];
    const pid = parts[4];
    if (state === "LISTENING" && pid && pid !== "0") pids.add(pid);
  });
  pids.forEach((pid) => {
    console.log(`[free-port] killing stale process on port ${port} (PID ${pid})`);
    run(`taskkill /F /PID ${pid}`);
  });
} else {
  const output = run(`lsof -t -i :${port} -sTCP:LISTEN`);
  output
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((pid) => {
      console.log(`[free-port] killing stale process on port ${port} (PID ${pid})`);
      run(`kill -9 ${pid}`);
    });
}
