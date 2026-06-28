# Home Automation Prototype Summary

## 1) Project Vision
Build a reliable, scalable home automation system for 2-3 BHK homes using a custom electronics platform (not Arduino boards), focusing on smart wall switchboards instead of smart appliances.

Core interaction:
- User sends command from UI.
- Master hub receives and processes command.
- Master sends RF instruction to room-specific slave hub.
- Slave drives relay channel for the target load (light/fan/etc.).

## 2) High-Level System Concept
Three-layer architecture:
1. User Interface Layer
- Initially: Website (instead of mobile app)
- Later: Mobile app can reuse backend APIs/protocols

2. Control and Connectivity Layer
- Master hub in hall
- Wi-Fi link from UI/backend to master path
- RF link from master to slaves

3. Actuation Layer
- Slave hubs in major switchboards
- Relay driver stages control mains loads
- Manual wall switch behavior retained as fallback

## 3) Proposed Hardware Direction
### Master Hub
- Main MCU: STM32G0B1 (current selection)
- RF transceiver: TI CC1101
- Wi-Fi: ESP32 module (prototype phase, modem role)

### Slave Hub
- MCU: Lower-cost STM32 (for 5-8 I/O needs)
- RF transceiver: TI CC1101
- Relay driver + protection circuitry

## 4) Why ESP32 Was Initially Deprioritized, and Why It Is Fine for Prototype
Initial caution was based on your long-term vendor preference (non-Chinese sourcing and enterprise trust narratives), not on technical weakness.

For prototype, ESP32 is a practical and fast choice if discipline is maintained:
- Keep STM32 as system brain.
- Keep ESP32 focused on Wi-Fi/MQTT/TLS bridge tasks.
- Define a strict host-modem protocol.
- Add watchdogs, heartbeat, and reset recovery.

## 5) Reliability and Robustness Principles (Critical)
1. End-to-end command integrity
- Every command has unique cmd/message ID.
- ACK + retry + timeout required at each hop.
- Duplicate suppression using command ID windows.

2. Health monitoring
- Heartbeat between master and each slave.
- Heartbeat between STM32 and ESP32.
- Offline detection and status propagation to UI.

3. Fail-safe behavior
- Manual switch operation should continue even when RF/Wi-Fi fails.
- Store last safe state in NVM for reboot/power loss restore.
- Brown-out detection and deterministic boot behavior.

4. Safety and electrical protection
- Proper mains/logic isolation and creepage/clearance.
- Fuse, MOV, TVS, flyback/snubber as applicable.
- Relay derating and thermal validation.

5. Security baseline
- Authenticated commands (counter/nonce + integrity checks).
- Secure credentials handling.
- OTA update strategy with rollback for connected components.

## 6) Communication Architecture (Website-First)
Recommended command path:
Website -> Backend API/WebSocket -> MQTT Broker -> ESP32 -> STM32 Master -> CC1101 RF -> Slave -> Relay

Reasoning:
- Browser should not directly control embedded device transport.
- Backend centralizes auth, auditing, and state management.
- MQTT gives simple pub/sub and observability for prototype.

## 7) Suggested Software Stack for Prototype
Frontend:
- React + Vite dashboard

Backend:
- Node.js + Express
- WebSocket for live updates
- MQTT client bridge

Messaging:
- Mosquitto broker (local or cloud test setup)

Firmware:
- ESP32 with ESP-IDF (bridge role)
- STM32 firmware for command routing, RF control, and state logic

## 8) Initial MQTT Topic Model
Commands:
- home/cmd/<room>/<channel>

Status:
- home/status/<room>/<channel>

Health:
- home/health/master

Events/logs:
- home/event/log

Example command payload:
```json
{
  "cmdId": "a1b2c3",
  "action": "ON",
  "ts": 1773000000
}
```

Example status payload:
```json
{
  "state": "ON",
  "source": "web",
  "ts": 1773000001
}
```

## 9) Transport Packet Guidance (UART/RF)
Use a framed packet format:
- SOF | VER | LEN | SRC | DST | TYPE | MSG_ID | PAYLOAD | CRC16

Required message types:
- CMD_SET_CHANNEL
- CMD_GET_STATUS
- EVT_CHANNEL_CHANGED
- EVT_FAULT
- ACK / NACK
- HEARTBEAT

Rules:
- All commands require ACK.
- Retry on timeout (bounded attempts).
- Ignore duplicate MSG_ID where already applied.

## 10) Prototype Scope Recommendation (MVP)
Start small and prove reliability first:
1. One room
2. Two channels (light + fan)
3. ON/OFF/Toggle from website
4. Live status feedback
5. Reboot/power-loss safe restore

## 11) Step-by-Step Build Plan (Execution Sequence)
Phase A: Board bring-up
- Validate power rails and interfaces (UART/SPI)
- Establish STM32<->ESP32 link
- Establish STM32<->CC1101 link (master/slave)
- Verify end-to-end LED toggle over RF

Phase B: Protocol reliability
- Implement cmd ID, ACK/NACK, retries, duplicate filter
- Add heartbeat and offline detection
- Add state persistence in NVM

Phase C: Relay and switchboard integration
- Add relay driver stage and protection
- Add manual switch sensing and conflict resolution
- Sync final state back to master and website

Phase D: Pilot testing
- Deploy one slave in a real switchboard
- Run soak tests (multi-day)
- Capture missed commands, false triggers, resets, and link drops

## 12) Website-First Milestones
1. Backend API + MQTT bridge first
- POST /api/command
- GET /api/devices
- WebSocket /ws for live state push

2. Dashboard UI
- Room cards
- Per-channel controls
- Pending/acknowledged state indicators
- Basic health panel (Wi-Fi, RF, last-seen)

3. Firmware bridge
- ESP32 subscribes to command topics
- Forwards command to STM32 via UART
- Publishes STM32/slave response back to status topics

## 13) Testing Checklist (Before Scaling)
- Single-click correctness (one command = one action)
- Double-click/spam handling (no duplicate toggles)
- Wi-Fi outage recovery
- MQTT broker restart recovery
- Master/slave power cycle behavior
- RF packet-loss resilience
- Long-run stability and error log review

## 14) Common Pitfalls to Avoid
- Splitting business logic unpredictably between STM32 and ESP32
- No message IDs (causes duplicate actions)
- Missing watchdog/reset strategy
- No manual fallback path
- Prioritizing UI polish before reliability hardening

## 15) Recommended Immediate Next Actions
1. Finalize protocol contract (UART and RF fields + ACK rules).
2. Scaffold backend + frontend project and run local MQTT loop.
3. Implement minimal ESP32 UART-MQTT bridge.
4. Validate one end-to-end command with LED before relay/mains integration.

---
This document captures the complete concept and execution direction discussed so far for your automation prototype.