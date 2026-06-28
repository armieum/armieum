const http = require("http");
const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const mqtt = require("mqtt");
const { WebSocketServer } = require("ws");

dotenv.config();

const { initSchema, pool } = require("./db");
const { hashPassword, verifyPassword, signToken, verifyToken, authRequired } = require("./auth");
const hubs = require("./hubs");

const PORT = Number(process.env.PORT || 8080);
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";
const MQTT_URL = process.env.MQTT_URL || "mqtt://localhost:1883";
const MQTT_USERNAME = process.env.MQTT_USERNAME || undefined;
const MQTT_PASSWORD = process.env.MQTT_PASSWORD || undefined;
const SIMULATE_MCU_ACK = /^(1|true|yes)$/i.test(process.env.SIMULATE_MCU_ACK || "true");

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

app.use((req, res, next) => {
  const [rawPath, rawQuery] = req.originalUrl.split("?");
  const normalizedPath = rawPath.replace(/\/{2,}/g, "/");
  if (normalizedPath !== rawPath) {
    const normalizedUrl = rawQuery ? `${normalizedPath}?${rawQuery}` : normalizedPath;
    return res.redirect(301, normalizedUrl);
  }
  return next();
});

// In-memory per-hub device state and connectivity, keyed by hub_id.
// Hubs only appear here once they've authenticated over MQTT (see registerHub).
const hubState = new Map();

// Room/channel ids are opaque and immutable once created — they are what MQTT
// topics and device-state lookups key off, completely independent of the
// human-readable label. Renaming a room or port only ever changes its label;
// the id (and therefore its address/history) never changes.
function generateId(prefix) {
  return `${prefix}-${crypto.randomBytes(4).toString("hex")}`;
}

function flattenDevices(devices) {
  const map = new Map();
  for (const [roomId, channels] of Object.entries(devices || {})) {
    for (const [channelId, info] of Object.entries(channels)) {
      map.set(`${roomId}.${channelId}`, info);
    }
  }
  return map;
}

function buildDevicesFromLayout(layout, previousDevices) {
  const prevMap = flattenDevices(previousDevices);
  const devices = {};
  if (!layout || !Array.isArray(layout.rooms)) {
    return devices;
  }

  for (const room of layout.rooms) {
    const roomId = room.id || room.key;
    devices[roomId] = {};
    for (const channel of room.channels || []) {
      const channelId = channel.id || channel.key;
      const prev = prevMap.get(`${roomId}.${channelId}`);
      devices[roomId][channelId] = {
        state: prev?.state || "OFF",
        source: prev?.source || "init",
        updatedAt: prev?.updatedAt || null,
        label: channel.label,
        type: channel.type,
        roomLabel: room.label,
      };
    }
  }

  return devices;
}

function validateAndNormalizeLayout(rawLayout) {
  if (!rawLayout || !Array.isArray(rawLayout.rooms) || rawLayout.rooms.length === 0) {
    throw new Error("At least one room is required");
  }

  const seenRoomIds = new Set();
  const rooms = rawLayout.rooms.map((room, roomIndex) => {
    const label = String(room.label || "").trim();
    if (!label) {
      throw new Error(`Room ${roomIndex + 1} needs a name`);
    }

    let id = typeof room.id === "string" && room.id ? room.id : generateId("r");
    while (seenRoomIds.has(id)) {
      id = generateId("r");
    }
    seenRoomIds.add(id);

    if (!Array.isArray(room.channels) || room.channels.length === 0) {
      throw new Error(`Room "${label}" needs at least one port/channel`);
    }

    const seenChannelIds = new Set();
    const channels = room.channels.map((channel) => {
      const channelLabel = String(channel.label || "").trim();
      if (!channelLabel) {
        throw new Error(`A channel in room "${label}" needs a name`);
      }

      let channelId = typeof channel.id === "string" && channel.id ? channel.id : generateId("c");
      while (seenChannelIds.has(channelId)) {
        channelId = generateId("c");
      }
      seenChannelIds.add(channelId);

      const type = ["light", "fan", "socket", "other"].includes(channel.type)
        ? channel.type
        : "other";

      return { id: channelId, label: channelLabel, type };
    });

    return { id, label, channels };
  });

  return { rooms };
}

function getOrCreateHubState(hubId, layout) {
  if (!hubState.has(hubId)) {
    hubState.set(hubId, {
      mqttAuthenticated: false,
      lastMessageAt: null,
      devices: buildDevicesFromLayout(layout),
    });
  }
  return hubState.get(hubId);
}

function applyLayoutToHubState(hubId, layout) {
  const hs = getOrCreateHubState(hubId);
  hs.devices = buildDevicesFromLayout(layout, hs.devices);
}

function upsertDevice(hubId, room, channel, nextState, source) {
  const hs = getOrCreateHubState(hubId);
  if (!hs.devices[room]) {
    hs.devices[room] = {};
  }
  const existing = hs.devices[room][channel] || {};
  hs.devices[room][channel] = {
    ...existing,
    state: nextState,
    source,
    updatedAt: new Date().toISOString(),
  };
}

function resolveNextState(hubId, room, channel, action) {
  if (action !== "TOGGLE") {
    return action;
  }
  const current = hubState.get(hubId)?.devices?.[room]?.[channel]?.state || "OFF";
  return current === "ON" ? "OFF" : "ON";
}

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

// Each WebSocket connection is tagged with the hubId of the authenticated user
// who opened it, so broadcasts never cross between different users' hubs.
function broadcastToHub(hubId, event, payload) {
  const message = JSON.stringify({ event, payload, ts: Date.now() });
  for (const client of wss.clients) {
    if (client.readyState === 1 && client.hubId === hubId) {
      client.send(message);
    }
  }
}

wss.on("connection", async (socket, req) => {
  const url = new URL(req.url, "http://localhost");
  const token = url.searchParams.get("token");

  let decoded;
  try {
    decoded = verifyToken(token);
  } catch {
    socket.close(4001, "Invalid or missing token");
    return;
  }

  const hub = await hubs.getHubByOwner(decoded.sub);
  if (!hub) {
    socket.close(4002, "No hub claimed for this account");
    return;
  }

  socket.hubId = hub.hub_id;
  const hs = getOrCreateHubState(hub.hub_id, hub.layout);
  socket.send(
    JSON.stringify({
      event: "snapshot",
      payload: {
        hubId: hub.hub_id,
        wifiConfigured: hub.wifi_configured,
        layoutConfigured: Boolean(hub.layout),
        mqttConnected: hs.mqttAuthenticated,
        devices: hs.devices,
        lastMqttMessageAt: hs.lastMessageAt,
      },
      ts: Date.now(),
    })
  );
});

const mqttClient = mqtt.connect(MQTT_URL, {
  username: MQTT_USERNAME,
  password: MQTT_PASSWORD,
  reconnectPeriod: 3000,
});

mqttClient.on("connect", () => {
  console.log("Backend connected to MQTT broker");
  mqttClient.subscribe("home/+/register");
  mqttClient.subscribe("home/+/status/+/+");
});

mqttClient.on("message", async (topic, messageBuffer) => {
  const parts = topic.split("/");
  const hubId = parts[1];
  let payload;
  try {
    payload = JSON.parse(messageBuffer.toString("utf8"));
  } catch {
    return;
  }

  if (parts[2] === "register") {
    await handleHubRegister(hubId, payload);
    return;
  }

  if (parts[2] === "status" && parts.length === 5) {
    const hs = getOrCreateHubState(hubId);
    if (!hs.mqttAuthenticated) {
      // Ignore status from hubs that never completed the register handshake.
      return;
    }
    const room = parts[3];
    const channel = parts[4];
    if (typeof payload.state !== "string") {
      return;
    }

    upsertDevice(hubId, room, channel, payload.state.toUpperCase(), payload.source || "mcu");
    hs.lastMessageAt = new Date().toISOString();

    broadcastToHub(hubId, "device_status", {
      room,
      channel,
      state: hs.devices[room][channel].state,
      source: hs.devices[room][channel].source,
      updatedAt: hs.devices[room][channel].updatedAt,
    });
  }
});

async function handleHubRegister(hubId, payload) {
  const hub = await hubs.getHubById(hubId);
  if (!hub) {
    console.warn(`Register attempt from unknown hub_id ${hubId}`);
    return;
  }

  const bcrypt = require("bcryptjs");
  const secretOk = payload?.secret && (await bcrypt.compare(payload.secret, hub.secret_hash));
  if (!secretOk) {
    console.warn(`Register attempt from ${hubId} failed authentication`);
    return;
  }

  const hs = getOrCreateHubState(hubId, hub.layout);
  hs.mqttAuthenticated = true;
  await hubs.setHubStatus(hubId, "online");
  console.log(`Hub ${hubId} authenticated and online`);

  if (hub.owner_user_id) {
    broadcastToHub(hubId, "health", { mqttConnected: true });
  }
}

app.get("/api/health", (_, res) => {
  res.json({ ok: true, mqttBrokerConnected: mqttClient.connected });
});

app.get("/", (_, res) => {
  res.status(200).send(
    "Backend is running. Open http://localhost:5173 for UI. API: /api/auth/*, /api/hubs/*, /api/devices, /api/command"
  );
});

// --- Auth routes ---

function userToProfile(user) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    phoneNumber: user.phone_number,
    addressLine1: user.address_line1,
    addressLine2: user.address_line2,
    city: user.city,
    state: user.state,
    postalCode: user.postal_code,
    country: user.country,
  };
}

app.post("/api/auth/signup", async (req, res) => {
  const {
    email,
    password,
    fullName,
    phoneNumber,
    addressLine1,
    addressLine2,
    city,
    state,
    postalCode,
    country,
  } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }
  if (!fullName || !String(fullName).trim()) {
    return res.status(400).json({ error: "Full name is required" });
  }
  if (!phoneNumber || !String(phoneNumber).trim()) {
    return res.status(400).json({ error: "Phone number is required" });
  }

  try {
    const passwordHash = await hashPassword(password);
    const { rows } = await pool.query(
      `INSERT INTO users
        (email, password_hash, full_name, phone_number, address_line1, address_line2, city, state, postal_code, country)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        email.toLowerCase(),
        passwordHash,
        String(fullName).trim(),
        String(phoneNumber).trim(),
        addressLine1 || null,
        addressLine2 || null,
        city || null,
        state || null,
        postalCode || null,
        country || null,
      ]
    );
    const user = rows[0];
    res.status(201).json({ token: signToken(user), user: userToProfile(user) });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "Email already registered" });
    }
    console.error(err);
    res.status(500).json({ error: "Signup failed" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  const { rows } = await pool.query("SELECT * FROM users WHERE email = $1", [email.toLowerCase()]);
  const user = rows[0];
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  res.json({ token: signToken(user), user: userToProfile(user) });
});

app.post("/api/auth/forgot-password", async (req, res) => {
  // No email-sending service is wired up yet. Always return the same
  // generic response regardless of whether the email exists, so this
  // endpoint can't be used to enumerate registered accounts.
  res.json({
    ok: true,
    message:
      "Self-service password reset isn't available yet in this preview. Please contact support to reset your password manually.",
  });
});

app.get("/api/auth/me", authRequired, async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM users WHERE id = $1", [req.userId]);
  const user = rows[0];
  const hub = await hubs.getHubByOwner(req.userId);
  res.json({
    user: user ? userToProfile(user) : { id: req.userId, email: req.userEmail },
    hub: hub
      ? {
          hubId: hub.hub_id,
          wifiConfigured: hub.wifi_configured,
          layoutConfigured: Boolean(hub.layout),
          layout: hub.layout || null,
          status: hub.status,
        }
      : null,
  });
});

app.patch("/api/account", authRequired, async (req, res) => {
  const {
    fullName,
    phoneNumber,
    addressLine1,
    addressLine2,
    city,
    state,
    postalCode,
    country,
  } = req.body || {};

  if (!fullName || !String(fullName).trim()) {
    return res.status(400).json({ error: "Full name is required" });
  }
  if (!phoneNumber || !String(phoneNumber).trim()) {
    return res.status(400).json({ error: "Phone number is required" });
  }

  const { rows } = await pool.query(
    `UPDATE users SET
      full_name = $1,
      phone_number = $2,
      address_line1 = $3,
      address_line2 = $4,
      city = $5,
      state = $6,
      postal_code = $7,
      country = $8
     WHERE id = $9
     RETURNING *`,
    [
      String(fullName).trim(),
      String(phoneNumber).trim(),
      addressLine1 || null,
      addressLine2 || null,
      city || null,
      state || null,
      postalCode || null,
      country || null,
      req.userId,
    ]
  );

  res.json({ ok: true, user: userToProfile(rows[0]) });
});

// --- Hub claim + provisioning routes ---

app.post("/api/hubs/claim", authRequired, async (req, res) => {
  const { hubId, secret } = req.body || {};
  if (!hubId || !secret) {
    return res.status(400).json({ error: "hubId and secret are required" });
  }

  try {
    const hub = await hubs.claimHub(req.userId, hubId, secret);
    res.json({ ok: true, hub: { hubId: hub.hub_id, wifiConfigured: hub.wifi_configured } });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/hubs/provision-wifi", authRequired, async (req, res) => {
  const { ssid, password } = req.body || {};
  if (!ssid || !password) {
    return res.status(400).json({ error: "ssid and password are required" });
  }

  const hub = await hubs.getHubByOwner(req.userId);
  if (!hub) {
    return res.status(404).json({ error: "No hub claimed for this account" });
  }

  try {
    const response = await fetch(hub.provisioning_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ssid, password }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      return res.status(502).json({ error: body.error || "Hub rejected Wi-Fi credentials" });
    }

    await hubs.markWifiConfigured(hub.hub_id);
    res.status(202).json({ ok: true, status: "joining" });
  } catch (err) {
    res.status(502).json({ error: "Could not reach hub's provisioning endpoint", detail: err.message });
  }
});

app.post("/api/hubs/layout", authRequired, async (req, res) => {
  try {
    const normalized = validateAndNormalizeLayout(req.body);
    const hub = await hubs.saveLayout(req.userId, normalized);
    applyLayoutToHubState(hub.hub_id, hub.layout);
    res.json({ ok: true, layout: hub.layout });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- Device routes (scoped to the caller's claimed hub) ---

app.get("/api/devices", authRequired, async (req, res) => {
  const hub = await hubs.getHubByOwner(req.userId);
  if (!hub) {
    return res.status(404).json({ error: "No hub claimed for this account" });
  }

  const hs = getOrCreateHubState(hub.hub_id, hub.layout);
  res.json({
    hubId: hub.hub_id,
    mqttConnected: hs.mqttAuthenticated,
    devices: hs.devices,
    lastMqttMessageAt: hs.lastMessageAt,
  });
});

app.post("/api/command", authRequired, async (req, res) => {
  const { room, channel, action } = req.body || {};
  if (!room || !channel || !action) {
    return res.status(400).json({ error: "room, channel, action are required" });
  }

  const normalized = String(action).toUpperCase();
  if (!["ON", "OFF", "TOGGLE"].includes(normalized)) {
    return res.status(400).json({ error: "action must be ON, OFF, or TOGGLE" });
  }

  const hub = await hubs.getHubByOwner(req.userId);
  if (!hub) {
    return res.status(404).json({ error: "No hub claimed for this account" });
  }

  const hs = getOrCreateHubState(hub.hub_id, hub.layout);
  if (!hs.mqttAuthenticated) {
    return res.status(503).json({ error: "Hub is not online" });
  }

  const cmdId = crypto.randomUUID();
  const topic = `home/${hub.hub_id}/cmd/${room}/${channel}`;
  const payload = JSON.stringify({ cmdId, action: normalized, ts: Date.now() });

  mqttClient.publish(topic, payload, { qos: 1 }, (err) => {
    if (err) {
      return res.status(500).json({ error: "Failed to publish command" });
    }

    broadcastToHub(hub.hub_id, "command_sent", { room, channel, action: normalized, cmdId });

    if (SIMULATE_MCU_ACK) {
      const simulatedState = resolveNextState(hub.hub_id, room, channel, normalized);
      const statusTopic = `home/${hub.hub_id}/status/${room}/${channel}`;
      const statusPayload = JSON.stringify({
        state: simulatedState,
        source: "simulated_mcu",
        cmdId,
        ts: Date.now(),
      });
      mqttClient.publish(statusTopic, statusPayload, { qos: 1 });
    }

    res.status(202).json({ ok: true, cmdId });
  });
});

initSchema()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Backend listening on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to initialize database schema", err);
    process.exit(1);
  });
