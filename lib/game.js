// Game logic shared by the local server (server.js) and the Vercel functions (api/).
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const publicView = ({ id, name, club, image }) => ({ id, name, club, image });

function randomPair(players, exclude) {
  const pool = players.filter((p) => !exclude.has(p.id));
  const source = pool.length >= 2 ? pool : players;
  for (let i = 0; i < 100; i++) {
    const a = pick(source), b = pick(source);
    if (a.id !== b.id && a.value !== b.value) return [a, b];
  }
  return null;
}

// Returns { status, body } for GET /api/pair.
function pairResponse(players, excludeParam) {
  const exclude = new Set(String(excludeParam || '').split(',').filter(Boolean));
  const pair = randomPair(players, exclude);
  return pair ? { status: 200, body: pair.map(publicView) } : { status: 500, body: { error: 'No pair available' } };
}

// Returns { status, body } for POST /api/guess. Values are only revealed here, after the pick.
function guessResponse(byId, { a: aId, b: bId, pick: chosen } = {}) {
  const a = byId.get(String(aId)), b = byId.get(String(bId));
  chosen = String(chosen);
  if (!a || !b || (chosen !== a.id && chosen !== b.id)) return { status: 400, body: { error: 'Invalid guess' } };
  const winner = a.value > b.value ? a : b;
  return { status: 200, body: { correct: chosen === winner.id, values: { [a.id]: a.value, [b.id]: b.value } } };
}

module.exports = { pairResponse, guessResponse };
