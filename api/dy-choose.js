// /api/dy-choose.js — Vercel Serverless Function (CommonJS), robusto y “APB”
module.exports = async (req, res) => {
  // --- CORS ---
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");

  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method === "GET")    { res.status(200).json({ ok: true, route: "/api/dy-choose" }); return; }
  if (req.method !== "POST")   { res.status(405).json({ error: "Method not allowed" }); return; }

  try {
    const key = process.env.DY_SERVER_KEY;
    if (!key) { res.status(500).json({ error: "Missing DY_SERVER_KEY" }); return; }

    // --- Leer body de forma robusta ---
    let bodyObj = {};
    if (req.body && typeof req.body === "object" && Object.keys(req.body).length) {
      bodyObj = req.body;
    } else {
      let raw = "";
      await new Promise((resolve, reject) => {
        req.setEncoding("utf8");
        req.on("data", (c) => raw += c);
        req.on("end", resolve);
        req.on("error", reject);
      });
      if (raw) {
        try { bodyObj = JSON.parse(raw); } catch (_e) { bodyObj = {}; }
      }
    }

    // --- Sanitizar/inyectar context.page requerido por DY ---
    if (!bodyObj.context) bodyObj.context = {};
    if (!bodyObj.context.page) bodyObj.context.page = {};
    if (!bodyObj.context.page.location || typeof bodyObj.context.page.location !== "string") {
      // Valor por defecto válido si el front no lo envía
      bodyObj.context.page.location = "https://example.com/";
    }
    if (!bodyObj.context.page.type) {
      bodyObj.context.page.type = "HOMEPAGE";
    }
    // opcional: asegurar que choices exista (para evitar 422 por body vacío)
    if (!Array.isArray(bodyObj.choices) && bodyObj.selector && Array.isArray(bodyObj.selector.names)) {
      // convertir viejo formato selector -> choices
      bodyObj.choices = bodyObj.selector.names.map((n) => ({ name: n, count: bodyObj.count || 8 }));
      delete bodyObj.selector;
    }

    const bodyStr = JSON.stringify(bodyObj);

    // --- Elegir región (env o auto) ---
    // Si sabés la región, seteá DY_REGION = "EU" o "US" en Vercel.
    const region = (process.env.DY_REGION || "AUTO").toUpperCase();
    const endpoints = region === "US" ? ["https://dy-api.com/v2/serve/user/choose"]
                    : region === "EU" ? ["https://dy-api.eu/v2/serve/user/choose"]
                    : ["https://dy-api.eu/v2/serve/user/choose", "https://dy-api.com/v2/serve/user/choose"];

    // --- Función que pega al endpoint ---
    async function call(endpoint) {
      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "DY-API-Key": key },
        body: bodyStr
      });
      const text = await r.text();
      let payload; try { payload = JSON.parse(text); } catch { payload = { raw: text }; }
      return { status: r.status, data: payload };
    }

    // --- Intentar endpoints (auto-fallback por 451) ---
    let resp = await call(endpoints[0]);
    if (resp.status === 451 && endpoints[1]) {
      resp = await call(endpoints[1]); // fallback de región
    }

    // Devolver tal cual
    res.status(resp.status).json(resp.data);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
};
