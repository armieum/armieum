# Deploying Armieum so others can try it

This app has four pieces that each need to live somewhere reachable on the
internet: the frontend, the backend, a Postgres database, and an MQTT broker.
The steps below use free tiers of four services. You'll need to sign up for
each one yourself (I can't create accounts on your behalf) — once you have
the credentials from each, hand them back and I'll plug them into the config.

## 0. Put the code on GitHub

Render and Vercel both deploy from a Git repository.

```
git init
git add .
git commit -m "Initial commit"
```

Then create a new repository on GitHub (via the web UI or `gh repo create`)
and push this code to it. Tell me once it's up and I'll help with anything
that needs adjusting.

## 1. Database — Neon (Postgres)

1. Sign up at https://neon.tech (free tier).
2. Create a new project.
3. Copy the connection string it gives you (starts with `postgres://...`).
4. Send me that connection string — I'll set it as `DATABASE_URL`.

## 2. MQTT broker — HiveMQ Cloud

1. Sign up at https://www.hivemq.com/mqtt-cloud-broker/ (free tier).
2. Create a new cluster (free "Serverless" tier is enough).
3. Under "Access Management", create a set of credentials (username/password).
4. Copy the cluster's connection details: host, port (usually `8883`), and
   the credentials.
5. Send me the host/port/username/password — I'll set `MQTT_URL` (as
   `mqtts://<host>:8883`), `MQTT_USERNAME`, and `MQTT_PASSWORD`.

## 3. Backend — Render

1. Sign up at https://render.com (free tier).
2. New → Web Service → connect your GitHub repo.
3. Root directory: `backend`
4. Build command: `npm install`
5. Start command: `npm run start:render`
6. Add environment variables (I'll give you exact values once steps 1–2 are
   done):
   - `DATABASE_URL` (from Neon)
   - `MQTT_URL`, `MQTT_USERNAME`, `MQTT_PASSWORD` (from HiveMQ Cloud)
   - `JWT_SECRET` (any long random string — Render can generate one)
   - `CORS_ORIGIN` (your Vercel URL — fill in after step 4)
   - `SIMULATE_MCU_ACK=true`
   - `DEMO_HUB_ID=MH-DEMO01` (or any ID you like)
   - `DEMO_HUB_SECRET` (any string you choose — this is what visitors enter
     to claim the demo hub)
7. Deploy. Render gives you a URL like `https://armieum-backend.onrender.com`.

`npm run start:render` automatically seeds that demo hub and runs its
simulated process in the same container, so anyone visiting your site can
sign up, claim `DEMO_HUB_ID` using `DEMO_HUB_SECRET`, and walk through the
full Wi-Fi provisioning flow without needing real hardware.

## 4. Frontend — Vercel

1. Sign up at https://vercel.com (free tier).
2. New Project → import the same GitHub repo.
3. Root directory: `frontend`
4. Framework preset: Vite (auto-detected).
5. Add environment variables:
   - `VITE_API_BASE_URL=https://<your-render-backend-url>`
   - `VITE_WS_URL=wss://<your-render-backend-url>/ws`
6. Deploy. Vercel gives you a URL like `https://armieum.vercel.app` — this is
   what you send your friends.

## 5. Close the loop

Go back to Render and update `CORS_ORIGIN` to your Vercel URL, then redeploy
the backend so it accepts requests from the live frontend.

## 6. Try it

Visit your Vercel URL, sign up, claim the demo hub with `DEMO_HUB_ID` /
`DEMO_HUB_SECRET`, provision any fake Wi-Fi network, set up a room, and
control it from the dashboard.
