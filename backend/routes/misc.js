const express = require('express');
const { query } = require('../database');
const auth    = require('../middleware/auth');

const router = express.Router();

// ── AGENDA ───────────────────────────────────────────────────
router.get('/agenda', async (_, res) => {
  try {
    const result = await query('SELECT * FROM agenda ORDER BY date ASC');
    res.json(result.rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/agenda', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Accès refusé' });
  const { title, description, date, tag, tag_color } = req.body;
  if (!title || !date) return res.status(400).json({ error: 'Titre et date requis' });
  try {
    const result = await query(
      'INSERT INTO agenda (title,description,date,tag,tag_color) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [title, description||'', date, tag||'', tag_color||'#E63946']
    );
    res.status(201).json(result.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/agenda/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Accès refusé' });
  try {
    await query('DELETE FROM agenda WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── SONDAGE ──────────────────────────────────────────────────
router.get('/poll', async (_, res) => {
  try {
    const pollRes = await query('SELECT * FROM polls WHERE active=TRUE ORDER BY id DESC LIMIT 1');
    if (!pollRes.rows[0]) return res.json({ question: null, options: [], total: 0 });
    const poll = pollRes.rows[0];
    const optsRes = await query('SELECT * FROM poll_options WHERE poll_id=$1 ORDER BY id', [poll.id]);
    const total = optsRes.rows.reduce((s,r) => s + r.votes, 0);
    res.json({ id: poll.id, question: poll.question, options: optsRes.rows, total });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/poll', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Accès refusé' });
  const { question, options } = req.body;
  if (!question || !options || options.length < 2)
    return res.status(400).json({ error: 'Question et 2 options min.' });
  try {
    await query('UPDATE polls SET active=FALSE');
    await query('DELETE FROM poll_voters');
    const pollRes = await query('INSERT INTO polls (question, active) VALUES ($1, TRUE) RETURNING id', [question]);
    const pollId = pollRes.rows[0].id;
    for (const label of options) {
      await query('INSERT INTO poll_options (poll_id,label,votes) VALUES ($1,$2,0)', [pollId, label]);
    }
    res.json({ success: true, pollId });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/poll/:optionId/vote', auth, async (req, res) => {
  const userId = req.user.id;
  const optionId = parseInt(req.params.optionId);
  const previousId = req.body && req.body.previous ? parseInt(req.body.previous) : null;
  try {
    if (previousId) {
      await query('UPDATE poll_options SET votes=GREATEST(0,votes-1) WHERE id=$1', [previousId]);
    }
    await query('UPDATE poll_options SET votes=votes+1 WHERE id=$1', [optionId]);
    await query('INSERT INTO poll_voters (user_id,option_id) VALUES ($1,$2) ON CONFLICT (user_id) DO UPDATE SET option_id=$2', [userId, optionId]);
    const optRes = await query('SELECT poll_id FROM poll_options WHERE id=$1', [optionId]);
    const pollId = optRes.rows[0].poll_id;
    const optsRes = await query('SELECT * FROM poll_options WHERE poll_id=$1 ORDER BY id', [pollId]);
    const total = optsRes.rows.reduce((s,r) => s + r.votes, 0);
    res.json({ options: optsRes.rows, total, voted: optionId });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── FLASH INFO ───────────────────────────────────────────────
router.get('/flash', async (_, res) => {
  try {
    const result = await query('SELECT * FROM flash_info ORDER BY position ASC, id ASC');
    res.json(result.rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/flash', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Accès refusé' });
  const { text, emoji } = req.body;
  if (!text) return res.status(400).json({ error: 'Texte requis' });
  try {
    const result = await query('INSERT INTO flash_info (text,emoji) VALUES ($1,$2) RETURNING *', [text, emoji||'📌']);
    res.status(201).json(result.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/flash/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Accès refusé' });
  try {
    await query('DELETE FROM flash_info WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── RUBRIQUES ────────────────────────────────────────────────
router.get('/rubriques', async (_, res) => {
  try {
    const result = await query('SELECT * FROM rubriques ORDER BY position ASC');
    res.json(result.rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/rubriques', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Accès refusé' });
  const { label, slug, color } = req.body;
  if (!label || !slug) return res.status(400).json({ error: 'Label et slug requis' });
  try {
    const result = await query(
      'INSERT INTO rubriques (label,slug,color) VALUES ($1,$2,$3) RETURNING *',
      [label, slug.toLowerCase().replace(/\s+/g,'-'), color||'#0077B6']
    );
    res.status(201).json(result.rows[0]);
  } catch(e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Ce slug existe déjà' });
    res.status(500).json({ error: e.message });
  }
});

router.delete('/rubriques/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Accès refusé' });
  try {
    await query('DELETE FROM rubriques WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── SECTION BANNIÈRE MODIFIABLE ──────────────────────────────
router.get('/section/:key', async (req, res) => {
  try {
    const result = await query('SELECT * FROM site_sections WHERE key=$1', [req.params.key]);
    res.json(result.rows[0] || null);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.put('/section/:key', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Accès refusé' });
  const { title, content, image } = req.body;
  try {
    const result = await query(
      `INSERT INTO site_sections (key,title,content,image) VALUES ($1,$2,$3,$4)
       ON CONFLICT (key) DO UPDATE SET title=$2, content=$3, image=COALESCE($4,site_sections.image), updated_at=NOW() RETURNING *`,
      [req.params.key, title, content, image||null]
    );
    res.json(result.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
