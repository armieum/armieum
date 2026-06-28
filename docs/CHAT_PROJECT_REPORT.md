# Home Automation Project Report

## Purpose
This file captures the full project thinking, decisions, progress, and remaining work for the home automation prototype. Use it to brief others, load into future project chats, or preserve a shared design state.

## 1) Project Goal
Build a custom home automation system for a 2-3 BHK house that makes wall switchboards smart rather than targeting smart appliances.

Key objectives:
- Master hub in hall handles Wi-Fi and RF coordination.
- Slave hubs inside room switchboards control relays for lights/fans.
- Command flow: website -> master hub -> slave hub -> relay.
- Manual wall switch should still function if network fails.
- Prototype uses custom boards instead of Arduino.

## 2) Current Architecture
### Master Hub
- Main MCU: `STM32G0B1`
- Wi-Fi: `ESP32` module acting as modem
- RF: `CC1101` transceiver
- Role: receive web commands, route them over RF, maintain state, manage reliability

### Slave Hub
- MCU: lower-cost `STM32` variant for 5-8 channels
- RF: `CC1101`
- Role: receive RF commands, drive relays, send acknowledgments and status

### Communication Path
`Website -> Backend/API/WebSocket -> MQTT Broker -> ESP32 -> STM32(master) -> CC1101 RF -> Slave MCU -> Relay`

## 3) Decisions Made So Far
- `ESP32` is acceptable for prototype Wi-Fi even though long-term vendor preference prefers non-Chinese parts.
- Keep `ESP32` strictly as Wi-Fi/MQTT modem and use `STM32` for main application logic.
- Use `CC1101` for sub-GHz RF between master and slaves.
- Use a website-first control flow instead of building a mobile app first.
- Adopt a backend + MQTT bridge for reliable messaging rather than direct browser-to-device communication.
- Define message reliability rules: unique message IDs, ACKs, retries, duplicate suppression, heartbeat.
- Add persistence: restore last safe state on reboot/power loss.
- Preserve manual switch operation as a fallback.
- Emphasize safety: mains isolation, proper protection, relay derating.

## 4) Software Stack for Prototype
### Frontend
- `React + Vite` for dashboard UI

### Backend
- `Node.js + Express`
- `WebSocket` for live status updates
- `MQTT` client bridge to publish and subscribe device topics

### MQTT
- Broker: `Mosquitto` recommended for prototype
- Topics:
  - `home/cmd/<room>/<channel>`
  - `home/status/<room>/<channel>`
  - `home/health/master`
  - `home/event/log`

### Firmware
- `ESP32` using `ESP-IDF`
- `STM32` firmware for master and slave nodes

## 5) Completed Work
- Created `AUTOMATION_PROJECT_SUMMARY.md` summarizing architecture, logic, reliability, and steps.
- Created `CHAT_EXPORT.md` with the chat history capture.
- Defined the overall prototype plan in detail.
- Confirmed prototype should start website-first with a backend/MQTT bridge.
- Decided on a phased build approach: board bring-up, protocol, relay integration, pilot testing.

## 6) What Is Left
### Hardware
- Build the first master and slave boards.
- Validate power supply, UART, SPI, and RF interfaces.
- Add relay drivers, switch sensing, and safety circuitry.

### Firmware
- Implement STM32 master firmware for command routing and RF.
- Implement STM32 slave firmware for relay control and acknowledgments.
- Implement ESP32 firmware to bridge MQTT commands to STM32 and publish status.

### Software
- Scaffold the backend project.
- Scaffold the React dashboard.
- Implement MQTT topics, API endpoints, and WebSocket updates.
- Add login/basic security for website prototype.

### Testing
- Validate end-to-end command path with LED or test loads.
- Implement ACK/retry and duplicate suppression.
- Verify heartbeat and offline detection.
- Test manual switch fallback and reboot state restore.
- Run soak tests for reliability.

### Documentation
- Finalize exact UART/RF packet protocol spec.
- Document the board interface and connector wiring.
- Create a BOM and schematic checklist for production.

## 7) Recommended Next Step
Start with the website backend and MQTT bridge first:
1. Create backend service to publish commands and stream status.
2. Build a minimal front-end dashboard with two device controls.
3. Implement ESP32 bridge firmware to move MQTT commands to the STM32.
4. Test one command end-to-end using a simple LED/relay.

## 8) How to Use This File
- Share `CHAT_PROJECT_REPORT.md` with colleagues to show the full concept and status.
- Load the file content into other chat sessions to continue the project from the same design point.
- Use the “What Is Left” section as your current project backlog.

## 9) File Locations
- `g:\openlane\OpenLane\designs\v7e12\AUTOMATION_PROJECT_SUMMARY.md`
- `g:\openlane\OpenLane\designs\v7e12\CHAT_EXPORT.md`
- `g:\openlane\OpenLane\designs\v7e12\CHAT_PROJECT_REPORT.md`

---

This report is the most complete current snapshot of the automation project scope and progress. Keep it with your design files and update it after each major milestone or design decision.