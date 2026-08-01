const { COOKIE_NAME } = require('./_session');
module.exports = (request, response) => {
  response.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
  response.status(200).json({ ok: true });
};
