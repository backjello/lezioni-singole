import Database from "better-sqlite3";
import TelegramBot from "node-telegram-bot-api";
import puppeteer from "puppeteer";

const TELEGRAM_TOKEN = "8501556275:AAESZj11JWk-dI6giUPcGbhUBftA-2vlw7Y";
const AMAZON_PRODUCT_URL = "https://www.amazon.it/dp/B0BLW4V6JT";
const CHECK_INTERVAL_MS = 10 * 60 * 1000; // 10 minuti

if (!TELEGRAM_TOKEN) {
  console.error("TELEGRAM_TOKEN non impostato nelle variabili d'ambiente");
  process.exit(1);
}

if (!AMAZON_PRODUCT_URL) {
  console.error("AMAZON_PRODUCT_URL non impostato nelle variabili d'ambiente");
  process.exit(1);
}

// Salva il DB nella cartella di esecuzione (evita problemi con spazi nel path)
const db = new Database("price-tracker.db");

db.exec(`
  CREATE TABLE IF NOT EXISTS subscribers (
    chat_id INTEGER PRIMARY KEY
  );

  CREATE TABLE IF NOT EXISTS product_prices (
    product_url TEXT PRIMARY KEY,
    last_price REAL NOT NULL,
    last_checked TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS price_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_url TEXT NOT NULL,
    price REAL NOT NULL,
    checked_at TEXT NOT NULL
  );
`);

const insertSubscriberStmt = db.prepare(
  "INSERT OR IGNORE INTO subscribers (chat_id) VALUES (?);",
);
const getSubscribersStmt = db.prepare("SELECT chat_id FROM subscribers;");

const getCurrentPriceStmt = db.prepare(
  "SELECT last_price FROM product_prices WHERE product_url = ?;",
);
const upsertPriceStmt = db.prepare(`
  INSERT INTO product_prices (product_url, last_price, last_checked)
  VALUES (?, ?, datetime('now'))
  ON CONFLICT(product_url) DO UPDATE SET
    last_price = excluded.last_price,
    last_checked = excluded.last_checked;
`);
const insertHistoryStmt = db.prepare(`
  INSERT INTO price_history (product_url, price, checked_at)
  VALUES (?, ?, datetime('now'));
`);

async function scrapeAmazonPrice(url) {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: "/usr/bin/google-chrome",
  });

  try {
    const page = await browser.newPage();

    await page.setViewport({ width: 1280, height: 800 });

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    );

    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 60000,
    });

    // Tenta di leggere il prezzo dal blocco principale (diversi layout Amazon)
    const selectorList = [".a-price"];

    // if (process.env.AMAZON_PRICE_SELECTOR) {
    //   selectorList.unshift(process.env.AMAZON_PRICE_SELECTOR);
    // }

    const priceText = await page.evaluate((selectors) => {
      for (const selector of selectors) {
        const el = document.querySelector(selector);
        if (el && el.textContent) {
          return el.textContent.trim();
        }
      }
      return null;
    }, selectorList);

    if (!priceText) {
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      const screenshotName = `amazon-price-not-found-${ts}.png`;
      await page.screenshot({ path: screenshotName, fullPage: true });
      throw new Error(
        `Prezzo non trovato nella pagina Amazon (screenshot: ${screenshotName})`,
      );
    }

    // Parsing robusto di numeri in formato EU/US
    const cleaned = priceText.replace(/[^\d.,-]/g, "");
    let numericStr = cleaned;

    const hasComma = numericStr.includes(",");
    const hasDot = numericStr.includes(".");

    if (hasComma && hasDot) {
      // Se l'ultima virgola è dopo l'ultimo punto, assumiamo virgola come separatore decimale (stile 2.800,00)
      if (numericStr.lastIndexOf(",") > numericStr.lastIndexOf(".")) {
        numericStr = numericStr.replace(/\./g, "").replace(",", ".");
      } else {
        // Stile 2,800.00
        numericStr = numericStr.replace(/,/g, "");
      }
    } else if (hasComma) {
      // Solo virgola: trattala come separatore decimale
      numericStr = numericStr.replace(/\./g, "").replace(",", ".");
    } else {
      // Solo punti o solo cifre: rimuovi eventuali virgole residue
      numericStr = numericStr.replace(/,/g, "");
    }

    const price = parseFloat(numericStr);

    if (Number.isNaN(price)) {
      throw new Error(
        `Impossibile convertire il prezzo: "${priceText}" (cleaned: "${numericStr}")`,
      );
    }

    console.log(
      "Prezzo trovato su Amazon:",
      JSON.stringify({ raw: priceText, cleaned: numericStr, value: price }),
    );

    return { price, raw: priceText };
  } finally {
    await browser.close();
  }
}

function savePriceAndDetectChange(productUrl, newPrice) {
  const row = getCurrentPriceStmt.get(productUrl);

  insertHistoryStmt.run(productUrl, newPrice);

  if (!row) {
    upsertPriceStmt.run(productUrl, newPrice);
    return { changed: false, oldPrice: null };
  }

  const oldPrice = row.last_price;

  if (newPrice !== oldPrice) {
    upsertPriceStmt.run(productUrl, newPrice);
    return { changed: true, oldPrice };
  }

  return { changed: false, oldPrice };
}

async function checkPriceAndNotify(manualCheck = false, chatIdForReply = null) {
  try {
    const { price, raw } = await scrapeAmazonPrice(AMAZON_PRODUCT_URL);

    const { changed, oldPrice } = savePriceAndDetectChange(
      AMAZON_PRODUCT_URL,
      price,
    );

    const euro = price.toFixed(2).replace(".", ",") + " €";

    if (manualCheck && chatIdForReply) {
      const oldText =
        oldPrice != null
          ? `\nUltimo prezzo salvato: ${oldPrice.toFixed(2).replace(".", ",")} €`
          : "";

      await bot.sendMessage(
        chatIdForReply,
        `Prezzo attuale del prodotto:\n${euro}${oldText}`,
      );
    }

    if (changed) {
      const oldEuro = oldPrice.toFixed(2).replace(".", ",").concat(" €");

      const subscribers = getSubscribersStmt.all();

      const text = `⚠️ Prezzo modificato su Amazon!\n\nURL: ${AMAZON_PRODUCT_URL}\nPrima: ${oldEuro}\nOra: ${euro}`;

      for (const sub of subscribers) {
        await bot.sendMessage(sub.chat_id, text);
      }
    }
  } catch (err) {
    console.error("Errore nel controllo del prezzo:", err);

    if (manualCheck && chatIdForReply) {
      await bot.sendMessage(
        chatIdForReply,
        `Si è verificato un errore durante la lettura del prezzo:\n${err.message}`,
      );
    }
  }
}

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;

  insertSubscriberStmt.run(chatId);

  await bot.sendMessage(
    chatId,
    [
      "👋 Ciao! Questo bot controlla il prezzo di un prodotto Amazon.",
      "",
      "Comandi disponibili:",
      "- /check – controlla ora il prezzo e risponde subito",
      "",
      "Quando il prezzo cambia rispetto all'ultimo salvato, riceverai una notifica automatica.",
    ].join("\n"),
  );
});

bot.onText(/\/check/, async (msg) => {
  const chatId = msg.chat.id;

  insertSubscriberStmt.run(chatId);

  await bot.sendMessage(chatId, "Controllo il prezzo su Amazon, attendi...");
  await checkPriceAndNotify(true, chatId);
});

// Primo controllo immediato all'avvio (senza risposta Telegram specifica)
(async () => {
  await checkPriceAndNotify(false, null);
})();

setInterval(() => {
  checkPriceAndNotify(false, null);
}, CHECK_INTERVAL_MS);

console.log(
  "Telegram Amazon bot avviato. Controllo periodico del prezzo attivo.",
);
