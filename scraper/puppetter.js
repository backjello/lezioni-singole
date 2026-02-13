// main.js
// Esempio base con Puppeteer:
// - apre una pagina
// - compila automaticamente un form
// - opzionale: estrae dati dalla pagina (scraping)

import puppeteer from "puppeteer";

async function run() {
  // URL della pagina da automatizzare
  const url = "https://example.com/form"; // TODO: cambia con il tuo URL

  // Se vuoi vedere il browser: headless: false
  const browser = await puppeteer.launch({
    headless: true, // metti false per debug visivo,
    executablePath: "/usr/bin/chromium-browser",
    args: ["--no-sandbox", "--disable-setuid-userns"],
  });

  const page = await browser.newPage();

  // User-Agent un po' più "umano"
  await page.setUserAgent(
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121 Safari/537.36"
  );

  console.log("Vado a:", url);
  await page.goto(url, {
    waitUntil: "networkidle2",
    timeout: 60_000,
  });

  // ESEMPIO: compilazione automatica di un form
  // Cambia i selettori CSS in base alla pagina reale
  try {
    // Compila un input di testo (es: nome)
    await page.waitForSelector('input[name="name"]', { timeout: 10_000 });
    await page.type('input[name="name"]', "Mario Rossi", { delay: 50 });

    // Compila un input email
    await page.waitForSelector('input[name="email"]', { timeout: 10_000 });
    await page.type('input[name="email"]', "mario.rossi@example.com", {
      delay: 50,
    });

    // Se c'è una select:
    // await page.select('select[name="country"]', 'IT');

    // Checkbox
    // await page.click('input[name="privacy"]');

    // Submit del form
    // Se il bottone ha un id:
    // await page.click('#submit');
    // oppure per testo del pulsante:
    // await page.evaluate(() => {
    //   const btns = Array.from(document.querySelectorAll("button, input[type=submit]"));
    //   const btn = btns.find(b => b.textContent?.includes("Invia"));
    //   btn?.click();
    // });

    console.log("Form compilato (e inviato se hai abilitato il click).");
  } catch (err) {
    console.error("Errore durante la compilazione del form:", err.message);
  }

  // ESEMPIO: scraping di alcuni dati dalla pagina
  try {
    const data = await page.evaluate(() => {
      // Modifica qui con ciò che ti serve
      const title = document.querySelector("title")?.textContent || "";
      const h1 = document.querySelector("h1")?.textContent || "";

      // esempio raccolta link:
      const links = Array.from(document.querySelectorAll("a")).map((a) => ({
        text: a.textContent?.trim() || "",
        href: a.href,
      }));

      return { title, h1, links };
    });

    console.log("Dati estratti:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Errore durante lo scraping:", err.message);
  }

  await browser.close();
}

run().catch((err) => {
  console.error("Errore generale Puppeteer:", err);
  process.exit(1);
});
