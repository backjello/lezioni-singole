const fsSync = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

const OUTPUT_DIR = path.join(__dirname, "..", "output");

const KEYWORDS = ["crisi", "crisis", "caldo", "heat", "ai", "AI"];

async function getTrendingTopicsWithPuppeteer(browser) {
  console.log(
    'Leggo i trending topic da Google Trends (pagina "Di tendenza ora", senza login)...',
  );
  const page = await browser.newPage();

  await page.goto("https://trends.google.it/trending?geo=IT&hl=it", {
    waitUntil: "networkidle2",
  });

  // La struttura HTML può cambiare spesso. Qui cerchiamo la tabella principale
  // che contiene "Tendenze di ricerca" e leggiamo la prima colonna (Termini di tendenza).
  const topics = await page.evaluate(() => {
    const out = new Set();
    const tables = Array.from(document.querySelectorAll("table"));

    tables.forEach((table) => {
      const text = (table.textContent || "").toLowerCase();
      if (!text.includes("tendenze di ricerca")) return;

      const rows = table.querySelectorAll("tbody tr");
      rows.forEach((row) => {
        const firstCell = row.querySelector("td:first-child");
        if (!firstCell) return;
        const candidate = (
          firstCell.querySelector("a, span, div")?.textContent || ""
        ).trim();
        if (candidate && candidate.length < 100) {
          out.add(candidate);
        }
      });
    });

    return Array.from(out);
  });

  await page.close();

  console.log(
    "Trending topic trovati (scraping pagina Google Trends):",
    topics,
  );
  return topics;
}

function pickTopicWithKeywords(topics) {
  const loweredKeywords = KEYWORDS.map((k) => k.toLowerCase());
  return topics.find((topic) => {
    const t = topic.toLowerCase();
    return loweredKeywords.some((kw) => t.includes(kw));
  });
}

async function ensureOutputDir() {
  if (!fsSync.existsSync(OUTPUT_DIR)) {
    fsSync.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

async function generateMeme(browser, topic) {
  console.log("Genero il meme per topic:", topic);
  await ensureOutputDir();

  const page = await browser.newPage();
  await page.setViewport({ width: 800, height: 800 });

  const safeTopic = topic.replace(/\"/g, '\\"');

  await page.setContent(`
    <!DOCTYPE html>
    <html lang="it">
      <head>
        <meta charset="UTF-8" />
        <title>Meme Generator</title>
        <style>
          body {
            margin: 0;
            padding: 0;
            background: #111827;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          }
          canvas {
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
            border-radius: 16px;
          }
        </style>
      </head>
      <body>
        <canvas id="meme" width="800" height="800"></canvas>
        <script>
          (function () {
            const canvas = document.getElementById('meme');
            const ctx = canvas.getContext('2d');

            const w = canvas.width;
            const h = canvas.height;

            const gradient = ctx.createLinearGradient(0, 0, w, h);
            gradient.addColorStop(0, '#1d4ed8');
            gradient.addColorStop(1, '#ec4899');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, w, h);

            ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
            const margin = 40;
            ctx.roundRect = function (x, y, width, height, radius) {
              const r = typeof radius === 'number' ? radius : 24;
              this.beginPath();
              this.moveTo(x + r, y);
              this.lineTo(x + width - r, y);
              this.quadraticCurveTo(x + width, y, x + width, y + r);
              this.lineTo(x + width, y + height - r);
              this.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
              this.lineTo(x + r, y + height);
              this.quadraticCurveTo(x, y + height, x, y + height - r);
              this.lineTo(x, y + r);
              this.quadraticCurveTo(x, y, x + r, y);
              this.closePath();
            };
            ctx.roundRect(margin, margin, w - margin * 2, h - margin * 2, 32);
            ctx.fill();

            const topic = "${safeTopic}";

            ctx.fillStyle = '#f9fafb';
            ctx.textAlign = 'center';

            ctx.font = 'bold 52px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
            ctx.fillText('QUANDO IL TREND DICE', w / 2, 150);

            ctx.font = '900 64px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
            const maxWidth = w - 160;
            const lineHeight = 74;

            function wrapText(text, x, y, maxWidth, lineHeight) {
              const words = text.split(' ');
              let line = '';
              let cy = y;
              for (let n = 0; n < words.length; n++) {
                const testLine = line + words[n] + ' ';
                const metrics = ctx.measureText(testLine);
                const testWidth = metrics.width;
                if (testWidth > maxWidth && n > 0) {
                  ctx.fillText(line, x, cy);
                  line = words[n] + ' ';
                  cy += lineHeight;
                } else {
                  line = testLine;
                }
              }
              ctx.fillText(line, x, cy);
            }

            wrapText(topic.toUpperCase(), w / 2, h / 2 - 40, maxWidth, lineHeight);

            ctx.font = 'bold 40px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
            ctx.fillStyle = '#a5b4fc';
            ctx.fillText('#XMEMEBOT', w / 2, h - 120);

            document.body.setAttribute('data-rendered', 'true');
          })();
        </script>
      </body>
    </html>
  `);

  await page.waitForSelector('body[data-rendered="true"]', { timeout: 10000 });

  const filename = `meme-${Date.now()}.png`;
  const fullPath = path.join(OUTPUT_DIR, filename);

  await page.screenshot({
    path: fullPath,
    type: "png",
    fullPage: false,
  });

  await page.close();
  console.log("Meme salvato in", fullPath);
  return fullPath;
}

async function runBot() {
  const browser = await puppeteer.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const topics = await getTrendingTopicsWithPuppeteer(browser);

  let chosen;
  if (!topics || topics.length === 0) {
    console.log(
      "Nessun trending topic trovato da Google Trends, uso fallback sulla politica.",
    );
    chosen = "la politica italiana";
  } else {
    chosen = pickTopicWithKeywords(topics);
    if (!chosen) {
      console.log(
        "Nessun topic contiene le keyword richieste, uso fallback sulla politica.",
      );
      chosen = "la politica";
    }
  }

  console.log("Topic scelto (dai trend o fallback):", chosen);

  const memePath = await generateMeme(browser, chosen);
  console.log(
    "Meme generato in:",
    memePath,
    "(nessuna pubblicazione automatica su social, nessun login richiesto)",
  );

  await browser.close();
}

runBot().catch((err) => {
  console.error(err);
  process.exit(1);
});
