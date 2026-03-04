## Meme Bot (senza login)

Bot didattico che:

- legge i **trending topic** (in questa versione da **Google Trends**) con Puppeteer **senza login**
- filtra i trend in base a **keyword** (es. `crisi`, `caldo`, `AI`, …)
- genera un **meme** via `<canvas>` in una pagina HTML controllata da Puppeteer
- salva automaticamente il meme su disco (nessuna pubblicazione automatica su social)

> Attenzione: questo progetto è solo a scopo didattico (scraping + automazione con Puppeteer + generazione immagini). Non effettua login né pubblicazioni automatiche su social.

### Requisiti

- Node.js 18+ installato
- `npm install` già eseguito (già fatto dal setup)

### Flusso di utilizzo

1. **Esecuzione del bot meme**

   ```bash
   cd "x-meme-bot"
   npm start
   ```

   Lo script:

   - apre la pagina **Di tendenza ora** di [Google Trends](https://trends.google.it/trending?geo=IT&hl=it) con Puppeteer (scraping HTML, nessuna API)
   - legge i trending topic del giorno per l’Italia dalla tabella "Tendenze di ricerca"
   - seleziona il primo trend che contiene almeno una delle keyword:
     - `crisi`, `crisis`
     - `caldo`, `heat`
     - `ai`, `AI`
   - genera un meme con `<canvas>` in una pagina HTML headless
   - salva l’immagine in `output/meme-<timestamp>.png`

   Se nessun trending topic contiene le keyword, il bot **non genera nessun meme**.

### Script npm

- **`npm start`**: esegue il flusso di lettura trend (Google Trends) + generazione e salvataggio del meme

### Estensioni possibili

- Aggiungere una fase di **pubblicazione automatica** (es. verso Telegram o altro servizio) usando API che non richiedano login via browser.
- Cambiare sorgente dei trend (es. pagina pubblica di Instagram, Reddit, ecc.) mantenendo il filtro sulle keyword e il generatore di meme via `<canvas>`.

