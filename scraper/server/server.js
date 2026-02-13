// Proxy minimale: riceve richieste GET dal FE, le inoltra alla destinazione e ritorna la risposta.
// Solo moduli built-in Node (http + fetch). Nessun pacchetto esterno.

import http from "http";

const PORT = process.env.PORT || 3333;

function cors(res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sendJson(res, status, obj) {
    cors(res);
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(obj));
}

const server = http.createServer(async (req, res) => {
    if (req.method === "OPTIONS") {
        cors(res);
        res.writeHead(204);
        return res.end();
    }

    if (req.method !== "GET") {
        return sendJson(res, 405, { error: "Solo richieste GET" });
    }

    const path = req.url?.split("?")[0];
    const query = new URL(req.url || "", "http://x").searchParams;
    if (path !== "/proxy") {
        return sendJson(res, 404, { error: "Usa GET /proxy?url=..." });
    }

    const targetUrl = query.get("url");
    if (!targetUrl) {
        return sendJson(res, 400, { error: 'Parametro "url" obbligatorio' });
    }

    try {
        const u = new URL(targetUrl);
        const dest = await fetch(u.toString(), {
            method: "GET",
            redirect: "follow",
            headers: {
                "User-Agent": req.headers["user-agent"] || "ScraperProxy/1.0",
                Accept:
                    req.headers["accept"] || "text/html,application/xhtml+xml,*/*;q=0.8",
            },
        });
        const ct = dest.headers.get("content-type") || "";
        cors(res);
        res.writeHead(dest.status, { "Content-Type": ct });
        if (ct.includes("application/json")) {
            return res.end(JSON.stringify(await dest.json()));
        }
        res.end(await dest.text());
    } catch (err) {
        console.error(err.message);
        sendJson(res, 502, { error: err.message });
    }
});

server.listen(PORT, () => {
    console.log(`Proxy in ascolto su http://localhost:${PORT}`);
});
