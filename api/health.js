const { neon } = require('@neondatabase/serverless');

module.exports = async (request, response) => {
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  if (!process.env.DATABASE_URL) return response.status(503).json({ ok: false, database: 'not_configured' });
  try {
    const sql = neon(process.env.DATABASE_URL);
    await sql.query('SELECT 1');
    response.status(200).json({ ok: true, database: 'connected', timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Health check failed:', error);
    response.status(503).json({ ok: false, database: 'unavailable' });
  }
};
