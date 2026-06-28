require("dotenv").config();
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { pool, initSchema } = require("./index");

async function main() {
  await initSchema();

  const hubId = process.argv[2] || `MH-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
  const secret = crypto.randomBytes(8).toString("hex");
  const secretHash = await bcrypt.hash(secret, 10);
  const provisioningUrl = process.argv[3] || "http://localhost:4001/provision";

  await pool.query(
    `INSERT INTO master_hubs (hub_id, secret_hash, provisioning_url)
     VALUES ($1, $2, $3)
     ON CONFLICT (hub_id) DO UPDATE SET secret_hash = $2, provisioning_url = $3`,
    [hubId, secretHash, provisioningUrl]
  );

  console.log("Seeded master hub:");
  console.log(`  hub_id: ${hubId}`);
  console.log(`  claim secret: ${secret}`);
  console.log(`  provisioning_url: ${provisioningUrl}`);
  console.log("Use these in the frontend hub-claim page, and pass them to the sim hub via env vars.");

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
