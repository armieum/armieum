require("dotenv").config();
const http = require("http");
const mqtt = require("mqtt");
const { Pool } = require("pg");

const HUB_ID = process.env.HUB_ID;
const HUB_SECRET = process.env.HUB_SECRET;
const PORTAL_PORT = Number(process.env.PORTAL_PORT || 4001);
const MQTT_URL = process.env.MQTT_URL || "mqtt://localhost:1883";
const MQTT_USERNAME = process.env.MQTT_USERNAME || undefined;
const MQTT_PASSWORD = process.env.MQTT_PASSWORD || undefined;

if (!HUB_ID || !HUB_SECRET) {
  console.error("HUB_ID and HUB_SECRET env vars are required (use values from db/seedHub.js)");
  process.exit(1);
}

const db = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL }) : null;

let mqttClient = null;
let wifiConfigured = false;

// Simulates the ESP32's captive-portal AP server (real hardware would serve this
// at 192.168.4.1 while broadcasting its own setup Wi-Fi network).
const portal = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/provision") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      let payload;
      try {
        payload = JSON.parse(body || "{}");
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "invalid json" }));
      }

      const { ssid, password } = payload;
      if (!ssid || !password) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "ssid and password required" }));
      }

      console.log(`[${HUB_ID}] received Wi-Fi credentials for SSID "${ssid}", joining network...`);
      res.writeHead(202, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, status: "joining" }));

      setTimeout(() => {
        console.log(`[${HUB_ID}] joined Wi-Fi "${ssid}", connecting to MQTT broker...`);
        wifiConfigured = true;
        connectMqtt();
      }, 1500);
    });
    return;
  }

  res.writeHead(404);
  res.end();
});

function sendRegisterHandshake() {
  console.log(`[${HUB_ID}] sending authentication handshake`);
  mqttClient.publish(
    `home/${HUB_ID}/register`,
    JSON.stringify({ hubId: HUB_ID, secret: HUB_SECRET, ts: Date.now() }),
    { qos: 1 }
  );
}

function connectMqtt() {
  // Already connected (e.g. backend restarted and lost its in-memory auth
  // state, but our own MQTT session never dropped) — just re-announce.
  if (mqttClient) {
    if (mqttClient.connected) {
      sendRegisterHandshake();
    }
    return;
  }

  mqttClient = mqtt.connect(MQTT_URL, {
    clientId: `hub-${HUB_ID}`,
    username: MQTT_USERNAME,
    password: MQTT_PASSWORD,
    reconnectPeriod: 3000,
  });

  mqttClient.on("connect", () => {
    console.log(`[${HUB_ID}] connected to MQTT`);
    sendRegisterHandshake();
    mqttClient.subscribe(`home/${HUB_ID}/cmd/+/+`);
  });

  mqttClient.on("message", (topic, messageBuffer) => {
    const parts = topic.split("/");
    if (parts[2] !== "cmd") {
      return;
    }
    const [, , , room, channel] = parts;
    let payload;
    try {
      payload = JSON.parse(messageBuffer.toString("utf8"));
    } catch {
      return;
    }

    console.log(`[${HUB_ID}] command received -> ${room}/${channel}: ${payload.action} (cmdId ${payload.cmdId})`);

    const statusTopic = `home/${HUB_ID}/status/${room}/${channel}`;
    const nextState = payload.action === "TOGGLE" ? "ON" : payload.action;
    mqttClient.publish(
      statusTopic,
      JSON.stringify({ state: nextState, source: "sim_master_hub", cmdId: payload.cmdId, ts: Date.now() }),
      { qos: 1 }
    );
  });

  mqttClient.on("close", () => {
    console.log(`[${HUB_ID}] MQTT connection closed`);
  });
}

portal.listen(PORTAL_PORT, async () => {
  console.log(`[${HUB_ID}] simulated master hub captive portal listening on http://localhost:${PORTAL_PORT}`);

  // Auto-connect if this hub was already provisioned in a previous session
  if (db) {
    try {
      const { rows } = await db.query(
        "SELECT wifi_configured FROM master_hubs WHERE hub_id = $1",
        [HUB_ID]
      );
      if (rows[0]?.wifi_configured) {
        console.log(`[${HUB_ID}] already provisioned — auto-connecting to MQTT`);
        wifiConfigured = true;
        connectMqtt();
        return;
      }
    } catch (e) {
      console.warn(`[${HUB_ID}] DB check failed, falling back to manual provisioning:`, e.message);
    }
  }

  console.log(`[${HUB_ID}] waiting for Wi-Fi provisioning via POST /provision { ssid, password }`);
});
