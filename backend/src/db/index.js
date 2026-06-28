const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgres://armieum:armieum_dev_pw@localhost:5432/armieum",
});

async function initSchema() {
  const schemaPath = path.join(__dirname, "schema.sql");
  const sql = fs.readFileSync(schemaPath, "utf8");
  await pool.query(sql);
}

module.exports = { pool, initSchema };
