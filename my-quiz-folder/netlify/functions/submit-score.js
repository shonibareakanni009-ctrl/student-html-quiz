

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {};

    if (body.action === 'validate-reset') {
      const isCorrect = body.code === process.env.RESET_CODE;
      return {
        statusCode: isCorrect ? 200 : 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: isCorrect })
      };
    }

    const GOOGLE_SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL;
    if (!GOOGLE_SCRIPT_URL) {
      console.error('Missing GOOGLE_SCRIPT_URL environment variable');
      return { statusCode: 500, body: JSON.stringify({ error: 'Server Configuration Error' }) };
    }

    const payload = Object.assign({}, body);
    if (!payload.timestamp) payload.timestamp = new Date().toISOString();

    const res = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const text = await res.text().catch(() => '');
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch (e) { json = { raw: text }; }

    if (!res.ok) {
      console.error('Apps Script responded with error:', res.status, text);
      return {
        statusCode: 502,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Apps Script Sync Failed', details: json || text })
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ok', result: json })
    };

  } catch (error) {
    console.error('Backend Error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message })
    };
  }
};
