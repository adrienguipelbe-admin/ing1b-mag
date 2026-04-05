require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app = express();

// ── CORS ──────────────────────────────────────────────────────
app.use(cors({
  origin: [
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'http://localhost:3000',
    'https://ing1b-magazine.netlify.app',
    process.env.FRONTEND_URL
  ].filter(Boolean),
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── LOGS ──────────────────────────────────────────────────────
app.use((req, _, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.path}`);
  next();
});

// ── ROUTES ────────────────────────────────────────────────────
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/articles', require('./routes/articles'));
app.use('/api',          require('./routes/misc'));

// ── SANTÉ ─────────────────────────────────────────────────────
app.get('/api/health', (_, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), version: '1.0.0' });
});

// ── ERREURS ───────────────────────────────────────────────────
app.use((err, req, res, _) => {
  console.error(err);
  res.status(500).json({ error: 'Erreur serveur interne' });
});

app.use((_, res) => res.status(404).json({ error: 'Route introuvable' }));

// ── DÉMARRAGE ─────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log('');
  console.log('  ██╗███╗   ██╗ ██████╗  ██╗██████╗     ███╗   ███╗ █████╗  ██████╗');
  console.log('  ██║████╗  ██║██╔════╝ ███║██╔══██╗    ████╗ ████║██╔══██╗██╔════╝');
  console.log('  ██║██╔██╗ ██║██║  ███╗╚██║██████╔╝    ██╔████╔██║███████║██║  ███╗');
  console.log('  ██║██║╚██╗██║██║   ██║ ██║██╔══██╗    ██║╚██╔╝██║██╔══██║██║   ██║');
  console.log('  ██║██║ ╚████║╚██████╔╝ ██║██████╔╝    ██║ ╚═╝ ██║██║  ██║╚██████╔╝');
  console.log('  ╚═╝╚═╝  ╚═══╝ ╚═════╝  ╚═╝╚═════╝     ╚═╝     ╚═╝╚═╝  ╚═╝ ╚═════╝');
  console.log('');
  console.log(`  ✅  Backend démarré sur http://localhost:${PORT}`);
  console.log(`  📁  Base de données : ing1bmag.db`);
  console.log(`  🔑  Admin email     : ${process.env.ADMIN_EMAIL || '(non défini)'}`);
  console.log('');
});
