import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { envConfig } from '../config/env';

let dbInstance: DatabaseSync | null = null;

/**
 * Initializes and returns the SQLite database connection.
 * Enables foreign key enforcement and WAL mode for concurrent read safety.
 * Supports ':memory:' for isolated automated unit/integration testing.
 */
export function getDatabase(customPath?: string): DatabaseSync {
  if (dbInstance && !customPath) {
    return dbInstance;
  }

  const targetPath = customPath ?? envConfig.sqlitePath;
  if (targetPath !== ':memory:') {
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new DatabaseSync(targetPath);
  db.exec('PRAGMA foreign_keys = ON;');
  if (targetPath !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL;');
  }

  applySchema(db);

  if (!customPath) {
    dbInstance = db;
  }
  return db;
}

export function resetDatabaseForTests(db: DatabaseSync): void {
  dbInstance = db;
}

function applySchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'INDIVIDUAL_USER' CHECK (role IN ('INDIVIDUAL_USER','FAMILY_ADMIN','FAMILY_MEMBER','COMMUNITY_MODERATOR','SYSTEM_ADMIN')),
      email_verified INTEGER NOT NULL DEFAULT 0,
      onboarding_completed INTEGER NOT NULL DEFAULT 0,
      accepted_terms_at TEXT NOT NULL,
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      user_agent TEXT NOT NULL DEFAULT '',
      ip_address TEXT NOT NULL DEFAULT '',
      remember_me INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT NOT NULL,
      revoked_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);

    CREATE TABLE IF NOT EXISTS verification_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      country TEXT NOT NULL DEFAULT 'India',
      state_region TEXT NOT NULL DEFAULT 'Delhi NCR',
      city TEXT NOT NULL DEFAULT 'New Delhi',
      postal_code TEXT DEFAULT '',
      latitude REAL NOT NULL DEFAULT 28.6139,
      longitude REAL NOT NULL DEFAULT 77.2090,
      aqi_standard TEXT NOT NULL DEFAULT 'INDIA_NAQI',
      work_mode TEXT NOT NULL DEFAULT 'office',
      commute_distance_km REAL NOT NULL DEFAULT 12,
      primary_transport TEXT NOT NULL DEFAULT 'car_petrol',
      outdoor_activity TEXT NOT NULL DEFAULT 'Morning walk',
      exercise_preference TEXT NOT NULL DEFAULT 'Brisk walking',
      cooking_fuel TEXT NOT NULL DEFAULT 'lpg_piped_gas',
      household_size INTEGER NOT NULL DEFAULT 3,
      public_transit_available INTEGER NOT NULL DEFAULT 1,
      children_count INTEGER NOT NULL DEFAULT 0,
      adults_count INTEGER NOT NULL DEFAULT 2,
      elderly_count INTEGER NOT NULL DEFAULT 0,
      has_sensitive_members INTEGER NOT NULL DEFAULT 0,
      has_air_purifier INTEGER NOT NULL DEFAULT 0,
      ventilation_type TEXT NOT NULL DEFAULT 'natural_windows',
      has_balcony_windows INTEGER NOT NULL DEFAULT 1,
      indoor_cooking_ventilation TEXT NOT NULL DEFAULT 'exhaust_fan',
      has_indoor_sensor INTEGER NOT NULL DEFAULT 0,
      preferred_language TEXT NOT NULL DEFAULT 'en',
      sustainability_goal TEXT NOT NULL DEFAULT 'Reduce car commuting and household energy waste',
      daily_schedule_summary TEXT NOT NULL DEFAULT '07:00 wake, 09:00-18:00 work, 20:00 dinner',
      budget_level TEXT NOT NULL DEFAULT 'low_cost',
      consent_withdrawn INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS locations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      city TEXT NOT NULL,
      region TEXT NOT NULL,
      country TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      default_standard TEXT NOT NULL DEFAULT 'US_EPA'
    );

    CREATE TABLE IF NOT EXISTS environmental_cache (
      cache_key TEXT PRIMARY KEY,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      payload_json TEXT NOT NULL,
      fetched_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS households (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      city TEXT NOT NULL,
      shared_goal TEXT NOT NULL,
      created_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS household_members (
      id TEXT PRIMARY KEY,
      household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      household_role TEXT NOT NULL CHECK (household_role IN ('FAMILY_ADMIN','FAMILY_MEMBER')),
      joined_at TEXT NOT NULL,
      UNIQUE(household_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS household_invitations (
      id TEXT PRIMARY KEY,
      household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
      invited_email TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('FAMILY_ADMIN','FAMILY_MEMBER')),
      token_hash TEXT NOT NULL UNIQUE,
      raw_preview_token TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','ACCEPTED','DECLINED')),
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      city TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_ai_conv_user ON ai_conversations(user_id);

    CREATE TABLE IF NOT EXISTS ai_messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
      sender TEXT NOT NULL CHECK (sender IN ('user','assistant')),
      content_text TEXT NOT NULL,
      structured_json TEXT,
      provider_used TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_ai_msg_conv ON ai_messages(conversation_id);

    CREATE TABLE IF NOT EXISTS daily_routines (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date_iso TEXT NOT NULL,
      city TEXT NOT NULL,
      aqi_at_generation INTEGER NOT NULL,
      aqi_standard TEXT NOT NULL,
      provider_used TEXT NOT NULL,
      summary TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_routines_user ON daily_routines(user_id, date_iso);

    CREATE TABLE IF NOT EXISTS routine_activities (
      id TEXT PRIMARY KEY,
      routine_id TEXT NOT NULL REFERENCES daily_routines(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      scheduled_time TEXT NOT NULL,
      suggested_alternative TEXT NOT NULL,
      exposure_note TEXT NOT NULL,
      environmental_note TEXT NOT NULL,
      reason TEXT NOT NULL,
      is_indoor INTEGER NOT NULL DEFAULT 0,
      completed INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS emission_factors (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL,
      label TEXT NOT NULL,
      unit TEXT NOT NULL,
      baseline_kg_co2e_per_unit REAL NOT NULL,
      alternative_kg_co2e_per_unit REAL NOT NULL,
      fuel_liters_per_unit REAL NOT NULL DEFAULT 0,
      source TEXT NOT NULL,
      region TEXT NOT NULL,
      publication_year INTEGER NOT NULL,
      assumptions TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      household_id TEXT REFERENCES households(id) ON DELETE SET NULL,
      factor_code TEXT NOT NULL REFERENCES emission_factors(code),
      activity_title TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      co2e_avoided_kg REAL NOT NULL,
      fuel_saved_liters REAL NOT NULL DEFAULT 0,
      vehicle_km_avoided REAL NOT NULL DEFAULT 0,
      energy_saved_kwh REAL NOT NULL DEFAULT 0,
      dedup_key TEXT NOT NULL,
      notes TEXT DEFAULT '',
      activity_date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(user_id, dedup_key)
    );
    CREATE INDEX IF NOT EXISTS idx_activity_user_date ON activity_logs(user_id, activity_date);

    CREATE TABLE IF NOT EXISTS communities (
      id TEXT PRIMARY KEY,
      city TEXT NOT NULL UNIQUE,
      region TEXT NOT NULL,
      country TEXT NOT NULL,
      description TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS community_posts (
      id TEXT PRIMARY KEY,
      community_id TEXT NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
      city TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      author_name TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('discussion','initiative','announcement','unverified_report')),
      is_verified INTEGER NOT NULL DEFAULT 0,
      is_removed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS community_reports (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
      reported_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','REVIEWED_KEPT','REVIEWED_REMOVED')),
      reviewed_by_user_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS challenges (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      city TEXT NOT NULL,
      target_unit TEXT NOT NULL,
      target_value REAL NOT NULL,
      safety_note TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS challenge_participations (
      id TEXT PRIMARY KEY,
      challenge_id TEXT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      progress_value REAL NOT NULL DEFAULT 0,
      joined_at TEXT NOT NULL,
      UNIQUE(challenge_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS achievements (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      criteria_metric TEXT NOT NULL,
      criteria_threshold REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_achievements (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      achievement_id TEXT NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
      unlocked_at TEXT NOT NULL,
      UNIQUE(user_id, achievement_id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      severity TEXT NOT NULL CHECK (severity IN ('info','warning','critical')),
      dedup_key TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at);

    CREATE TABLE IF NOT EXISTS notification_preferences (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      aqi_threshold INTEGER NOT NULL DEFAULT 150,
      quiet_hours_start TEXT NOT NULL DEFAULT '22:00',
      quiet_hours_end TEXT NOT NULL DEFAULT '06:30',
      timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
      in_app_enabled INTEGER NOT NULL DEFAULT 1,
      email_enabled INTEGER NOT NULL DEFAULT 0,
      browser_enabled INTEGER NOT NULL DEFAULT 0,
      weekly_report_enabled INTEGER NOT NULL DEFAULT 1,
      unsubscribed_all INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS educational_resources (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      summary TEXT NOT NULL,
      content TEXT NOT NULL,
      source_organization TEXT NOT NULL,
      source_url TEXT NOT NULL,
      reading_minutes INTEGER NOT NULL DEFAULT 4,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS feedback (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      category TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','REVIEWED')),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor_user_id TEXT,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT,
      details TEXT NOT NULL,
      ip_address TEXT DEFAULT '',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

    CREATE TABLE IF NOT EXISTS api_metrics (
      id TEXT PRIMARY KEY,
      service_name TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('success','fallback','error','cache_hit')),
      latency_ms INTEGER NOT NULL DEFAULT 0,
      tokens_estimated INTEGER NOT NULL DEFAULT 0,
      user_id TEXT,
      created_at TEXT NOT NULL
    );
  `);
}
