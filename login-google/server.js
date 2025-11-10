// ============================================
// SERVER NODE.JS PER GOOGLE SIGN-IN
// Utilizza solo moduli built-in di Node.js (nessun package esterno)
// ============================================

// Importa i moduli built-in di Node.js necessari
const http = require("http"); // Per creare il server HTTP
const https = require("https"); // Per fare richieste HTTPS a Google
const crypto = require("crypto"); // Per verificare le firme crittografiche dei token
const { URL } = require("url"); // Per parsare gli URL delle richieste

// Configurazione
const PORT = 3333; // Porta su cui il server ascolterà
const CLIENT_ID =
  "48315565897-6i3403uof617avnel62iu3jhcqo70u81.apps.googleusercontent.com"; // ID client Google OAuth

// URL dell'endpoint di Google che fornisce le chiavi pubbliche per verificare i token
// JWKS = JSON Web Key Set (insieme di chiavi pubbliche in formato JSON)
const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";

// ============================================
// FUNZIONE: Scarica le chiavi pubbliche da Google
// ============================================
// Google usa queste chiavi pubbliche per firmare i token JWT.
// Dobbiamo scaricarle per verificare che i token siano autentici.
function fetchGooglePublicKeys() {
  return new Promise((resolve, reject) => {
    // Fa una richiesta HTTPS a Google per ottenere le chiavi pubbliche
    https
      .get(GOOGLE_JWKS_URL, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (error) {
            reject(error);
          }
        });
        res.on("error", reject);
      })
      .on("error", reject);
  });
}

// ============================================
// FUNZIONE: Decodifica una stringa base64url
// ============================================
// I token JWT usano base64url (variante di base64 con caratteri URL-safe).
// Questa funzione converte base64url in base64 standard e poi in Buffer.
function base64UrlDecode(str) {
  // Sostituisce i caratteri URL-safe con quelli standard base64
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  // Aggiunge padding se necessario (base64 richiede lunghezza multipla di 4)
  while (base64.length % 4) {
    base64 += "=";
  }
  // Converte la stringa base64 in un Buffer binario
  return Buffer.from(base64, "base64");
}

// Sapete che cosa è un token JWT?
// Un token JWT è un token di sicurezza che viene usato per autenticare un utente.
// Il token JWT è composto da 3 parti: header, payload e signature.
// Il header contiene informazioni sul tipo di token e algoritmo.
// Il payload contiene i dati dell'utente.
// La signature è la parte che viene usata per verificare che il token sia autentico.
// Il token JWT viene usato per autenticare un utente in modo sicuro.

// ============================================
// FUNZIONE: Parsa un token JWT
// ============================================
// Questa funzione separa le parti e decodifica header e payload.
function parseJWT(token) {
  // Divide il token nelle sue 3 parti
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT format");
  }

  // Decodifica l'header (contiene informazioni sul tipo di token e algoritmo)
  const header = JSON.parse(base64UrlDecode(parts[0]).toString());
  // Decodifica il payload (contiene i dati dell'utente)
  const payload = JSON.parse(base64UrlDecode(parts[1]).toString());
  // La firma rimane codificata (verrà verificata dopo)
  const signature = parts[2];

  return { header, payload, signature, raw: parts };
}

// ============================================
// FUNZIONE: Verifica un token JWT di Google
// ============================================
// Questa è la funzione principale di sicurezza. Verifica che:
// 1. Il token non sia scaduto
// 2. Il token sia stato emesso per il nostro CLIENT_ID
// 3. Il token provenga da Google (verifica issuer)
// 4. La firma crittografica sia valida
async function verifyJWT(token) {
  // Parsa il token nelle sue componenti
  const { header, payload, signature, raw } = parseJWT(token);

  // VERIFICA 1: Controlla se il token è scaduto
  const now = Math.floor(Date.now() / 1000); // Timestamp attuale in secondi
  if (payload.exp && payload.exp < now) {
    throw new Error("Token has expired");
  }

  // VERIFICA 2: Controlla che il token sia stato emesso per il nostro client
  // L'audience (aud) deve corrispondere al nostro CLIENT_ID
  if (payload.aud !== CLIENT_ID) {
    throw new Error("Token audience mismatch");
  }

  // VERIFICA 3: Controlla che il token provenga da Google
  // L'issuer (iss) deve essere accounts.google.com
  if (
    payload.iss !== "https://accounts.google.com" &&
    payload.iss !== "accounts.google.com"
  ) {
    throw new Error("Invalid token issuer");
  }

  // VERIFICA 4: Verifica la firma crittografica
  // Ottiene le chiavi pubbliche di Google (scaricate ogni volta)
  const keys = await fetchGooglePublicKeys();
  // Trova la chiave pubblica corrispondente al kid (key ID) nell'header
  const key = keys.keys.find((k) => k.kid === header.kid);

  if (!key) {
    throw new Error("Public key not found");
  }

  // Prepara i dati per la verifica della firma
  const signatureBuffer = base64UrlDecode(signature); // Decodifica la firma
  const dataToVerify = `${raw[0]}.${raw[1]}`; // Header + Payload (senza firma)

  // Converte la chiave pubblica da formato JWK (JSON Web Key) a formato PEM
  // che può essere usato dalla libreria crypto di Node.js
  const publicKey = crypto.createPublicKey({
    key: {
      kty: key.kty, // Tipo di chiave (es. RSA)
      n: key.n, // Modulo RSA
      e: key.e, // Esponente pubblico RSA
    },
    format: "jwk",
  });

  // Verifica la firma usando RSA-SHA256
  // Se la firma è valida, significa che il token è autentico e non è stato modificato
  const verify = crypto.createVerify("RSA-SHA256");
  verify.update(dataToVerify); // I dati da verificare (header.payload)
  const isValid = verify.verify(publicKey, signatureBuffer); // Verifica la firma

  if (!isValid) {
    throw new Error("Invalid token signature");
  }

  // Se tutte le verifiche sono passate, restituisce il payload con i dati utente
  return payload;
}

// ============================================
// FUNZIONE: Parsa JSON dal body della richiesta
// ============================================
// Converte il body della richiesta HTTP (stringa) in un oggetto JavaScript.
function parseJSON(body) {
  try {
    return JSON.parse(body);
  } catch (error) {
    return null; // Restituisce null se il JSON non è valido
  }
}

// ============================================
// FUNZIONE: Invia una risposta JSON
// ============================================
// Helper per inviare risposte JSON con gli header CORS necessari
// per permettere al frontend di fare richieste cross-origin.
function sendJSON(res, statusCode, data) {
  const json = JSON.stringify(data);
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    // Header CORS: permette richieste da qualsiasi origine
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(json);
}

// ============================================
// FUNZIONE: Gestisce le richieste CORS preflight
// ============================================
// I browser fanno una richiesta OPTIONS prima delle richieste POST cross-origin.
// Questa funzione risponde a quelle richieste per permettere il CORS.
function handleCORS(res) {
  res.writeHead(200, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end();
}

// ============================================
// FUNZIONE: Gestisce il login con Google
// ============================================
// Questa è la funzione principale che gestisce le richieste di login.
// Riceve il token JWT dal frontend, lo verifica, e restituisce i dati utente.
async function handleGoogleLogin(req, res) {
  let body = "";

  // Accumula il body della richiesta (può arrivare in più chunk)
  req.on("data", (chunk) => {
    body += chunk.toString();
  });

  // Quando tutto il body è stato ricevuto
  req.on("end", async () => {
    try {
      // Converte il body JSON in un oggetto
      const data = parseJSON(body);
      // Verifica che ci sia il token
      if (!data || !data.token) {
        return sendJSON(res, 400, {
          success: false,
          error: "Token is required",
        });
      }

      // VERIFICA IL TOKEN: Questa è la parte critica di sicurezza
      // Verifica che il token sia valido, non scaduto, e firmato da Google
      const payload = await verifyJWT(data.token);
      console.log("Payload:", payload);

      // Estrae le informazioni utente dal payload verificato
      const userInfo = {
        id: payload.sub, // ID univoco dell'utente Google
        email: payload.email, // Email dell'utente
        name: payload.name, // Nome completo
        picture: payload.picture, // URL dell'avatar
        emailVerified: payload.email_verified, // Se l'email è verificata
      };

      console.log("User logged in:", userInfo);

      // Restituisce i dati utente al frontend
      sendJSON(res, 200, {
        success: true,
        user: userInfo,
        message: "Login successful",
      });
    } catch (error) {
      // Se c'è un errore (token invalido, scaduto, ecc.), restituisce errore
      console.error("Login error:", error);
      sendJSON(res, 401, {
        success: false,
        error: "Invalid token or authentication failed",
        details: error.message,
      });
    }
  });
}

// ============================================
// CREAZIONE DEL SERVER HTTP
// ============================================
// Crea un server HTTP che ascolta le richieste e le instrada alle funzioni appropriate.
const server = http.createServer((req, res) => {
  // Parsa l'URL della richiesta
  const url = new URL(req.url, `http://${req.headers.host}`);

  // Gestisce le richieste CORS preflight (OPTIONS)
  if (req.method === "OPTIONS") {
    return handleCORS(res);
  }

  // ROUTING: Instrada le richieste alle funzioni appropriate
  // Endpoint per il login con Google
  if (url.pathname === "/login-with-google" && req.method === "POST") {
    return handleGoogleLogin(req, res);
  }

  // Endpoint di health check (per verificare che il server funzioni)
  if (url.pathname === "/health" && req.method === "GET") {
    return sendJSON(res, 200, {
      status: "ok",
      message: "Server is running",
    });
  }

  // Se nessuna route corrisponde, restituisce 404
  sendJSON(res, 404, { error: "Not found" });
});

// ============================================
// AVVIO DEL SERVER
// ============================================
// Avvia il server sulla porta specificata
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(
    `Google Login endpoint: http://localhost:${PORT}/login-with-google`
  );
});
