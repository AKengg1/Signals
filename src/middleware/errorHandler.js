/**
 * Central error handler — always returns JSON.
 * Mount last in app.js:  app.use(errorHandler)
 */
const errorHandler = (err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path}`, err.message);

  // PostgreSQL unique-violation
  if (err.code === '23505') {
    return res.status(409).json({ error: 'Resource already exists', detail: err.detail });
  }

  // PostgreSQL foreign-key violation
  if (err.code === '23503') {
    return res.status(400).json({ error: 'Referenced resource not found', detail: err.detail });
  }

  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

/**
 * Async wrapper — eliminates repetitive try/catch in controllers.
 * Usage: router.get('/', asyncHandler(async (req, res) => { ... }))
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = { errorHandler, asyncHandler };