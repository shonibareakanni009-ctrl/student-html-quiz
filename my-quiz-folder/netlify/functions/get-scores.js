
const CACHE_TTL = 3000; // milliseconds
let cache = { ts: 0, data: null };

function normalizeRow(row) {
  if (!row || typeof row !== 'object') return null;

  const lookup = {};
  Object.keys(row).forEach(k => {
    lookup[k.toLowerCase().replace(/\s+/g, '')] = row[k];
  });

  const timestamp = lookup.timestamp || lookup.time || lookup.date || lookup['timestamp'] || null;
  const studentName = lookup.studentname || lookup['studentname'] || lookup.name || lookup['studentname'] || lookup['student'] || '';
  const level = lookup.level || '';
  const score = (lookup.score !== undefined && lookup.score !== null) ? Number(lookup.score) : (lookup.points ? Number(lookup.points) : 0);
  const total = (lookup.total !== undefined && lookup.total !== null) ? Number(lookup.total) : (lookup.maximum ? Number(lookup.maximum) : 0);
  const percentage = (lookup.percentage !== undefined && lookup.percentage !== null) ? lookup.percentage : (total ? (Number(score) / Number(total)) : null);

  return {
    timestamp: timestamp ? String(timestamp) : new Date().toISOString(),
    studentName: String(studentName || '').trim(),
    level: String(level || '').trim(),
    score: isNaN(score) ? 0 : score,
    total: isNaN(total) ? 0 : total,
    percentage: percentage
  };
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const now = Date.now();
    if (cache.data && (now - cache.ts) < CACHE_TTL) {
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cache.data) };
    }

    const GOOGLE_SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL;
    if (!GOOGLE_SCRIPT_URL) {
      return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Missing GOOGLE_SCRIPT_URL environment variable' }) };
    }

    const url = `${GOOGLE_SCRIPT_URL}?action=getLatest&limit=200`;
    const res = await fetch(url);
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`Apps Script returned ${res.status} ${txt}`);
    }

    const rows = await res.json();
    if (!Array.isArray(rows)) {
      throw new Error('Unexpected response from Apps Script: expected JSON array');
    }

    const normalized = rows.map(normalizeRow).filter(Boolean);

    cache = { ts: Date.now(), data: normalized };

    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(normalized) };
  } catch (err) {
    console.error('get-scores error:', err);
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: err.message }) };
  }
};
