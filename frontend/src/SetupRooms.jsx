import { useState } from "react";
import { apiFetch } from "./api";
import Logo from "./Logo";

const CHANNEL_TYPES = ["light", "fan", "socket", "other"];

function makeRoom(label = "") {
  return { label, channels: [{ label: "", type: "light" }] };
}

function cloneFromExisting(layout) {
  if (!layout || !Array.isArray(layout.rooms) || layout.rooms.length === 0) {
    return [makeRoom("Bedroom 1")];
  }

  return layout.rooms.map((room) => ({
    id: room.id,
    label: room.label,
    channels: room.channels.map((channel) => ({
      id: channel.id,
      label: channel.label,
      type: channel.type,
    })),
  }));
}

function SetupRooms({ token, hubId, initialLayout, onConfigured, onCancel }) {
  const [rooms, setRooms] = useState(() => cloneFromExisting(initialLayout));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function updateRoomLabel(roomIndex, label) {
    setRooms((prev) => prev.map((room, i) => (i === roomIndex ? { ...room, label } : room)));
  }

  function addRoom() {
    setRooms((prev) => [...prev, makeRoom("")]);
  }

  function removeRoom(roomIndex) {
    setRooms((prev) => prev.filter((_, i) => i !== roomIndex));
  }

  function addChannel(roomIndex) {
    setRooms((prev) =>
      prev.map((room, i) =>
        i === roomIndex ? { ...room, channels: [...room.channels, { label: "", type: "light" }] } : room
      )
    );
  }

  function removeChannel(roomIndex, channelIndex) {
    setRooms((prev) =>
      prev.map((room, i) =>
        i === roomIndex
          ? { ...room, channels: room.channels.filter((_, ci) => ci !== channelIndex) }
          : room
      )
    );
  }

  function updateChannel(roomIndex, channelIndex, field, value) {
    setRooms((prev) =>
      prev.map((room, i) => {
        if (i !== roomIndex) return room;
        const channels = room.channels.map((channel, ci) =>
          ci === channelIndex ? { ...channel, [field]: value } : channel
        );
        return { ...room, channels };
      })
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);

    try {
      await apiFetch("/api/hubs/layout", {
        token,
        method: "POST",
        body: JSON.stringify({ rooms }),
      });
      onConfigured();
    } catch (err) {
      setError(err.message || "Could not save room setup");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="control-center">
      <section className="hero card reveal-up auth-card setup-card">
        <div className="brand-block">
          <div className="logo-row">
            <Logo size={40} />
          </div>
          <h1>Map out your home</h1>
          <p className="hero-copy">
            Add each room connected to {hubId}, and the switches, fans, or sockets in it. Names
            are just for display — you can rename anything later without losing your setup.
          </p>

          <form className="auth-form" onSubmit={handleSubmit}>
            {rooms.map((room, roomIndex) => (
              <div key={roomIndex} className="room-setup-block">
                <div className="room-setup-head">
                  <input
                    type="text"
                    placeholder="Room name, e.g. Bedroom 1, Hall, Kitchen"
                    value={room.label}
                    onChange={(event) => updateRoomLabel(roomIndex, event.target.value)}
                    required
                  />
                  {rooms.length > 1 ? (
                    <button type="button" className="btn ghost" onClick={() => removeRoom(roomIndex)}>
                      Remove room
                    </button>
                  ) : null}
                </div>

                {room.channels.map((channel, channelIndex) => (
                  <div key={channelIndex} className="channel-setup-row">
                    <input
                      type="text"
                      placeholder="Port name, e.g. LED 1, Fan, Socket"
                      value={channel.label}
                      onChange={(event) =>
                        updateChannel(roomIndex, channelIndex, "label", event.target.value)
                      }
                      required
                    />
                    <select
                      value={channel.type}
                      onChange={(event) =>
                        updateChannel(roomIndex, channelIndex, "type", event.target.value)
                      }
                    >
                      {CHANNEL_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                    {room.channels.length > 1 ? (
                      <button
                        type="button"
                        className="btn ghost"
                        onClick={() => removeChannel(roomIndex, channelIndex)}
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                ))}

                <button type="button" className="btn ghost" onClick={() => addChannel(roomIndex)}>
                  + Add port to {room.label || "this room"}
                </button>
              </div>
            ))}

            <button type="button" className="btn ghost" onClick={addRoom}>
              + Add another room
            </button>

            {error ? <p className="banner error">{error}</p> : null}

            <div className="action-row">
              <button className="btn primary" type="submit" disabled={busy}>
                {busy ? "Saving..." : "Save setup and continue"}
              </button>
              {onCancel ? (
                <button type="button" className="btn ghost" onClick={onCancel} disabled={busy}>
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}

export default SetupRooms;
