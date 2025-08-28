// /api/dy-choose.js  — Vercel Serverless Function (CommonJS)

module.exports = async (req, res) => {
  // --- CORS en todas las respuestas ---
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");

  // --- Preflight ---
  if (req.method === "OPTIONS") {
    res.status(204).end(); // No Content
    return;
  }

  // (opcional) healthcheck simple por GET
  if (req.method === "GET") {
    res.status(200).json({ ok: true, route: "/api/dy-choose" });
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const key = process.env.DY_SERVER_KEY; // Server-side key (Serve/Decision API)
    if (!key) {
      res.status(500).json({ error: "Missing DY_SERVER_KEY" });
      return;
    }

    // --- Leer body robusto (string, objeto o stream) ---
    let bodyStr = "";
    if (typeof req.body === "string") {
      bodyStr = req.body;
    } else if (req.body && Object.keys(req.body).length) {
      bodyStr = JSON.stringify(req.body);
    } else {
      await new Promise((resolve, reject) => {
        req.setEncoding("utf8");
        req.on("data", (chunk) => (bodyStr += chunk));
        req.on("end", resolve);
        req.on("error", reject);
      });
      if (!bodyStr) bodyStr = "{}";
    }

    // --- Elegí el datacenter correcto de DY ---
    // EU:
    const DY_URL = "https://dy-api.com/v2/serve/user/choose";
    // US (si tu cuenta es US, reemplazá la línea de arriba por esta):
    // const DY_URL = "https://dy-api.com/v2/serve/user/choose";

    // --- Reenvío a DY ---
    const upstream = await fetch(DY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "DY-API-Key": key,
      },
      body: bodyStr,
    });

    const text = await upstream.text();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch (_) {
      payload = { raw: text };
    }

    // Responder con el mismo status que DY
    res.status(upstream.status).json(payload);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
};
