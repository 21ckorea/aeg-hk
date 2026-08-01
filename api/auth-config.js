module.exports = (request, response) => {
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  response.status(clientId ? 200 : 503).json(clientId ? { clientId } : { error: 'GOOGLE_CLIENT_ID is not configured.' });
};
