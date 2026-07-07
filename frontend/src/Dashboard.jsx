import { useEffect, useMemo, useState } from "react";
import { API_BASE, apiFetch, resolveWsUrl } from "./api";
import Logo from "./Logo";

function formatLabel(text) {
  return String(text || "")
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatTimestamp(isoText) {
  if (!isoText) {
    return "No updates yet";
  }

  const parsed = new Date(isoText);
  if (Number.isNaN(parsed.getTime())) {
    return isoText;
  }

  return parsed.toLocaleString();
}

function Dashboard({ token, hubId, onLogout, onManageRooms, onViewAccount }) {
  const [mqttConnected, setMqttConnected] = useState(false);
  const [devices, setDevices] = useState({});
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pending, setPending] = useState({});
  const [activity, setActivity] = useState([]);

  function pushActivity(level, message) {
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      level,
      message,
      ts: new Date().toISOString(),
    };

    setActivity((prev) => [entry, ...prev].slice(0, 14));
  }

  function applyLocalState(room, channel, action, source = "web") {
    const normalized = String(action || "").toUpperCase();
    const now = new Date().toISOString();

    setDevices((prev) => {
      const current = prev?.[room]?.[channel]?.state || "OFF";
      const nextState =
        normalized === "TOGGLE" ? (current === "ON" ? "OFF" : "ON") : normalized;

      return {
        ...prev,
        [room]: {
          ...(prev[room] || {}),
          [channel]: {
            state: nextState || current,
            source,
            updatedAt: now,
          },
        },
      };
    });

    setLastUpdated(now);
  }

  const deviceRows = useMemo(() => {
    const rows = [];
    Object.entries(devices).forEach(([room, channels]) => {
      Object.entries(channels).forEach(([channel, info]) => {
        rows.push({
          id: `${room}.${channel}`,
          room,
          channel,
          roomLabel: info.roomLabel || formatLabel(room),
          channelLabel: info.label || formatLabel(channel),
          type: info.type || "other",
          state: info.state || "OFF",
          source: info.source || "unknown",
          updatedAt: info.updatedAt || null,
        });
      });
    });
    return rows;
  }, [devices]);

  const roomRows = useMemo(() => {
    const roomMap = {};

    deviceRows.forEach((device) => {
      if (!roomMap[device.room]) {
        roomMap[device.room] = {
          room: device.room,
          roomLabel: device.roomLabel,
          total: 0,
          active: 0,
        };
      }

      roomMap[device.room].total += 1;
      if (device.state === "ON") {
        roomMap[device.room].active += 1;
      }
    });

    return Object.values(roomMap);
  }, [deviceRows]);

  const metrics = useMemo(() => {
    const activeCount = deviceRows.filter((device) => device.state === "ON").length;

    return {
      totalDevices: deviceRows.length,
      activeDevices: activeCount,
      roomCount: roomRows.length,
      pendingCount: Object.keys(pending).length,
    };
  }, [deviceRows, pending, roomRows]);

  useEffect(() => {
    async function loadSnapshot() {
      try {
        const data = await apiFetch("/api/devices", { token });
        setMqttConnected(Boolean(data.mqttConnected));
        setDevices(data.devices || {});
        setLastUpdated(data.lastMqttMessageAt || null);
        pushActivity("info", "Initial system snapshot loaded.");
      } catch (fetchError) {
        const nextError = fetchError.message || "Unexpected error while loading devices";
        setError(nextError);
        pushActivity("error", nextError);
      } finally {
        setLoading(false);
      }
    }

    loadSnapshot();
  }, [token]);

  useEffect(() => {
    let ws;
    let retryTimer;
    let reconnectDelayMs = 1000;
    let isUnmounted = false;

    function scheduleReconnect() {
      if (isUnmounted) {
        return;
      }

      setError("WebSocket disconnected. Reconnecting...");
      retryTimer = setTimeout(connectWebSocket, reconnectDelayMs);
      reconnectDelayMs = Math.min(reconnectDelayMs * 2, 10000);
    }

    function connectWebSocket() {
      if (isUnmounted) {
        return;
      }

      ws = new WebSocket(resolveWsUrl(token));

      ws.onopen = () => {
        reconnectDelayMs = 1000;
        setError((prev) =>
          prev === "WebSocket disconnected. Reconnecting..." ||
          prev === "WebSocket disconnected. Check backend server."
            ? ""
            : prev
        );
        pushActivity("info", "Live gateway channel connected.");
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          if (message.event === "snapshot") {
            setMqttConnected(Boolean(message.payload?.mqttConnected));
            setDevices(message.payload?.devices || {});
            setLastUpdated(message.payload?.lastMqttMessageAt || null);
            return;
          }

          if (message.event === "health") {
            const connected = Boolean(message.payload?.mqttConnected);
            setMqttConnected(connected);
            pushActivity(
              connected ? "info" : "warning",
              connected ? "Master hub connected." : "Master hub disconnected."
            );
            return;
          }

          if (message.event === "command_sent") {
            const payload = message.payload || {};
            const key = `${payload.room}.${payload.channel}`;

            setPending((prev) => {
              const next = { ...prev };
              delete next[key];
              return next;
            });

            if (payload.room && payload.channel && payload.action) {
              applyLocalState(payload.room, payload.channel, payload.action, "web");
              pushActivity(
                "info",
                `${formatLabel(payload.channel)} in ${formatLabel(payload.room)} set to ${payload.action}.`
              );
            }
            return;
          }

          if (message.event === "device_status") {
            const payload = message.payload || {};
            const key = `${payload.room}.${payload.channel}`;

            setDevices((prev) => ({
              ...prev,
              [payload.room]: {
                ...(prev[payload.room] || {}),
                [payload.channel]: {
                  ...(prev[payload.room]?.[payload.channel] || {}),
                  state: payload.state || "OFF",
                  source: payload.source || "mcu",
                  updatedAt: payload.updatedAt || new Date().toISOString(),
                },
              },
            }));

            setPending((prev) => {
              const next = { ...prev };
              delete next[key];
              return next;
            });

            setLastUpdated(payload.updatedAt || new Date().toISOString());
            pushActivity(
              "info",
              `${formatLabel(payload.channel)} acknowledged as ${payload.state || "OFF"} from ${payload.source || "mcu"}.`
            );
          }
        } catch {
          // Ignore malformed events from development restarts.
        }
      };

      ws.onerror = () => {
        ws.close();
      };

      ws.onclose = () => {
        scheduleReconnect();
      };
    }

    connectWebSocket();

    return () => {
      isUnmounted = true;
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
      if (ws) {
        ws.close();
      }
    };
  }, [token]);

  async function sendCommand(room, channel, action) {
    const key = `${room}.${channel}`;
    setError("");
    setPending((prev) => ({ ...prev, [key]: action }));

    try {
      await apiFetch("/api/command", {
        token,
        method: "POST",
        body: JSON.stringify({ room, channel, action }),
      });

      setPending((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      applyLocalState(room, channel, action, "web");
    } catch (commandError) {
      const nextError = commandError.message || "Unable to send command";
      setError(nextError);
      pushActivity("error", nextError);
      setPending((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }

  const nowText = new Date().toLocaleString();

  return (
    <main className="control-center">
      <section className="hero card reveal-up">
        <div className="brand-block">
          <div className="logo-row">
            <Logo size={48} />
          </div>
          <h1>Your home, under control</h1>
          <p className="hero-copy">
            Live status and instant control for every light, fan, and socket connected to your
            master hub — built for everyday reliability, not just a demo.
          </p>
          <div className="identity-row">
            <span className={`identity-chip ${mqttConnected ? "good" : "bad"}`}>
              Hub {hubId}: {mqttConnected ? "Online" : "Offline"}
            </span>
            <button className="btn ghost link-btn" type="button" onClick={onViewAccount}>
              Account
            </button>
            <button className="btn ghost link-btn" type="button" onClick={onManageRooms}>
              Manage rooms
            </button>
            <button className="btn ghost link-btn" type="button" onClick={onLogout}>
              Sign out
            </button>
          </div>
        </div>

        <div className="hero-side">
          <div className="time-panel">
            <p>System Time</p>
            <strong>{nowText}</strong>
          </div>
          <div className="time-panel">
            <p>Last MQTT Update</p>
            <strong>{formatTimestamp(lastUpdated)}</strong>
          </div>
          <div className="time-panel subtle">
            <p>Gateway Endpoint</p>
            <strong>{API_BASE}</strong>
          </div>
        </div>
      </section>

      <section className="metric-grid reveal-up">
        <article className="metric-card">
          <p>Total Channels</p>
          <h2>{metrics.totalDevices}</h2>
        </article>
        <article className="metric-card">
          <p>Active Channels</p>
          <h2>{metrics.activeDevices}</h2>
        </article>
        <article className="metric-card">
          <p>Rooms Online</p>
          <h2>{metrics.roomCount}</h2>
        </article>
        <article className="metric-card">
          <p>Pending Commands</p>
          <h2>{metrics.pendingCount}</h2>
        </article>
      </section>

      {error ? <p className="banner error">{error}</p> : null}
      {loading ? <p className="banner hint">Loading devices and room map...</p> : null}

      <section className="layout-grid reveal-up">
        <div className="left-column">
          <article className="card section-card">
            <div className="section-head">
              <h3>Room Summary</h3>
              <span className="muted">Real-time room occupancy by channel state</span>
            </div>

            <div className="room-grid">
              {roomRows.length === 0 ? (
                <p className="muted">No room telemetry available yet.</p>
              ) : (
                roomRows.map((room) => (
                  <div key={room.room} className="room-chip">
                    <p>{room.roomLabel}</p>
                    <strong>
                      {room.active}/{room.total} active
                    </strong>
                  </div>
                ))
              )}
            </div>
          </article>

          <article className="card section-card">
            <div className="section-head">
              <h3>Device Controls</h3>
              <span className="muted">Issue ON/OFF commands to room channels</span>
            </div>

            <div className="device-grid">
              {deviceRows.length === 0 ? (
                <p className="muted">No channels detected from backend snapshot.</p>
              ) : (
                deviceRows.map((device, index) => {
                  const deviceKey = `${device.room}.${device.channel}`;
                  const isPending = Boolean(pending[deviceKey]);
                  const nextAction = device.state === "ON" ? "OFF" : "ON";

                  return (
                    <article
                      className="device-card"
                      key={device.id}
                      style={{ animationDelay: `${80 + index * 35}ms` }}
                    >
                      <header className="device-head">
                        <div>
                          <p className="mini-kicker">{device.roomLabel}</p>
                          <h4>{device.channelLabel}</h4>
                        </div>
                        <span className={`status-pill ${device.state === "ON" ? "on" : "off"}`}>
                          {device.state}
                        </span>
                      </header>

                      <p className="meta-line">Source: {device.source}</p>
                      <p className="meta-line">Updated: {formatTimestamp(device.updatedAt)}</p>

                      <div className="action-row">
                        <button
                          className="btn ghost"
                          disabled={isPending}
                          onClick={() => sendCommand(device.room, device.channel, "ON")}
                        >
                          Turn ON
                        </button>
                        <button
                          className="btn ghost"
                          disabled={isPending}
                          onClick={() => sendCommand(device.room, device.channel, "OFF")}
                        >
                          Turn OFF
                        </button>
                      </div>

                      <button
                        className="btn primary"
                        disabled={isPending}
                        onClick={() => sendCommand(device.room, device.channel, nextAction)}
                      >
                        {isPending ? "Sending..." : `Turn ${nextAction}`}
                      </button>
                    </article>
                  );
                })
              )}
            </div>
          </article>
        </div>

        <aside className="right-column">
          <article className="card section-card sticky">
            <div className="section-head">
              <h3>Live Activity</h3>
              <span className="muted">Latest command and network events</span>
            </div>

            <div className="activity-feed">
              {activity.length === 0 ? (
                <p className="muted">No events yet.</p>
              ) : (
                activity.map((item) => (
                  <div key={item.id} className={`activity-item ${item.level}`}>
                    <p>{item.message}</p>
                    <small>{formatTimestamp(item.ts)}</small>
                  </div>
                ))
              )}
            </div>
          </article>

          <article className="card section-card">
            <div className="section-head">
              <h3>How it works</h3>
            </div>
            <ul className="detail-list">
              <li>Your commands travel securely from this dashboard to your master hub.</li>
              <li>Your master hub relays each command over a private radio link to the room switchboard.</li>
              <li>Manual wall switches keep working even if Wi-Fi or the dashboard is unavailable.</li>
              <li>Every action is confirmed back to you in real time, so you always know the true state.</li>
            </ul>
          </article>
        </aside>
      </section>
    </main>
  );
}

export default Dashboard;
