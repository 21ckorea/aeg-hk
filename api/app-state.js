const { neon } = require('@neondatabase/serverless');

const STATE_ID = 'global';
const MAX_PAYLOAD_BYTES = 1_000_000;

function sendJson(response, status, body) {
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.status(status).json(body);
}

function getPayload(request) {
  let body = request.body;
  if (Buffer.isBuffer(body)) body = body.toString('utf8');
  if (typeof body === 'string') body = JSON.parse(body);
  if (!body || typeof body !== 'object' || Array.isArray(body) || !('payload' in body)) {
    throw new Error('A JSON object with a payload field is required.');
  }

  const serialized = JSON.stringify(body.payload);
  if (serialized.length > MAX_PAYLOAD_BYTES) throw new Error('Payload exceeds the 1 MB limit.');
  return serialized;
}

module.exports = async (request, response) => {
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  response.setHeader('Allow', 'GET, PUT');

  if (!process.env.DATABASE_URL) {
    sendJson(response, 503, { error: 'DATABASE_URL is not configured.' });
    return;
  }

  const sql = neon(process.env.DATABASE_URL);
  try {
    if (request.method === 'GET') {
      const rows = await sql.query('SELECT payload, updated_at FROM intranet_app_state WHERE id = $1', [STATE_ID]);
      sendJson(response, 200, rows[0]
        ? { payload: rows[0].payload, updatedAt: rows[0].updated_at }
        : { payload: null, updatedAt: null });
      return;
    }

    if (request.method === 'PUT') {
      const payload = getPayload(request);
      const rows = await sql.query(
        `INSERT INTO intranet_app_state (id, payload, updated_at)
         VALUES ($1, $2::jsonb, now())
         ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()
         RETURNING updated_at`,
        [STATE_ID, payload]
      );
      sendJson(response, 200, { updatedAt: rows[0].updated_at });
      return;
    }

    sendJson(response, 405, { error: 'Method not allowed.' });
  } catch (error) {
    const invalidPayload = error instanceof SyntaxError || /payload/i.test(error.message);
    console.error('App state database request failed:', error);
    sendJson(response, invalidPayload ? 400 : 500, {
      error: invalidPayload ? error.message : 'Database request failed.'
    });
  }
};
