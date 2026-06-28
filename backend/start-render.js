require("dotenv").config();
const { spawn } = require("child_process");
const bcrypt = require("bcryptjs");
const { initSchema, pool } = require("./src/db");

// On a hosted deployment there's no real hardware yet, so this seeds one
// "demo" master hub and runs its simulated process alongside the backend in
// the same container. Visitors can claim DEMO_HUB_ID with DEMO_HUB_SECRET and
// walk through the full provisioning flow without any setup of their own.
async function ensureDemoHub() {
  const hubId = process.env.DEMO_HUB_ID;
  const secret = process.env.DEMO_HUB_SECRET;
  if (!hubId || !secret) {
    console.log("DEMO_HUB_ID/DEMO_HUB_SECRET not set — skipping demo hub setup.");
    return;
  }

  const port = process.env.DEMO_PORTAL_PORT || "4001";
  const secretHash = await bcrypt.hash(secret, 10);
  await pool.query(
    `INSERT INTO master_hubs (hub_id, secret_hash, provisioning_url)
     VALUES ($1, $2, $3)
     ON CONFLICT (hub_id) DO UPDATE SET secret_hash = $2, provisioning_url = $3`,
    [hubId, secretHash, `http://localhost:${port}/provision`]
  );
  console.log(`Demo hub ${hubId} is ready to claim.`);
}

function spawnProcess(label, args, extraEnv) {
  const child = spawn(process.execPath, args, {
    stdio: "inherit",
    env: { ...process.env, ...extraEnv },
  });
  child.on("exit", (code) => {
    console.error(`[${label}] exited with code ${code}`);
  });
  return child;
}

async function main() {
  await initSchema();
  await ensureDemoHub();
  await pool.end();

  spawnProcess("backend", ["src/server.js"]);

  if (process.env.DEMO_HUB_ID && process.env.DEMO_HUB_SECRET) {
    spawnProcess("demo-sim-hub", ["sim/masterHub.js"], {
      HUB_ID: process.env.DEMO_HUB_ID,
      HUB_SECRET: process.env.DEMO_HUB_SECRET,
      PORTAL_PORT: process.env.DEMO_PORTAL_PORT || "4001",
    });
  }
}

main().catch((err) => {
  console.error("Startup failed", err);
  process.exit(1);
});
