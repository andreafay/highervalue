// Vercel serverless function: POST /api/guess
const players = require('../data/players.json');
const { guessResponse } = require('../lib/game');

const byId = new Map(players.map((p) => [p.id, p]));

module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { status, body } = guessResponse(byId, req.body);
  res.status(status).json(body);
};
