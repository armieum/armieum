const bcrypt = require("bcryptjs");
const { pool } = require("./db");

async function getHubByOwner(userId) {
  const { rows } = await pool.query("SELECT * FROM master_hubs WHERE owner_user_id = $1", [userId]);
  return rows[0] || null;
}

async function getHubById(hubId) {
  const { rows } = await pool.query("SELECT * FROM master_hubs WHERE hub_id = $1", [hubId]);
  return rows[0] || null;
}

async function claimHub(userId, hubId, secret) {
  const hub = await getHubById(hubId);
  if (!hub) {
    throw new Error("Hub not found");
  }
  if (hub.owner_user_id) {
    throw new Error("Hub is already claimed");
  }

  const existing = await getHubByOwner(userId);
  if (existing) {
    throw new Error("You have already claimed a hub");
  }

  const secretOk = await bcrypt.compare(secret, hub.secret_hash);
  if (!secretOk) {
    throw new Error("Invalid hub secret");
  }

  const { rows } = await pool.query(
    "UPDATE master_hubs SET owner_user_id = $1, claimed_at = now() WHERE hub_id = $2 RETURNING *",
    [userId, hubId]
  );
  return rows[0];
}

async function markWifiConfigured(hubId) {
  await pool.query("UPDATE master_hubs SET wifi_configured = true WHERE hub_id = $1", [hubId]);
}

async function setHubStatus(hubId, status) {
  await pool.query("UPDATE master_hubs SET status = $1 WHERE hub_id = $2", [status, hubId]);
}

async function saveLayout(userId, layout) {
  const hub = await getHubByOwner(userId);
  if (!hub) {
    throw new Error("No hub claimed for this account");
  }

  const { rows } = await pool.query(
    "UPDATE master_hubs SET layout = $1 WHERE hub_id = $2 RETURNING *",
    [JSON.stringify(layout), hub.hub_id]
  );
  return rows[0];
}

module.exports = {
  getHubByOwner,
  getHubById,
  claimHub,
  markWifiConfigured,
  setHubStatus,
  saveLayout,
};
