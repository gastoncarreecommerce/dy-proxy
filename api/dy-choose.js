export default async function handler(req, res) {
  // 1) headers CORS en TODAS las respuestas
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 2) Preflight: browser pide OPTIONS
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const key = process.env.DY_SERVER_KEY;
    if (!key) {
      res.status(500).json({ error: 'Missing DY_SERVER_KEY' });
      return;
    }

    const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
    const upstream = await fetch('https://dy-api.com/v2/serve/user/choose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'DY-API-Key': key },
      body
    });
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
