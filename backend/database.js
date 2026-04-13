const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function query(text, params) {
  const client = await pool.connect();
  try {
    const res = await client.query(text, params);
    return res;
  } finally {
    client.release();
  }
}

async function initDB() {
  try {
    await query(`CREATE TABLE IF NOT EXISTS users (
      id          SERIAL PRIMARY KEY,
      name        TEXT NOT NULL,
      email       TEXT UNIQUE NOT NULL,
      password    TEXT,
      google_id   TEXT UNIQUE,
      role        TEXT DEFAULT 'reader',
      avatar      TEXT,
      bio         TEXT,
      created_at  TIMESTAMP DEFAULT NOW()
    )`);

    await query(`CREATE TABLE IF NOT EXISTS articles (
      id           SERIAL PRIMARY KEY,
      title        TEXT NOT NULL,
      kicker       TEXT,
      excerpt      TEXT,
      body         TEXT NOT NULL,
      rubrique     TEXT NOT NULL,
      author_id    INTEGER REFERENCES users(id),
      status       TEXT DEFAULT 'draft',
      cover_emoji  TEXT DEFAULT '📰',
      cover_color  TEXT DEFAULT '#0077B6',
      cover_image  TEXT,
      views        INTEGER DEFAULT 0,
      created_at   TIMESTAMP DEFAULT NOW(),
      updated_at   TIMESTAMP DEFAULT NOW()
    )`);

    await query(`CREATE TABLE IF NOT EXISTS polls (
      id         SERIAL PRIMARY KEY,
      question   TEXT NOT NULL,
      active     BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW()
    )`);

    await query(`CREATE TABLE IF NOT EXISTS poll_options (
      id       SERIAL PRIMARY KEY,
      poll_id  INTEGER REFERENCES polls(id) ON DELETE CASCADE,
      label    TEXT NOT NULL,
      votes    INTEGER DEFAULT 0
    )`);

    await query(`CREATE TABLE IF NOT EXISTS poll_voters (
      user_id    INTEGER PRIMARY KEY,
      option_id  INTEGER,
      created_at TIMESTAMP DEFAULT NOW()
    )`);

    await query(`CREATE TABLE IF NOT EXISTS agenda (
      id          SERIAL PRIMARY KEY,
      title       TEXT NOT NULL,
      description TEXT,
      date        TEXT NOT NULL,
      tag         TEXT,
      tag_color   TEXT DEFAULT '#E63946',
      created_at  TIMESTAMP DEFAULT NOW()
    )`);

    await query(`CREATE TABLE IF NOT EXISTS flash_info (
      id       SERIAL PRIMARY KEY,
      text     TEXT NOT NULL,
      emoji    TEXT DEFAULT '📌',
      position INTEGER DEFAULT 0
    )`);

    await query(`CREATE TABLE IF NOT EXISTS rubriques (
      id       SERIAL PRIMARY KEY,
      label    TEXT NOT NULL,
      slug     TEXT UNIQUE NOT NULL,
      color    TEXT DEFAULT '#0077B6',
      position INTEGER DEFAULT 0
    )`);

    await query(`CREATE TABLE IF NOT EXISTS featured (
      id            SERIAL PRIMARY KEY,
      article_id    INTEGER,
      custom_title  TEXT,
      custom_image  TEXT,
      updated_at    TIMESTAMP DEFAULT NOW()
    )`);

    await query(`CREATE TABLE IF NOT EXISTS site_sections (
      id      SERIAL PRIMARY KEY,
      key     TEXT UNIQUE NOT NULL,
      title   TEXT,
      content TEXT,
      image   TEXT,
      updated_at TIMESTAMP DEFAULT NOW()
    )`);

    // Données initiales sondage
    const pollCheck = await query('SELECT COUNT(*) as c FROM polls');
    if (parseInt(pollCheck.rows[0].c) === 0) {
      const p = await query("INSERT INTO polls (question, active) VALUES ($1, TRUE) RETURNING id",
        ["Le cours le plus redouté d'ING1B ?"]);
      const pollId = p.rows[0].id;
      const opts = [["Algèbre linéaire",42],["Mécatronique",31],["Réflexion Humaine",18],["Aucun, on gère 💪",9]];
      for (const [label, votes] of opts) {
        await query('INSERT INTO poll_options (poll_id,label,votes) VALUES ($1,$2,$3)', [pollId, label, votes]);
      }
    }

    // Données initiales flash info
    const flashCheck = await query('SELECT COUNT(*) as c FROM flash_info');
    if (parseInt(flashCheck.rows[0].c) === 0) {
      const items = [
        ["Partiels d'Algèbre linéaire : le 12 avril, Salle B2","📌"],
        ["Tournoi inter-promos de foot : ING1B en demi-finale !","🏆"],
        ["Soutenances du projet Thermostat Autonome : 18 avril","📢"],
        ["Stage académique 2026 : les candidatures sont ouvertes","🎓"],
        ["Soirée de promo ING1B : 25 avril au campus Saint Jean","🎉"],
      ];
      for (const [text, emoji] of items) {
        await query('INSERT INTO flash_info (text,emoji) VALUES ($1,$2)', [text, emoji]);
      }
    }

    // Données initiales agenda
    const agendaCheck = await query('SELECT COUNT(*) as c FROM agenda');
    if (parseInt(agendaCheck.rows[0].c) === 0) {
      const events = [
        ["Partiel d'Algèbre linéaire","Salle B2 · 8h00 → 10h00","2026-04-12","Examen","#92400E"],
        ["Rendu rapport de mécatronique","Dépôt numérique · Avant 23h59","2026-04-15","Rendu","#166534"],
        ["Soutenances projet Thermostat","Amphi principal · 9h00","2026-04-18","Soutenance","#5B21B6"],
        ["Cours de Réflexion Humaine","Salle C1 · Fr. Dominique-Savio · 14h00","2026-04-22","Cours","#0369A1"],
        ["Soirée de la promotion ING1B","Campus Saint Jean · À partir de 19h00","2026-04-25","Événement","#BE123C"],
      ];
      for (const [title, description, date, tag, tag_color] of events) {
        await query('INSERT INTO agenda (title,description,date,tag,tag_color) VALUES ($1,$2,$3,$4,$5)',
          [title, description, date, tag, tag_color]);
      }
    }

    // Rubriques initiales
    const rubCheck = await query('SELECT COUNT(*) as c FROM rubriques');
    if (parseInt(rubCheck.rows[0].c) === 0) {
      const rubs = [
        ["Cours & Projets","cours","#F4A261"],
        ["Vie de classe","vie","#48CAE4"],
        ["Talents","talents","#c084fc"],
        ["Sports & Loisirs","sport","#4ade80"],
        ["Réflexion Humaine","philo","#a78bfa"],
      ];
      for (let i = 0; i < rubs.length; i++) {
        await query('INSERT INTO rubriques (label,slug,color,position) VALUES ($1,$2,$3,$4)',
          [...rubs[i], i]);
      }
    }

    // Section featured par défaut
    const featCheck = await query('SELECT COUNT(*) as c FROM featured');
    if (parseInt(featCheck.rows[0].c) === 0) {
      await query('INSERT INTO featured (article_id, custom_title, custom_image) VALUES (NULL, NULL, NULL)');
    }

    // Section "développeurs cachés" modifiable
    const secCheck = await query("SELECT COUNT(*) as c FROM site_sections WHERE key='featured_banner'");
    if (parseInt(secCheck.rows[0].c) === 0) {
      await query("INSERT INTO site_sections (key,title,content,image) VALUES ('featured_banner','Les développeurs cachés d''ING1B','Jeux en 3D, applications mobiles, sites web… certains de nos camarades codent bien au-delà des cours.',NULL)");
    }

    console.log('✅ Base de données PostgreSQL initialisée');
  } catch(e) {
    console.error('Erreur init DB:', e.message);
  }
}

initDB();

module.exports = { query };
