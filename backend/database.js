const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'ing1bmag.db'), (err) => {
  if (err) console.error('Erreur DB:', err);
  else console.log('✅ Base de données SQLite connectée');
});

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    email       TEXT UNIQUE NOT NULL,
    password    TEXT,
    google_id   TEXT UNIQUE,
    role        TEXT DEFAULT 'reader',
    avatar      TEXT,
    bio         TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS articles (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    title        TEXT NOT NULL,
    kicker       TEXT,
    excerpt      TEXT,
    body         TEXT NOT NULL,
    rubrique     TEXT NOT NULL,
    author_id    INTEGER,
    status       TEXT DEFAULT 'draft',
    cover_emoji  TEXT DEFAULT '📰',
    cover_color  TEXT DEFAULT '#1A2E6E',
    views        INTEGER DEFAULT 0,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(author_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS poll_options (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    label   TEXT NOT NULL,
    votes   INTEGER DEFAULT 0
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS poll_voters (
    user_id    INTEGER,
    option_id  INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(user_id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS agenda (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL,
    description TEXT,
    date        TEXT NOT NULL,
    tag         TEXT,
    tag_color   TEXT DEFAULT '#1A2E6E',
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Données initiales du sondage
  db.get('SELECT COUNT(*) as c FROM poll_options', (_, row) => {
    if (row && row.c === 0) {
      const opts = [
        ['Algèbre linéaire', 42],
        ['Mécatronique', 31],
        ['Réflexion Humaine', 18],
        ["Aucun, on gère 💪", 9]
      ];
      opts.forEach(([label, votes]) => {
        db.run('INSERT INTO poll_options (label, votes) VALUES (?,?)', [label, votes]);
      });
    }
  });

  // Données initiales de l'agenda
  db.get('SELECT COUNT(*) as c FROM agenda', (_, row) => {
    if (row && row.c === 0) {
      const events = [
        ['Partiel d\'Algèbre linéaire', 'Salle B2 · 8h00 → 10h00', '2026-04-12', 'Examen', '#92400E'],
        ['Rendu rapport de mécatronique', 'Dépôt numérique · Avant 23h59', '2026-04-15', 'Rendu', '#166534'],
        ['Soutenances projet Thermostat', 'Amphi principal · 9h00', '2026-04-18', 'Soutenance', '#5B21B6'],
        ['Cours de Réflexion Humaine', 'Salle C1 · Fr. Dominique-Savio · 14h00', '2026-04-22', 'Cours', '#0369A1'],
        ['Soirée de la promotion ING1B', 'Campus Saint Jean · À partir de 19h00', '2026-04-25', 'Événement', '#BE123C'],
      ];
      events.forEach(([title, description, date, tag, tag_color]) => {
        db.run('INSERT INTO agenda (title,description,date,tag,tag_color) VALUES (?,?,?,?,?)',
          [title, description, date, tag, tag_color]);
      });
    }
  });
});

module.exports = db;
