# Armieum Protocol Specification (v1)

Status: Frozen for prototype
Owner: Armieum (Founder: Yash)
Last Updated: 2026-03-13

This document is the contract between:
- Website (frontend)
- Backend API/WebSocket service
- MQTT broker
- ESP32 Wi-Fi bridge
- STM32 master firmware

If implementation differs from this document, update this document first.

## 1. Scope

This v1 spec defines:
- MQTT topics and payloads
- Command lifecycle and acknowledgement behavior
- Idempotency and retry rules
- UART protocol between ESP32 and STM32 (prototype mode)

RF packet format (STM32 master to STM32 slave via CC1101) is out of scope for this file and should be defined in a dedicated RF spec.

## 2. Terminology

- Command: Requested action from UI/backend, e.g. ON/OFF/TOGGLE
- Status: Confirmed state report from device path
- cmdId: Unique identifier per command (UUID string)
- Source: Producer of a message (`web`, `simulated_mcu`, `mcu`, `esp32`, etc.)

## 3. MQTT Topics

### 3.1 Command Topic

Pattern:
`home/cmd/<room>/<channel>`

Example:
`home/cmd/room1/light1`

Publisher:
- Backend only

Subscriber:
- ESP32 bridge

### 3.2 Status Topic

Pattern:
`home/status/<room>/<channel>`

Example:
`home/status/room1/light1`

Publisher:
- ESP32 bridge (real path)
- Backend (simulation mode only)

Subscriber:
- Backend

### 3.3 Reserved Topics (optional/next phase)

- `home/health/master`
- `home/event/log`
- `home/provision/<deviceId>`

## 4. MQTT Payloads

All payloads are JSON encoded in UTF-8.

### 4.1 Command Payload (home/cmd/...)

```json
{
  "cmdId": "8f227687-bb6b-476d-a071-4033af8dce59",
  "action": "ON",
  "ts": 1773256020984
}
```

Fields:
- `cmdId` (string, required): UUID v4 recommended
- `action` (string, required): `ON | OFF | TOGGLE`
- `ts` (number, required): Unix epoch in milliseconds

### 4.2 Status Payload (home/status/...)

```json
{
  "cmdId": "8f227687-bb6b-476d-a071-4033af8dce59",
  "state": "ON",
  "source": "mcu",
  "ts": 1773256021984
}
```

Fields:
- `cmdId` (string, optional but strongly recommended)
- `state` (string, required): `ON | OFF`
- `source` (string, optional): e.g. `mcu`, `simulated_mcu`, `web`
- `ts` (number, recommended): Unix epoch in milliseconds

Optional error extension (allowed):

```json
{
  "cmdId": "...",
  "state": "OFF",
  "source": "mcu",
  "status": "ERROR",
  "errorCode": "SLAVE_TIMEOUT",
  "ts": 1773256022984
}
```

Backend v1 must ignore unknown fields and process valid `state` messages.

## 5. Delivery Rules

- MQTT QoS: `1` for both command and status
- Retain: `false`
- Topic names and action/state values are case-sensitive in this spec (`ON`, `OFF`, `TOGGLE`)

## 6. Command Lifecycle (Authoritative)

1. UI sends `POST /api/command` with `room`, `channel`, `action`
2. Backend validates request and publishes `home/cmd/<room>/<channel>`
3. ESP32 receives command and forwards it to STM32 via UART
4. STM32 executes (or routes onward) and returns ACK/ERR
5. ESP32 publishes `home/status/<room>/<channel>` with final state
6. Backend consumes status and broadcasts `device_status` over WebSocket
7. UI updates card state and clears pending flag

Prototype note:
- Until hardware path is live, backend may publish simulated status when `SIMULATE_MCU_ACK=true`.

## 7. Idempotency and Retry

### 7.1 cmdId rules

- Each command MUST have a unique `cmdId`
- Device path SHOULD keep a short dedup cache by `cmdId` (recommended 5 minutes)
- Duplicate `cmdId` commands must not toggle state multiple times

### 7.2 Timeout/retry defaults

- `CMD_ACK_TIMEOUT_MS = 2000`
- `CMD_MAX_RETRIES = 2`
- If final attempt fails, publish status with unchanged state and optional error extension

## 8. UART Protocol (ESP32 <-> STM32) - Prototype v1

To accelerate bring-up, UART uses JSON Lines (one JSON object per line):
- Encoding: UTF-8
- Frame delimiter: `\n`
- Baud rate: `115200` (initial), 8N1

### 8.1 UART command frame (ESP32 -> STM32)

```json
{"type":"cmd","cmdId":"8f227687-bb6b-476d-a071-4033af8dce59","room":"room1","channel":"light1","action":"ON","ts":1773256020984}
```

### 8.2 UART ack frame (STM32 -> ESP32)

```json
{"type":"ack","cmdId":"8f227687-bb6b-476d-a071-4033af8dce59","ok":true,"state":"ON","errorCode":"NONE","ts":1773256021288}
```

If failure:

```json
{"type":"ack","cmdId":"8f227687-bb6b-476d-a071-4033af8dce59","ok":false,"state":"OFF","errorCode":"SLAVE_TIMEOUT","ts":1773256023288}
```

### 8.3 UART validation requirements

- Ignore malformed JSON lines
- Reject missing required fields
- `cmdId` must be echoed back in ACK
- ACK timeout handling follows section 7.2

## 9. Validation Matrix

Before hardware arrival, validate with MQTT simulator:

1. `ON` command -> status `ON`
2. `OFF` command -> status `OFF`
3. Duplicate command with same `cmdId` -> no duplicate execution
4. Missing status -> pending clears with error path
5. Reconnect scenario -> no stale pending states

## 10. Versioning

- This document defines `Protocol v1`
- Breaking changes require:
  - new version header in this file
  - migration note in backend and firmware changelog

