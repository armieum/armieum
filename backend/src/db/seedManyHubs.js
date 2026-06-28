require("dotenv").config();
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { pool, initSchema } = require("./index");

const COUNT = Number(process.argv[2] || 100);
const BASE_PORT = Number(process.argv[3] || 4100);
const OUT_FILE = path.join(__dirname, "..", "..", "hub_seed_list.csv");

async function main() {
  await initSchema();

  const rows = ["hub_id,claim_secret,provisioning_url"];

  for (let i = 0; i < COUNT; i += 1) {
    const hubId = `MH-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    const secret = crypto.randomBytes(8).toString("hex");
    const secretHash = await bcrypt.hash(secret, 10);
    const port = BASE_PORT + i;
    const provisioningUrl = `http://localhost:${port}/provision`;

    await pool.query(
      `INSERT INTO master_hubs (hub_id, secret_hash, provisioning_url)
       VALUES ($1, $2, $3)
       ON CONFLICT (hub_id) DO NOTHING`,
      [hubId, secretHash, provisioningUrl]
    );

    rows.push(`${hubId},${secret},${provisioningUrl}`);
  }

  fs.writeFileSync(OUT_FILE, rows.join("\n") + "\n", "utf8");
  console.log(`Seeded ${COUNT} hubs.`);
  console.log(`Credentials written to: ${OUT_FILE}`);
  console.log("Each row also includes the simulated hub's portal port (in provisioning_url) so you can start its sim process with:");
  console.log("  HUB_ID=<hub_id> HUB_SECRET=<claim_secret> PORTAL_PORT=<port from url> node sim/masterHub.js");

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
