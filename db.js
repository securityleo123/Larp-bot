const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'bot.db'));

function init() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS levels (
      user_id TEXT PRIMARY KEY,
      xp      INTEGER DEFAULT 0,
      level   INTEGER DEFAULT 0,
      last_xp INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS staff_checkins (
      user_id  TEXT PRIMARY KEY,
      checked  INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS checkin_window (
      id     INTEGER PRIMARY KEY CHECK (id = 1),
      active INTEGER DEFAULT 0
    );
    INSERT OR IGNORE INTO checkin_window (id, active) VALUES (1, 0);

    CREATE TABLE IF NOT EXISTS strikes (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id   TEXT,
      reason    TEXT,
      issued_by TEXT,
      timestamp INTEGER
    );

    CREATE TABLE IF NOT EXISTS warnings (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id   TEXT,
      reason    TEXT,
      issued_by TEXT,
      timestamp INTEGER
    );
  `);
  console.log('✅ Database initialised');
}

// ─── XP / Leveling ────────────────────────────────────────────────────────────
const XP_PER_MESSAGE = 15;
const XP_COOLDOWN_MS = 60_000; // 1 min cooldown

const LEVEL_THRESHOLDS = [0];
for (let i = 1; i <= 100; i++) {
  LEVEL_THRESHOLDS[i] = LEVEL_THRESHOLDS[i - 1] + 100 + (i - 1) * 50;
}

function xpForLevel(level) {
  return LEVEL_THRESHOLDS[Math.min(level, 100)];
}

function addXP(userId) {
  const now = Date.now();
  let row = db.prepare('SELECT * FROM levels WHERE user_id = ?').get(userId);

  if (!row) {
    db.prepare('INSERT INTO levels (user_id, xp, level, last_xp) VALUES (?, 0, 0, 0)').run(userId);
    row = { user_id: userId, xp: 0, level: 0, last_xp: 0 };
  }

  if (now - row.last_xp < XP_COOLDOWN_MS) return { leveledUp: false, level: row.level };

  const newXP = row.xp + XP_PER_MESSAGE;
  let newLevel = row.level;

  while (newLevel < 100 && newXP >= xpForLevel(newLevel + 1)) {
    newLevel++;
  }

  db.prepare('UPDATE levels SET xp = ?, level = ?, last_xp = ? WHERE user_id = ?')
    .run(newXP, newLevel, now, userId);

  return { leveledUp: newLevel > row.level, level: newLevel };
}

function getLevel(userId) {
  return db.prepare('SELECT * FROM levels WHERE user_id = ?').get(userId) || { xp: 0, level: 0 };
}

function getLeaderboard(limit = 10) {
  return db.prepare('SELECT user_id, xp, level FROM levels ORDER BY xp DESC LIMIT ?').all(limit);
}

// ─── Check-in ─────────────────────────────────────────────────────────────────
function openCheckinWindow() {
  // Pull current staff from strikes table user IDs is not ideal; we track them separately
  db.exec('DELETE FROM staff_checkins');
  db.prepare('UPDATE checkin_window SET active = 1 WHERE id = 1').run();
}

function recordCheckin(userId) {
  const window = db.prepare('SELECT active FROM checkin_window WHERE id = 1').get();
  if (!window?.active) return false;
  const existing = db.prepare('SELECT checked FROM staff_checkins WHERE user_id = ?').get(userId);
  if (existing?.checked) return false;
  db.prepare('INSERT OR REPLACE INTO staff_checkins (user_id, checked) VALUES (?, 1)').run(userId);
  return true;
}

function registerStaffForCheckin(userId) {
  db.prepare('INSERT OR IGNORE INTO staff_checkins (user_id, checked) VALUES (?, 0)').run(userId);
}

function getMissedCheckins() {
  return db.prepare('SELECT user_id FROM staff_checkins WHERE checked = 0').all().map(r => r.user_id);
}

function closeCheckinWindow() {
  db.prepare('UPDATE checkin_window SET active = 0 WHERE id = 1').run();
}

// ─── Strikes ──────────────────────────────────────────────────────────────────
function addStrike(userId, reason, issuedBy) {
  db.prepare('INSERT INTO strikes (user_id, reason, issued_by, timestamp) VALUES (?, ?, ?, ?)')
    .run(userId, reason, issuedBy, Date.now());
  return db.prepare('SELECT COUNT(*) as count FROM strikes WHERE user_id = ?').get(userId).count;
}

function getStrikes(userId) {
  return db.prepare('SELECT * FROM strikes WHERE user_id = ? ORDER BY timestamp DESC').all(userId);
}

function clearStrikes(userId) {
  db.prepare('DELETE FROM strikes WHERE user_id = ?').run(userId);
}

// ─── Warnings ─────────────────────────────────────────────────────────────────
function addWarning(userId, reason, issuedBy) {
  db.prepare('INSERT INTO warnings (user_id, reason, issued_by, timestamp) VALUES (?, ?, ?, ?)')
    .run(userId, reason, issuedBy, Date.now());
  return db.prepare('SELECT COUNT(*) as count FROM warnings WHERE user_id = ?').get(userId).count;
}

function getWarnings(userId) {
  return db.prepare('SELECT * FROM warnings WHERE user_id = ? ORDER BY timestamp DESC').all(userId);
}

function clearWarnings(userId) {
  db.prepare('DELETE FROM warnings WHERE user_id = ?').run(userId);
}

module.exports = {
  init, addXP, getLevel, getLeaderboard,
  openCheckinWindow, recordCheckin, registerStaffForCheckin, getMissedCheckins, closeCheckinWindow,
  addStrike, getStrikes, clearStrikes,
  addWarning, getWarnings, clearWarnings,
};
