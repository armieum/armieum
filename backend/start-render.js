require("dotenv").config();
const { spawn } = require("child_process");
const bcrypt = require("bcryptjs");
const { initSchema, pool } = require("./src/db");

// On a hosted deployment there's no real hardware yet, so this seeds one or
// more "demo" master hubs and runs their simulated processes alongside the
// backend in the same container. Visitors can claim a demo hub and walk
// through the full provisioning flow without any setup of their own.
//
// One hub comes from DEMO_HUB_ID/DEMO_HUB_SECRET/DEMO_PORTAL_PORT (kept for
// backwards compatibility). Any number of additional hubs can be added via
// EXTRA_HUBS, a JSON array like:
//   [{"hubId":"MH-430079","secret":"d84372487084a561","port":4103}]
function collectDemoHubs() {
  const hubs = [];

  if (process.env.DEMO_HUB_ID && process.env.DEMO_HUB_SECRET) {
    hubs.push({
      hubId: process.env.DEMO_HUB_ID,
      secret: process.env.DEMO_HUB_SECRET,
      port: process.env.DEMO_PORTAL_PORT || "4001",
    });
  }

  if (process.env.EXTRA_HUBS) {
    try {
      const extra = JSON.parse(process.env.EXTRA_HUBS);
      for (const entry of extra) {
        if (entry?.hubId && entry?.secret && entry?.port) {
          hubs.push({ hubId: entry.hubId, secret: entry.secret, port: String(entry.port) });
        }
      }
    } catch (err) {
      console.error("EXTRA_HUBS is not valid JSON, ignoring:", err.message);
    }
  }

  return hubs;
}

async function ensureHubSeeded(hub) {
  const secretHash = await bcrypt.hash(hub.secret, 10);
  await pool.query(
    `INSERT INTO master_hubs (hub_id, secret_hash, provisioning_url)
     VALUES ($1, $2, $3)
     ON CONFLICT (hub_id) DO UPDATE SET secret_hash = $2, provisioning_url = $3`,
    [hub.hubId, secretHash, `http://localhost:${hub.port}/provision`]
  );
  console.log(`Demo hub ${hub.hubId} is ready to claim (portal on port ${hub.port}).`);
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

  const demoHubs = collectDemoHubs();
  for (const hub of demoHubs) {
    await ensureHubSeeded(hub);
  }
  await pool.end();

  spawnProcess("backend", ["src/server.js"]);

  for (const hub of demoHubs) {
    spawnProcess(`sim-hub-${hub.hubId}`, ["sim/masterHub.js"], {
      HUB_ID: hub.hubId,
      HUB_SECRET: hub.secret,
      PORTAL_PORT: hub.port,
    });
  }
}

main().catch((err) => {
  console.error("Startup failed", err);
  process.exit(1);
});
