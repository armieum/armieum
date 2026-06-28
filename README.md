# Home Automation Web Prototype

This workspace is a website-first prototype for controlling MCU-based home automation.

## Protocol Contract

The frozen interface contract is documented in `docs/protocol.md`.

## Architecture

Website (React) -> Backend API/WebSocket (Node.js) -> MQTT -> ESP32 -> STM32 Master -> RF -> Slave

## Folder Structure

- `frontend/` React + Vite dashboard
- `backend/` Express API + MQTT bridge + WebSocket server

## Quick Start

Backend has a website-only development mode enabled by default:

- `SIMULATE_MCU_ACK=true` in `backend/.env`

With this mode, each UI command publishes a simulated `home/status/...` message so status changes even without MCU connected.

### 1. Backend

1. `.env` is already created at `backend/.env` with local defaults.
2. Update MQTT and CORS values if needed.
3. Start backend:

```powershell
cd backend
npm run dev
```

Backend endpoints:

- `GET /api/health`
- `GET /api/devices`
- `POST /api/command`
- WebSocket: `/ws`

### 2. Frontend

1. `.env` is already created at `frontend/.env` with local defaults.
2. Start frontend:

```powershell
cd frontend
npm run dev
```

Default UI URL: `http://localhost:5173`

## API Command Format

`POST /api/command`

```json
{
  "room": "room1",
  "channel": "light1",
  "action": "ON"
}
```

## MQTT Topics

- Commands from backend to ESP32/MCU: `home/cmd/<room>/<channel>`
- Status from MCU path to backend: `home/status/<room>/<channel>`

Status payload example:

```json
{
  "state": "ON",
  "source": "mcu"
}
```

## 2-Minute Smoke Test

1. Start an MQTT broker on `localhost:1883`.
2. Run backend (`cd backend; npm run dev`).
3. Run frontend (`cd frontend; npm run dev`) and open `http://localhost:5173`.
4. Click `Turn ON` for `room1/light1`.
5. In another terminal, publish simulated MCU status:

```powershell
# Option A (recommended in PowerShell): publish payload from file
Set-Content -Path .\status-light1-on.json -Value '{"state":"ON","source":"mcu"}' -NoNewline
& "C:\Program Files\mosquitto\mosquitto_pub.exe" -h localhost -t "home/status/room1/light1" -f .\status-light1-on.json

# Option B (single line): run through cmd.exe to preserve JSON quotes
cmd /c '"C:\Program Files\mosquitto\mosquitto_pub.exe" -h localhost -t home/status/room1/light1 -m "{\"state\":\"ON\",\"source\":\"mcu\"}"'
```

6. Confirm the dashboard updates to `ON` and source `mcu`.

## Next Step

Wire ESP32 firmware to subscribe to `home/cmd/#`, forward commands to STM32 over UART, and publish final state to `home/status/#`.

When MCU ACK is ready, set `SIMULATE_MCU_ACK=false` in `backend/.env`.
