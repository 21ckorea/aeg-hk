const { getSession } = require('./_session');

module.exports = async (request, response) => {
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  try {
    const session = await getSession(request);
    response.status(200).json({ user: session });
  } catch (error) {
    response.status(503).json({ error: error.message });
  }
};
