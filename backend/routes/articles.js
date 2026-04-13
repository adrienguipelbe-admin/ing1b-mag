const express = require('express');
const { query } = require('../database');
const auth    = require('../middleware/auth');

const router = express.Router();

router.get('/', async (req, res) => {
  const { rubrique, status } = req.query;
  let q = `SELECT a.*, u.name as author_name, u.avatar as author_avatar
           FROM articles a LEFT JOIN users u ON a.author_id=u.id WHERE 1=1`;
  const params = [];
  let i = 1;
  if (status === 'all' && req.headers.authorization) {
    // admin sees all
  } else {
    q += ` AND a.status='published'`;
  }
  if (rubrique) { q += ` AND a.rubrique=$${i++}`; params.push(rubrique); }
  q += ' ORDER BY a.created_at DESC';
  try {
    const result = await query(q, params);
    res.json(result.rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await query(
      `SELECT a.*, u.name as author_name FROM articles a LEFT JOIN users u ON a.author_id=u.id WHERE a.id=$1`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Article introuvable' });
    await query('UPDATE articles SET views=views+1 WHERE id=$1', [req.params.id]);
    res.json(result.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Accès refusé' });
  const { title, kicker, excerpt, body, rubrique, cover_emoji, cover_color, cover_image, status } = req.body;
  if (!title || !body || !rubrique) return res.status(400).json({ error: 'Titre, corps et rubrique requis' });
  try {
    const result = await query(
      `INSERT INTO articles (title,kicker,excerpt,body,rubrique,author_id,cover_emoji,cover_color,cover_image,status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [title, kicker||'', excerpt||'', body, rubrique, req.user.id, cover_emoji||'📰', cover_color||'#0077B6', cover_image||null, status||'draft']
    );
    res.status(201).json(result.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Accès refusé' });
  const { title, kicker, excerpt, body, rubrique, cover_emoji, cover_color, cover_image, status } = req.body;
  try {
    const result = await query(
      `UPDATE articles SET title=$1,kicker=$2,excerpt=$3,body=$4,rubrique=$5,
       cover_emoji=$6,cover_color=$7,cover_image=$8,status=$9,updated_at=NOW() WHERE id=$10 RETURNING *`,
      [title, kicker, excerpt, body, rubrique, cover_emoji, cover_color, cover_image, status, req.params.id]
    );
    res.json(result.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.patch('/:id/status', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Accès refusé' });
  const { status } = req.body;
  if (!['draft','published'].includes(status)) return res.status(400).json({ error: 'Statut invalide' });
  try {
    await query('UPDATE articles SET status=$1,updated_at=NOW() WHERE id=$2', [status, req.params.id]);
    res.json({ success: true, status });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Accès refusé' });
  try {
    await query('DELETE FROM articles WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
