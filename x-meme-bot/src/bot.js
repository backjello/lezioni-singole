const fsSync = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

const OUTPUT_DIR = path.join(__dirname, "..", "output");

const KEYWORDS = ["crisi", "crisis", "caldo", "heat", "ai", "AI"];

async function getTrendingTopicsWithPuppeteer(browser) {
  console.log('Leggo i titoli delle notizie da ANSA (homepage, senza login)...');
  const page = await browser.newPage();

  await page.goto("https://www.ansa.it/", {
    waitUntil: "networkidle2",
  });

  // La struttura HTML può cambiare spesso. Qui proviamo a raccogliere i titoli
  // principali dalle sezioni news / articoli.
  const topics = await page.evaluate(() => {
    const out = new Set();
    // Titoli principali in vari layout possibili
    const selectors = [
      "article h1",
      "article h2",
      "article h3",
      ".news h2",
      ".news h3",
      ".top-news h2",
      ".top-news h3",
      "h2 a",
      "h3 a",
    ];

    selectors.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => {
        const text = (el.textContent || "").replace(/\s+/g, " ").trim();
        if (text && text.length > 20 && text.length < 140) {
          out.add(text);
        }
      });
    });

    return Array.from(out);
  });

  await page.close();

  console.log("Titoli trovati (scraping homepage ANSA):", topics);
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

            const topic = "${safeTopic.slice(0, 50)}";

            ctx.fillStyle = '#f9fafb';
            ctx.textAlign = 'center';

            ctx.font = 'bold 52px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
            ctx.fillText('ULTIME NOTIZIE', w / 2, 150);

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
            ctx.fillText('#TRENDBOT', w / 2, h - 120);

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
