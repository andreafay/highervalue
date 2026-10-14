// Vercel serverless function: GET /api/pair
const players = require('../data/players.json');
const { pairResponse } = require('../lib/game');

module.exports = (req, res) => {
  const { status, body } = pairResponse(players, req.query.exclude);
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(body);
};
