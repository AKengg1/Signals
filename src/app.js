require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const authRoutes      = require('./routes/auth.routes');
const projectRoutes   = require('./routes/project.routes');
const candidateRoutes = require('./routes/candidate.routes');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
const path = require('path');

app.use(express.static(path.join(__dirname, '../public')));
// ── Global Middleware ────────────────────────────────────────
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',   // tighten in production
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Health check ─────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// ── API Routes ───────────────────────────────────────────────
app.use('/api/auth',       authRoutes);
app.use('/api/projects',   projectRoutes);
app.use('/api/candidates', candidateRoutes);

// ── 404 ──────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));

// ── Error handler (must be last) ─────────────────────────────
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀  Signals API running on http://localhost:${PORT}`);
  console.log(`    ENV: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;