CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  phone_number TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS address_line1 TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS address_line2 TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS postal_code TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS country TEXT;

CREATE TABLE IF NOT EXISTS master_hubs (
  hub_id TEXT PRIMARY KEY,
  secret_hash TEXT NOT NULL,
  owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  provisioning_url TEXT NOT NULL,
  wifi_configured BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'offline',
  layout JSONB,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE master_hubs ADD COLUMN IF NOT EXISTS layout JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS one_hub_per_user ON master_hubs(owner_user_id) WHERE owner_user_id IS NOT NULL;
