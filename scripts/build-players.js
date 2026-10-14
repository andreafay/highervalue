// Downloads the transfermarkt-datasets players table and writes a compact list of playable players.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const URL = 'https://pub-e682421888d945d684bcae8890b0ec20.r2.dev/data/players.csv.gz';
const OUT = path.join(__dirname, '..', 'data', 'players.json');
const MIN_VALUE = 5_000_000;
const MIN_LAST_SEASON = 2025;

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

async function build() {
  console.log('Downloading players.csv.gz ...');
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const csv = zlib.gunzipSync(Buffer.from(await res.arrayBuffer())).toString('utf8');

  const [header, ...rows] = parseCsv(csv);
  const col = Object.fromEntries(header.map((h, i) => [h, i]));
  const players = [];
  for (const r of rows) {
    const value = Number(r[col.market_value_in_eur]);
    const season = Number(r[col.last_season]);
    const image = r[col.image_url];
    if (!(value >= MIN_VALUE) || !(season >= MIN_LAST_SEASON) || !image) continue;
    players.push({
      id: r[col.player_id],
      name: r[col.name],
      club: r[col.current_club_name],
      position: r[col.position],
      image: image.replace('/portrait/header/', '/portrait/big/'),
      value,
    });
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(players));
  console.log(`Wrote ${players.length} players to ${OUT}`);
}

module.exports = build;
if (require.main === module) build().catch((e) => { console.error(e); process.exit(1); });
