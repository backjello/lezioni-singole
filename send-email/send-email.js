/**
 * Modulo per l'invio di email tramite Node.js
 * Utilizza il pacchetto nodemailer, la libreria standard e minimale per l'invio di email
 */
const nodemailer = require("nodemailer");

// Carica variabili d'ambiente da file .env se dotenv è installato (opzionale)
// Se dotenv non è installato, usa solo le variabili d'ambiente del sistema
try {
  require("dotenv").config();
} catch (e) {
  // dotenv non installato, usa solo variabili d'ambiente del sistema
  console.log("dotenv non installato");
}

/**
 * Configurazione del server SMTP per l'invio delle email
 *
 * Questa configurazione definisce i parametri di connessione al server email.
 * Per Gmail, è necessario utilizzare una "App Password" invece della password normale.
 * Per altri provider (Outlook, Yahoo, ecc.), modificare host e port di conseguenza.
 *
 * @type {Object}
 * @property {string} host - Indirizzo del server SMTP (es: smtp.gmail.com, smtp.outlook.com)
 * @property {number} port - Porta del server SMTP (587 per TLS, 465 per SSL, 25 per non sicuro)
 * @property {boolean} secure - Se true, usa SSL/TLS sulla porta 465. Se false, usa STARTTLS sulla porta 587
 * @property {Object} auth - Credenziali di autenticazione
 * @property {string} auth.user - Email del mittente (preferibilmente da variabile d'ambiente)
 * @property {string} auth.pass - Password o App Password (preferibilmente da variabile d'ambiente)
 */
const config = {
  // Server SMTP di Gmail. Per altri provider, modificare questo valore
  // Esempi: smtp.outlook.com, smtp.yahoo.com, smtp.mailtrap.io (per testing)
  host: "smtp.ionos.it",

  // Porta 587 è la porta standard per STARTTLS (connessione sicura)
  // Porta 465 è per SSL/TLS diretto (impostare secure: true)
  // Porta 25 è non sicura e spesso bloccata dagli ISP
  port: 587,

  // false = usa STARTTLS (raccomandato per porta 587)
  // true = usa SSL/TLS diretto (necessario per porta 465)
  secure: false,

  // Credenziali di autenticazione
  auth: {
    // Email del mittente. Cerca prima nella variabile d'ambiente EMAIL_USER,
    // altrimenti usa il valore di default (da modificare)
    user: process.env.EMAIL_USER || "your-email@gmail.com",

    // Password o App Password. Cerca prima nella variabile d'ambiente EMAIL_PASS,
    // altrimenti usa il valore di default (da modificare)
    //
    // La App Password è diversa dalla password normale e ha questo formato:
    // xxxx xxxx xxxx xxxx (16 caratteri, ma inseriscila SENZA spazi nel .env)
    pass: process.env.EMAIL_PASS || "your-app-password",
  },
};

/**
 * Trasportatore nodemailer configurato con le impostazioni sopra
 *
 * Il transporter è l'oggetto che gestisce la connessione al server SMTP
 * e viene utilizzato per inviare le email. Viene creato una sola volta
 * all'avvio del modulo e riutilizzato per tutte le email successive.
 */
const transporter = nodemailer.createTransport(config);

/**
 * Funzione asincrona per inviare un'email
 *
 * Questa funzione gestisce l'invio di un'email utilizzando il transporter configurato.
 * Supporta sia testo semplice che HTML. Se viene fornito solo il testo, viene usato
 * anche come HTML di fallback.
 *
 * @param {string} to - Indirizzo email del destinatario (può essere una stringa o array per multipli destinatari)
 * @param {string} subject - Oggetto dell'email
 * @param {string} text - Contenuto testuale dell'email (versione plain text)
 * @param {string} [html] - Contenuto HTML dell'email (opzionale, se non fornito usa text)
 * @returns {Promise<Object>} Promise che risolve con le informazioni dell'email inviata
 * @throws {Error} Lancia un errore se l'invio fallisce
 *
 * @example
 * // Invio semplice con solo testo
 * await sendEmail("dest@example.com", "Ciao", "Questo è un messaggio");
 *
 * @example
 * // Invio con HTML
 * await sendEmail("dest@example.com", "Ciao", "Testo", "<h1>HTML</h1>");
 */
async function sendEmail(to, subject, text, html) {
  console.log(process.env.EMAIL_USER);
  console.log(process.env.EMAIL_PASS);
  try {
    // Invia l'email utilizzando il transporter configurato
    // sendMail è una funzione asincrona che restituisce una Promise
    const info = await transporter.sendMail({
      // Indirizzo email del mittente (preso dalla configurazione)
      from: config.auth.user,

      // Destinatario/i dell'email
      // Può essere una stringa singola: "user@example.com"
      // Oppure un array: ["user1@example.com", "user2@example.com"]
      // Oppure una stringa con più destinatari: "user1@example.com, user2@example.com"
      to: to,

      // Oggetto dell'email
      subject: subject,

      // Versione plain text del messaggio
      // Alcuni client email mostrano questa versione se non supportano HTML
      text: text,

      // Versione HTML del messaggio
      // Se non fornita, viene usato il testo come fallback
      // Permette di formattare l'email con HTML, CSS, ecc.
      html: html || text,
    });

    // Stampa il messageId dell'email inviata con successo
    // Il messageId è un identificatore univoco assegnato dal server SMTP
    console.log("Email inviata:", info.messageId);

    // Restituisce l'oggetto info che contiene dettagli sull'email inviata
    // Include: messageId, response, accepted, rejected, pending, ecc.
    return info;
  } catch (error) {
    // Gestione degli errori: stampa l'errore nella console
    // Gli errori comuni includono:
    // - Credenziali errate (autenticazione fallita)
    // - Server SMTP non raggiungibile
    // - Destinatario non valido
    // - Problemi di rete
    console.error("Errore invio email:", error);

    // Rilancia l'errore per permettere al chiamante di gestirlo
    // Questo permette di usare try/catch quando si chiama sendEmail
    throw error;
  }
}

/**
 * Esecuzione diretta dello script (quando viene eseguito con node send-email.js)
 *
 * Questo blocco viene eseguito solo quando lo script viene chiamato direttamente
 * dalla riga di comando, non quando viene importato come modulo in un altro file.
 *
 * Permette di inviare email dalla riga di comando passando i parametri come argomenti:
 * node send-email.js destinatario@example.com "Oggetto" "Messaggio"
 */
if (require.main === module) {
  // require.main === module è true solo quando il file è eseguito direttamente,
  // non quando è importato con require() in un altro file

  // Legge i parametri dalla riga di comando
  // process.argv[0] = percorso di node
  // process.argv[1] = percorso del file script
  // process.argv[2] = primo argomento (destinatario)
  // process.argv[3] = secondo argomento (oggetto)
  // process.argv[4] = terzo argomento (messaggio)

  // Se gli argomenti non sono forniti, usa valori di default per il testing
  const to = process.argv[2] || "destinatario@example.com";
  const subject = process.argv[3] || "Test Email";
  const text = process.argv[4] || "Questo è un messaggio di test.";

  // Chiama la funzione sendEmail e gestisce il risultato
  sendEmail(to, subject, text)
    // Se l'invio ha successo, esce con codice 0 (successo)
    .then(() => process.exit(0))
    // Se l'invio fallisce, esce con codice 1 (errore)
    // Questo permette di usare lo script in script bash e verificare il risultato
    .catch(() => process.exit(1));
}

/**
 * Esporta le funzioni e oggetti per permettere l'uso come modulo
 *
 * Quando questo file viene importato con require() in un altro file,
 * queste esportazioni permettono di utilizzare la funzione sendEmail
 * e il transporter in altri script.
 *
 * @example
 * const { sendEmail, transporter } = require('./send-email');
 * await sendEmail("dest@example.com", "Oggetto", "Messaggio");
 */
module.exports = { sendEmail, transporter };
