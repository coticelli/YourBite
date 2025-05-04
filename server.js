require('dotenv').config();

const express = require('express');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');
// Assicurati che authRoutes esista o commenta la riga se non lo usi
// const authRoutes = require('./authRoutes'); // Commenta se non esiste
const axios = require('axios');
const http = require('http');
const { Server } = require('socket.io');
const exphbs = require('express-handlebars');
const https = require('https');
const crypto = require('crypto'); // Per generare API keys
const fs = require('fs'); // Per operazioni file (backup simulato)
const archiver = require('archiver'); // Per creare zip (backup reale - opzionale)
const multer = require('multer'); // Per upload file

// Crea un'istanza di Express
const app = express();
const port = process.env.PORT || 3000; // Usa variabile d'ambiente o default

// Crea un server HTTP da Express app
const server = http.createServer(app);
// Inizializza Socket.IO
const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
});

// --- Configurazione View Engine Handlebars ---
const hbs = exphbs.create({
    extname: '.hbs',
    defaultLayout: false,
    helpers: {
        json: function (context) { return JSON.stringify(context); },
        eq: function (v1, v2) { return v1 === v2; },
        neq: function (v1, v2) { return v1 !== v2; },
        gt: function (v1, v2) { return v1 > v2; },
        lt: function (v1, v2) { return v1 < v2; },
    }
});
app.engine('.hbs', hbs.engine);
app.set('view engine', '.hbs');
app.set('views', path.join(__dirname, 'views'));

// --- Middleware ---
app.use(cors({ origin: '*' }));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback_super_secret_key_12345', // Usa fallback se non in .env
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
    // Considera un session store persistente per produzione
}));

// Initialize passport
app.use(passport.initialize());
app.use(passport.session());

// Middleware per rendere user disponibile alle viste
app.use((req, res, next) => {
    res.locals.user = req.user || null; // Usa req.user direttamente da passport
    // console.log('Middleware res.locals.user:', res.locals.user); // Debug
    next();
});

// --- Database Setup ---
const dbPath = path.join(__dirname, 'database.db'); // Usa path assoluto
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("Errore FATALE connessione DB:", err.message);
        process.exit(1); // Esce se non può connettersi al DB
    } else {
        console.log("Connesso al database SQLite:", dbPath);
        initializeDatabase();
    }
});

// Funzione per inizializzare/creare tabelle necessarie
function initializeDatabase() {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS utenti (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            email TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            tipo TEXT NOT NULL DEFAULT 'cliente',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            google_id TEXT UNIQUE
        )`, (err) => {
            if (err) console.error("Errore creazione tabella utenti:", err.message);
            else { console.log("Tabella 'utenti' verificata/creata."); insertDefaultUsers(); }
        });

        db.run(`CREATE TABLE IF NOT EXISTS chat_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room_id TEXT NOT NULL,
            sender_id TEXT NOT NULL,
            sender_name TEXT NOT NULL,
            message TEXT NOT NULL,
            timestamp TEXT NOT NULL
        )`, (err) => {
            if (err) console.error("Errore creazione tabella chat_messages:", err.message);
            else console.log("Tabella 'chat_messages' verificata/creata.");
        });

        db.run(`CREATE TABLE IF NOT EXISTS impostazioni (
            key TEXT PRIMARY KEY,
            value TEXT
        )`, (err) => {
            if (err) console.error("Errore creazione tabella impostazioni:", err.message);
            else console.log("Tabella 'impostazioni' verificata/creata.");
        });

         db.run(`CREATE TABLE IF NOT EXISTS dipendenti (
             id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, cognome TEXT NOT NULL,
             posizione TEXT, reparto TEXT, email TEXT UNIQUE, telefono TEXT,
             data_nascita TEXT, data_assunzione TEXT,
             created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT
         )`, (err) => {
             if (err) console.error("Errore creazione tabella dipendenti:", err.message);
             else console.log("Tabella 'dipendenti' verificata/creata.");
         });
    });
}

// Funzione per inserire utenti di default
function insertDefaultUsers() {
    const users = [
        { username: 'admin', email: 'admin@example.com', password: 'amministratore', tipo: 'amministratore' },
        { username: 'capo', email: 'capo@example.com', password: 'capo', tipo: 'capo' },
        { username: 'cliente', email: 'cliente@example.com', password: 'cliente', tipo: 'cliente' }
    ];
    const stmt = db.prepare("INSERT INTO utenti (username, email, password, tipo) VALUES (?, ?, ?, ?)");

    users.forEach(user => {
        db.get("SELECT id FROM utenti WHERE email = ? OR username = ?", [user.email, user.username], (err, row) => {
            if (err) { console.error(`Errore controllo utente ${user.username}:`, err.message); return; }
            if (!row) {
                const hashedPassword = bcrypt.hashSync(user.password, 10);
                stmt.run(user.username, user.email, hashedPassword, user.tipo, (errInsert) => {
                    if (errInsert) console.error(`Errore inserimento utente ${user.username}:`, errInsert.message);
                    else console.log(`Utente di default ${user.username} inserito.`);
                });
            }
        });
    });
    stmt.finalize((err) => {
        if (!err) console.log("Verifica utenti di default completata.");
        else console.error("Errore finalizzazione statement utenti default:", err);
    });
}

// --- AGGIUNGI QUESTO REQUIRE VICINO AGLI ALTRI ---
const LocalStrategy = require('passport-local').Strategy;

// --- AGGIUNGI QUESTA CONFIGURAZIONE DOPO require('passport') e require('passport-local') ---
passport.use(new LocalStrategy(
    {
        usernameField: 'email', // Specifica che usi 'email' come username nel form
        passwordField: 'password'
    },
    (email, password, done) => {
        // 1. Trova l'utente nel DB tramite email
        db.get('SELECT * FROM utenti WHERE email = ?', [email], (err, user) => {
            // Errore DB
            if (err) { return done(err); }
            // Utente non trovato
            if (!user) {
                return done(null, false, { message: 'Email non trovata.' });
            }
            // Utente trovato, verifica password
            bcrypt.compare(password, user.password, (compareErr, isMatch) => {
                if (compareErr) { return done(compareErr); }
                if (isMatch) {
                    // Password corretta, autenticazione riuscita
                    return done(null, user);
                } else {
                    // Password errata
                    return done(null, false, { message: 'Password errata.' });
                }
            });
        });
    }
));

// --- ASSICURATI CHE serializeUser e deserializeUser SIANO PRESENTI (dovrebbero esserci già) ---
passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser((id, done) => {
    // Recupera solo i dati necessari per la sessione
    db.get('SELECT id, username, email, tipo FROM utenti WHERE id = ?', [id], (err, user) => {
        done(err, user);
    });
});

// --- Passport Configuration ---
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || '/auth/google/callback',
        scope: ['profile', 'email']
    },
    (accessToken, refreshToken, profile, done) => {
        const email = profile.emails?.[0]?.value;
        const googleId = profile.id;
        const displayName = profile.displayName || email?.split('@')[0] || `google_user_${googleId.substring(0,5)}`;

        if (!email) return done(new Error('Nessuna email trovata nel profilo Google'), null);

        db.get('SELECT * FROM utenti WHERE google_id = ? OR email = ?', [googleId, email], (err, user) => {
            if (err) return done(err);
            if (user) {
                if (!user.google_id && googleId) {
                    db.run('UPDATE utenti SET google_id = ? WHERE id = ?', [googleId, user.id], (updateErr) => {
                        if (updateErr) console.error("Errore aggiornamento Google ID:", updateErr);
                        return done(null, user);
                    });
                } else { return done(null, user); }
            } else {
                const randomPassword = crypto.randomBytes(16).toString('hex');
                const hashedPassword = bcrypt.hashSync(randomPassword, 10);
                let finalUsername = displayName;

                db.get('SELECT id FROM utenti WHERE username = ?', [finalUsername], (errUser, existingUser) => {
                    if (errUser) return done(errUser);
                    if (existingUser) finalUsername = `${displayName}_${googleId.substring(0, 5)}`;

                    db.run('INSERT INTO utenti (username, email, password, tipo, google_id) VALUES (?, ?, ?, ?, ?)',
                        [finalUsername, email, hashedPassword, 'cliente', googleId], function (errInsert) {
                        if (errInsert) return done(errInsert);
                        const newUser = { id: this.lastID, username: finalUsername, email: email, tipo: 'cliente', google_id: googleId };
                        return done(null, newUser);
                    });
                });
            }
        });
    }));
} else {
    console.warn("Variabili d'ambiente Google non configurate. Login Google disabilitato.");
}

passport.serializeUser((user, done) => { done(null, user.id); });
passport.deserializeUser((id, done) => { db.get('SELECT id, username, email, tipo FROM utenti WHERE id = ?', [id], (err, user) => { done(err, user); }); });

// --- Middleware Autenticazione/Autorizzazione ---
function requireLogin(req, res, next) {
    if (req.isAuthenticated()) return next();
    req.session.returnTo = req.originalUrl;
    console.log('requireLogin fallito, redirect a /login');
    res.redirect('/login');
}

function verificaRuoloCapo(req, res, next) {
    if (req.isAuthenticated() && req.user?.tipo === 'capo') return next();
    console.log('verificaRuoloCapo fallito, accesso negato.');
    res.status(403).render('error', { message: 'Accesso negato. Devi essere un Capo.', user: req.user });
}

function requireApiCapo(req, res, next) {
    if (req.isAuthenticated() && req.user?.tipo === 'capo') return next();
    res.status(403).json({ success: false, error: 'Accesso negato. Permessi insufficienti.' });
}

// Funzione requireAdmin (se necessaria in futuro)
function requireAdmin(req, res, next) {
    if (req.isAuthenticated() && req.user?.tipo === 'amministratore') return next();
    res.status(403).render('error', { message: 'Accesso negato. Devi essere Amministratore.', user: req.user });
}


// --- Rotte Pubbliche Specifiche (PRIMA di authRoutes) ---
app.get('/', (req, res) => res.render('index', { pageTitle: 'Benvenuto' }));

// --- Rotta per Verifica Stato Autenticazione (per il frontend) ---
app.get('/auth-status', (req, res) => {
    // Usa req.user popolato da passport.deserializeUser come fonte primaria
    const user = req.user || null;
    console.log(`[GET /auth-status] Richiesta ricevuta. Utente autenticato: ${req.isAuthenticated()}. User:`, user); // Debug
    res.json({
        isAuthenticated: req.isAuthenticated(), // Metodo standard di Passport
        // Non inviare l'intera sessione, solo i dati utente rilevanti
        // sessionUser: req.session.user || null, // Meno affidabile di req.user
        passportUser: user // Invia l'utente deserializzato da Passport
    });
});
// --- Fine Rotta /auth-status ---

app.get('/login', (req, res) => {
    if (req.isAuthenticated()) {
        let redirectUrl = '/homepage_cliente';
        if (req.user.tipo === 'capo') redirectUrl = '/homepage_capo';
        else if (req.user.tipo === 'amministratore') redirectUrl = '/homepage_admin';
        return res.redirect(redirectUrl);
    }
    res.render('login', { pageTitle: 'YourBite - Login' });
});

app.get('/signup', (req, res) => {
     if (req.isAuthenticated()) {
        let redirectUrl = '/homepage_cliente';
        if (req.user.tipo === 'capo') redirectUrl = '/homepage_capo';
        else if (req.user.tipo === 'amministratore') redirectUrl = '/homepage_admin';
        return res.redirect(redirectUrl);
    }
    res.render('signup', { pageTitle: 'YourBite - Registrati' });
});

// --- Rotte Autenticazione (Google e POST /login, /signup, /logout) ---
// Monta authRoutes se definito, altrimenti definisci qui le POST
// if (authRoutes) {
//     app.use('/', authRoutes);
// } else {
    // POST /login (Esempio base, Passport 'local' non configurato qui)
    app.post('/login', (req, res, next) => {
         passport.authenticate('local', (err, user, info) => { // Usa callback custom per JSON
             if (err) { return next(err); }
             if (!user) { return res.status(401).json({ success: false, error: info.message || 'Email o password non validi.' }); }
             req.logIn(user, (loginErr) => { // Stabilisce la sessione
                 if (loginErr) { return next(loginErr); }
                 // Salva in sessione custom (opzionale, passport lo fa già)
                 // req.session.user = { id: user.id, username: user.username, email: user.email, tipo: user.tipo };
                 let redirectUrl = '/homepage_cliente';
                 if (user.tipo === 'capo') redirectUrl = '/homepage_capo';
                 else if (user.tipo === 'amministratore') redirectUrl = '/homepage_admin';
                 return res.json({ success: true, redirectUrl: redirectUrl, username: user.username, tipo: user.tipo });
             });
         })(req, res, next); // Chiamata necessaria per strategia custom
     });

    // POST /signup (Già presente e funzionante)
    app.post('/signup', async (req, res) => { /* ... codice signup esistente ... */ });

    // POST /logout
    app.post('/logout', (req, res, next) => {
        req.logout(function(err) {
            if (err) { return next(err); }
            req.session.destroy(err => {
                if (err) { console.error('Errore distruzione sessione:', err); return res.status(500).json({ success: false, error: 'Errore logout.' }); }
                res.clearCookie('connect.sid');
                res.json({ success: true, message: 'Logout effettuato.' });
            });
        });
    });
// }

// Rotte Google Auth
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
    app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/login' }), (req, res) => {
        // req.user è popolato da Passport
        let redirectUrl = '/homepage_cliente';
        if (req.user.tipo === 'capo') redirectUrl = '/homepage_capo';
        else if (req.user.tipo === 'amministratore') redirectUrl = '/homepage_admin';
        const returnTo = req.session.returnTo || redirectUrl;
        delete req.session.returnTo;
        res.redirect(returnTo);
    });
}


// --- Rotte Pagine Protette ---
app.get('/homepage_cliente', requireLogin, (req, res) => res.render('homepage_cliente', { pageTitle: 'Homepage', user: req.user }));
app.get('/homepage_admin', requireLogin, requireAdmin, (req, res) => res.render('homepage_admin', { pageTitle: 'Admin', user: req.user }));
app.get('/homepage_capo', requireLogin, verificaRuoloCapo, (req, res) => res.render('homepage_capo', { pageTitle: 'Dashboard Capo', user: req.user }));
app.get('/dashboard', requireLogin, verificaRuoloCapo, (req, res) => res.render('dashboard', { pageTitle: 'Dashboard', user: req.user, /* dati */ }));
app.get('/ordini', requireLogin, verificaRuoloCapo, (req, res) => res.render('ordini', { pageTitle: 'Ordini', user: req.user, /* ordini */ }));
app.get('/menu', requireLogin, verificaRuoloCapo, (req, res) => res.render('menu', { pageTitle: 'Menu', user: req.user, /* prodotti, categorie */ }));
app.get('/clienti', requireLogin, verificaRuoloCapo, (req, res) => res.render('clienti', { pageTitle: 'Clienti', user: req.user, /* clienti */ }));
app.get('/personale', requireLogin, verificaRuoloCapo, (req, res) => res.render('personale', { pageTitle: 'Personale', user: req.user }));
app.get('/impostazioni', requireLogin, verificaRuoloCapo, async (req, res) => {
     try {
        const settings = await loadSettingsFromDb();
        res.render('impostazioni', {
            titolo: 'Impostazioni',
            impostazioniJson: JSON.stringify(settings), // Passa come JSON per JS
            user: req.user
        });
     } catch (error) {
          console.error("Errore caricamento impostazioni per render:", error);
          res.status(500).render('error', { message: 'Errore caricamento impostazioni', user: req.user });
      }
 });
 app.get('/chat', requireLogin, (req, res) => res.render('chat', { pageTitle: 'Chat Assistenza', user: req.user }));
 app.get('/admin-chat', requireLogin, verificaRuoloCapo, (req, res) => res.render('admin-chat', { pageTitle: 'Admin Chat', user: req.user }));


// --- API Endpoints Impostazioni ---

// Funzione helper per caricare le impostazioni dal DB
async function loadSettingsFromDb() {
    return new Promise((resolve, reject) => {
        db.all("SELECT key, value FROM impostazioni", [], (err, rows) => {
            if (err) {
                console.error("Errore DB lettura impostazioni:", err);
                return reject(new Error("Errore database"));
            }
            const settings = {};
            const defaultSettings = getDefaultSettings(); // Carica default

            rows.forEach(row => {
                try {
                    // Prova a fare il parse se sembra JSON/Array/Boolean/Numero, altrimenti usa stringa
                    if (row.value === 'true') {
                         settings[row.key] = true;
                     } else if (row.value === 'false') {
                          settings[row.key] = false;
                     } else if ((row.value.startsWith('{') && row.value.endsWith('}')) || (row.value.startsWith('[') && row.value.endsWith(']'))) {
                        settings[row.key] = JSON.parse(row.value);
                     } else if (!isNaN(parseFloat(row.value)) && isFinite(row.value) && row.value.trim() !== '') {
                           settings[row.key] = parseFloat(row.value); // Converte numeri
                       }
                     else {
                        settings[row.key] = row.value; // Stringa o null/undefined
                    }
                } catch (e) {
                    console.warn(`Impossibile fare il parse del valore per la chiave ${row.key}, usando come stringa: ${row.value}`);
                    settings[row.key] = row.value; // Fallback a stringa
                }
            });
             // Unisci con i default per assicurarti che tutte le chiavi esistano
             resolve({ ...defaultSettings, ...settings });
        });
    });
}

// Funzione helper per ottenere impostazioni di default
function getDefaultSettings() {
     return {
         profile: { nome: 'Il Tuo Locale', categoria: 'Ristorante', indirizzo: '', telefono: '', email: '', descrizione: '', logo: '/img/logo-placeholder.png', immagini: [], mostraPrezziIVA: true, mostraIngredienti: true, mostraValoriNutrizionali: false, mostraAllergeni: true },
         schedule: { lun: { enabled: true, slots: [{ start: '11:30', end: '15:00' }, { start: '18:30', end: '23:00' }] }, mar: { enabled: true, slots: [{ start: '11:30', end: '15:00' }, { start: '18:30', end: '23:00' }] }, mer: { enabled: true, slots: [{ start: '11:30', end: '15:00' }, { start: '18:30', end: '23:00' }] }, gio: { enabled: true, slots: [{ start: '11:30', end: '15:00' }, { start: '18:30', end: '23:00' }] }, ven: { enabled: true, slots: [{ start: '11:30', end: '15:00' }, { start: '18:30', end: '00:00' }] }, sab: { enabled: true, slots: [{ start: '11:30', end: '15:00' }, { start: '18:30', end: '00:30' }] }, dom: { enabled: false, slots: [] } },
         payments: { methods: ['contanti', 'carta'], gateway: 'stripe', stripe_pk: '', stripe_sk: '', sandbox: true, pag_consegna: true },
         notifications: { email_ordini: true, email_recensioni: true, email_report: false, email_address: '', client_email_conferma: true, client_email_stato: true, client_email_recensione: false, push_gestore: true, push_cliente: true, suoni: true },
         appearance: { theme_color: 'primary', font: 'Montserrat', dark_mode: false },
         security: { two_fa_enabled: false, log_activity: true },
         mobile: { notify_push: true, inapp_orders: true, loyalty: false, link_ios: '', link_android: '' },
         advanced: { maintenance_mode: false, maintenance_message: 'Sito in manutenzione, torniamo presto!', api_key: 'yb_api_' + crypto.randomBytes(16).toString('hex') },
         integrations: { 'google-analytics': { connected: false, id: '' }, 'facebook-pixel': { connected: false, id: '' }, 'delivery': { connected: false, service: '' }, 'pos': { connected: false, type: '' }, 'mailchimp': { connected: false, apiKey: '', listId: '' }, 'twilio': { connected: false, accountSid: '', authToken: '', fromNumber: '' } },
         webhooks: []
     };
 }


// GET API per caricare le impostazioni
app.get('/api/settings', requireApiCapo, async (req, res) => {
    try {
        const settings = await loadSettingsFromDb();
        res.json({ success: true, settings });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Errore nel caricamento delle impostazioni.' });
    }
});

// POST API per salvare le impostazioni
app.post('/api/settings', requireApiCapo, (req, res) => {
    const newSettings = req.body.settings;

    if (!newSettings || typeof newSettings !== 'object') {
        return res.status(400).json({ success: false, error: 'Dati impostazioni mancanti o non validi.' });
    }

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        let errorOccurred = false;
        const stmt = db.prepare("INSERT OR REPLACE INTO impostazioni (key, value) VALUES (?, ?)");
        const promises = []; // Array per promesse DB

        for (const key in newSettings) {
            if (Object.hasOwnProperty.call(newSettings, key)) {
                const value = newSettings[key];
                let dbValue;
                try {
                    if (typeof value === 'object' && value !== null) {
                        dbValue = JSON.stringify(value);
                    } else {
                        dbValue = String(value); // Salva tutto come stringa per semplicità (true/false diventano 'true'/'false')
                    }
                } catch (e) {
                    console.error(`Errore stringify per chiave ${key}:`, e);
                    errorOccurred = true;
                    break; // Interrompi ciclo se c'è errore di stringify
                }

                // Crea una promessa per ogni operazione DB
                const promise = new Promise((resolve, reject) => {
                     stmt.run(key, dbValue, function(err) {
                         if (err) {
                             console.error(`Errore salvataggio impostazione ${key}:`, err.message);
                             reject(err); // Rifiuta la promessa in caso di errore
                         } else {
                             resolve(); // Risolvi la promessa se OK
                         }
                     });
                 });
                 promises.push(promise);
            }
        }

        // Esegui tutte le promesse DB
         Promise.all(promises)
             .then(() => {
                  // Tutte le operazioni sono andate a buon fine (finora)
                  stmt.finalize((finalizeErr) => {
                       if (finalizeErr) {
                            console.error("Errore finalizzazione statement:", finalizeErr);
                            throw finalizeErr; // Lancia errore per andare nel catch
                        }
                        db.run('COMMIT', (commitErr) => {
                             if (commitErr) {
                                 console.error("Errore commit transazione:", commitErr);
                                 throw commitErr; // Lancia errore per andare nel catch
                             }
                             console.log("Impostazioni salvate con successo.");
                             if (!res.headersSent) {
                                res.json({ success: true, message: 'Impostazioni salvate con successo.' });
                             }
                         });
                   });
              })
              .catch((err) => {
                   // Si è verificato un errore in una delle promesse o nel commit/finalize
                   console.error("Errore durante il salvataggio delle impostazioni, eseguo rollback:", err);
                   db.run('ROLLBACK', (rollbackErr) => {
                        if (rollbackErr) console.error("Errore durante il ROLLBACK:", rollbackErr);
                        if (!res.headersSent) {
                           res.status(500).json({ success: false, error: 'Errore durante il salvataggio delle impostazioni.' });
                        }
                    });
               });
    });
});


// --- API Endpoints Gestione Utenti (Settings) ---
// GET /api/settings/users
app.get('/api/settings/users', requireApiCapo, (req, res) => {
     db.all("SELECT id, username, email, tipo FROM utenti WHERE tipo != 'cliente' ORDER BY username", [], (err, rows) => {
         if (err) { console.error("Errore lettura utenti impostazioni:", err); return res.status(500).json({ success: false, error: 'Errore database' }); }
         res.json({ success: true, users: rows });
     });
 });

// POST /api/settings/users
app.post('/api/settings/users', requireApiCapo, (req, res) => {
    const { username, email, password, tipo } = req.body;
    const validRoles = ['capo', 'manager', 'cassiere', 'amministratore'];
    if (!username || !email || !password || !tipo || !validRoles.includes(tipo)) return res.status(400).json({ success: false, error: 'Dati mancanti o ruolo non valido.' });
    // Aggiungere validazione password
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*?&]{8,}$/;
     if (!passwordRegex.test(password)) return res.status(400).json({ error: 'Password non valida (min 8 caratteri, 1 lettera, 1 numero).' });

    db.get("SELECT id FROM utenti WHERE email = ? OR username = ?", [email, username], (errDup, rowDup) => {
         if (errDup) { console.error("Errore controllo duplicati:", errDup); return res.status(500).json({ success: false, error: 'Errore database' }); }
         if (rowDup) { const field = rowDup.email === email ? 'Email' : 'Username'; return res.status(409).json({ success: false, error: `${field} già in uso.` }); }
         const hashedPassword = bcrypt.hashSync(password, 10);
         db.run("INSERT INTO utenti (username, email, password, tipo) VALUES (?, ?, ?, ?)", [username, email, hashedPassword, tipo], function(err) {
             if (err) { console.error("Errore inserimento utente:", err); return res.status(500).json({ success: false, error: 'Errore database' }); }
             res.status(201).json({ success: true, user: { id: this.lastID, username: username, email: email, tipo: tipo } });
         });
      });
});

// PUT /api/settings/users/:id
app.put('/api/settings/users/:id', requireApiCapo, (req, res) => {
    const userId = req.params.id;
    const { username, email, tipo } = req.body;
    const validRoles = ['capo', 'manager', 'cassiere', 'amministratore'];
    if (!username || !email || !tipo || !validRoles.includes(tipo)) return res.status(400).json({ success: false, error: 'Dati mancanti o ruolo non valido.' });

    db.get("SELECT id FROM utenti WHERE (email = ? OR username = ?) AND id != ?", [email, username, userId], (errDup, rowDup) => {
         if (errDup) { console.error("Errore controllo duplicati:", errDup); return res.status(500).json({ success: false, error: 'Errore database' }); }
         if (rowDup) { const field = rowDup.email === email ? 'Email' : 'Username'; return res.status(409).json({ success: false, error: `${field} già in uso.` }); }
         db.run("UPDATE utenti SET username = ?, email = ?, tipo = ? WHERE id = ? AND tipo != 'cliente'", [username, email, tipo, userId], function(err) {
             if (err) { console.error("Errore modifica utente:", err); return res.status(500).json({ success: false, error: 'Errore database' }); }
             if (this.changes === 0) return res.status(404).json({ success: false, error: 'Utente non trovato o non modificabile.' });
             res.json({ success: true, message: 'Utente aggiornato.' });
         });
      });
 });

 // DELETE /api/settings/users/:id
 app.delete('/api/settings/users/:id', requireApiCapo, (req, res) => {
     const userIdToDelete = req.params.id;
     if (req.user.id == userIdToDelete) return res.status(400).json({ success: false, error: 'Non puoi eliminare te stesso.' });
     db.run("DELETE FROM utenti WHERE id = ? AND tipo != 'cliente'", [userIdToDelete], function(err) {
         if (err) { console.error("Errore eliminazione utente:", err); return res.status(500).json({ success: false, error: 'Errore database' }); }
         if (this.changes === 0) return res.status(404).json({ success: false, error: 'Utente non trovato o non eliminabile.' });
         res.json({ success: true, message: 'Utente eliminato.' });
     });
 });


// --- API Endpoints Sicurezza (Parzialmente Reali) ---
app.post('/api/settings/security/change-password', requireApiCapo, (req, res) => {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const userId = req.user.id;
    if (!currentPassword || !newPassword || !confirmPassword) return res.status(400).json({ success: false, error: 'Tutti i campi password richiesti.' });
    if (newPassword !== confirmPassword) return res.status(400).json({ success: false, error: 'Le nuove password non coincidono.' });
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(newPassword)) return res.status(400).json({ error: 'Password non sicura.' });

    db.get("SELECT password FROM utenti WHERE id = ?", [userId], (err, user) => {
        if (err || !user) { console.error("Errore recupero utente:", err); return res.status(500).json({ success: false, error: 'Errore recupero utente.' }); }
        bcrypt.compare(currentPassword, user.password, (compareErr, isMatch) => {
            if (compareErr) { console.error("Errore compare:", compareErr); return res.status(500).json({ success: false, error: 'Errore verifica password.' }); }
            if (!isMatch) return res.status(400).json({ success: false, error: 'Password attuale errata.' });
            const hashedNewPassword = bcrypt.hashSync(newPassword, 10);
            db.run("UPDATE utenti SET password = ? WHERE id = ?", [hashedNewPassword, userId], (updateErr) => {
                if (updateErr) { console.error("Errore update password:", updateErr); return res.status(500).json({ success: false, error: 'Errore salvataggio password.' }); }
                console.log(`Password aggiornata per utente ID: ${userId}`);
                res.json({ success: true, message: 'Password aggiornata.' });
            });
        });
    });
});

 // Endpoint 2FA (Salva stato)
 app.post('/api/settings/security/toggle-2fa', requireApiCapo, async (req, res) => {
     const enable2fa = !!req.body.enable;
     console.log(`${enable2fa ? 'Abilitazione' : 'Disabilitazione'} 2FA per utente ${req.user.id}`);
     try {
         const settings = await loadSettingsFromDb();
         const updatedSecurity = { ...(settings.security || {}), two_fa_enabled: enable2fa };
         db.run("INSERT OR REPLACE INTO impostazioni (key, value) VALUES (?, ?)", ['security', JSON.stringify(updatedSecurity)], (err) => {
             if (err) throw err;
             res.json({ success: true, message: `Autenticazione a due fattori ${enable2fa ? 'abilitata' : 'disabilitata'}.` });
         });
     } catch (error) {
         console.error("Errore salvataggio stato 2FA:", error);
         res.status(500).json({ success: false, error: 'Errore salvataggio stato 2FA.' });
     }
 });

 // Endpoint Sessioni (Simulati)
 app.delete('/api/settings/security/sessions/:sessionId', requireApiCapo, (req, res) => {
     const sessionId = req.params.sessionId;
     console.log(`Simulazione terminazione sessione ${sessionId} per utente ${req.user.id}`);
     res.json({ success: true, message: `Sessione ${sessionId} terminata (simulato).` });
 });
 app.delete('/api/settings/security/sessions/all', requireApiCapo, (req, res) => {
     console.log(`Simulazione terminazione TUTTE le altre sessioni per utente ${req.user.id}`);
     res.json({ success: true, message: 'Tutte le altre sessioni terminate (simulato).' });
 });

// --- API Endpoints Integrazioni (Salvano stato base) ---
app.post('/api/settings/integrations/connect/:service', requireApiCapo, async (req, res) => {
    const service = req.params.service;
    console.log(`Salvataggio stato connessione per integrazione: ${service}`);
    try {
        const settings = await loadSettingsFromDb();
        const integrations = settings.integrations || {};
        integrations[service] = { ...integrations[service], connected: true };
        db.run("INSERT OR REPLACE INTO impostazioni (key, value) VALUES (?, ?)", ['integrations', JSON.stringify(integrations)], (err) => {
             if(err) throw err;
             res.json({ success: true, message: `Integrazione ${service} connessa.` });
        });
    } catch(error) { res.status(500).json({ success: false, error: 'Errore salvataggio stato integrazione.' }); }
});
app.post('/api/settings/integrations/disconnect/:service', requireApiCapo, async (req, res) => {
    const service = req.params.service;
    console.log(`Salvataggio stato disconnessione per integrazione: ${service}`);
     try {
        const settings = await loadSettingsFromDb();
        const integrations = settings.integrations || {};
        if(integrations[service]) integrations[service].connected = false;
        db.run("INSERT OR REPLACE INTO impostazioni (key, value) VALUES (?, ?)", ['integrations', JSON.stringify(integrations)], (err) => {
             if(err) throw err;
             res.json({ success: true, message: `Integrazione ${service} disconnessa.` });
        });
    } catch(error) { res.status(500).json({ success: false, error: 'Errore salvataggio stato integrazione.' }); }
});
app.post('/api/settings/integrations/webhook', requireApiCapo, async (req, res) => {
    const { url } = req.body;
    if (!url || !url.startsWith('http')) return res.status(400).json({ success: false, error: 'URL webhook non valido.' });
    console.log(`Salvataggio webhook: ${url}`);
    try {
         const settings = await loadSettingsFromDb();
         const webhooks = settings.webhooks || [];
         if (!webhooks.includes(url)) {
             webhooks.push(url);
             db.run("INSERT OR REPLACE INTO impostazioni (key, value) VALUES (?, ?)", ['webhooks', JSON.stringify(webhooks)], (err) => {
                  if(err) throw err;
                  res.json({ success: true, message: 'Webhook aggiunto.' });
             });
         } else { res.json({ success: true, message: 'Webhook già presente.' }); }
     } catch(error) { res.status(500).json({ success: false, error: 'Errore salvataggio webhook.' }); }
});

// --- API Endpoints Backup/Restore (Simulati) ---
app.post('/api/settings/backup/manual', requireApiCapo, (req, res) => {
    console.log("Avvio backup manuale simulato...");
    const backupFileName = `backup_manuale_${Date.now()}.json`;
    console.log(`Backup simulato: ${backupFileName}`);
    res.json({ success: true, message: `Backup manuale completato (simulato).`, file: backupFileName });
});
// Middleware Multer per upload file di ripristino
const backupStorage = multer.diskStorage({
    destination: function (req, file, cb) { const dir = './backups/uploads'; if (!fs.existsSync(dir)){ fs.mkdirSync(dir, { recursive: true }); } cb(null, dir); },
    filename: function (req, file, cb) { cb(null, `restore_${Date.now()}_${file.originalname}`); }
});
const restoreUpload = multer({ storage: backupStorage, limits: { fileSize: 50 * 1024 * 1024 } }); // Limite 50MB
app.post('/api/settings/backup/restore', requireApiCapo, restoreUpload.single('restoreFile'), (req, res) => {
    if (!req.file) { return res.status(400).json({ success: false, error: 'Nessun file caricato.' }); }
    const filePath = req.file.path;
    console.log(`File ripristino caricato: ${filePath}. Ripristino simulato...`);
    setTimeout(() => {
        console.log(`Ripristino simulato da ${req.file.originalname} completato.`);
        fs.unlink(filePath, (err) => { if (err) console.error("Errore eliminazione file upload:", err); });
        res.json({ success: true, message: `Ripristino da ${req.file.originalname} completato (simulato).` });
    }, 3000);
});

// --- API Endpoints Avanzate (Parzialmente Reali) ---
app.post('/api/settings/advanced/clear-cache', requireApiCapo, (req, res) => {
    console.log("Simulazione svuotamento cache...");
    res.json({ success: true, message: 'Cache svuotata (simulato).' });
});
app.post('/api/settings/advanced/maintenance', requireApiCapo, async (req, res) => {
     const enable = !!req.body.enable;
     const message = req.body.message || getDefaultSettings().advanced.maintenance_message;
     console.log(`Setting modalità manutenzione a: ${enable}`);
     try {
         const settings = await loadSettingsFromDb();
         const updatedAdvanced = { ...(settings.advanced || {}), maintenance_mode: enable, maintenance_message: message };
         db.run("INSERT OR REPLACE INTO impostazioni (key, value) VALUES (?, ?)", ['advanced', JSON.stringify(updatedAdvanced)], (err) => {
             if (err) throw err;
             res.json({ success: true, message: `Modalità manutenzione ${enable ? 'attivata' : 'disattivata'}.` });
         });
     } catch (error) { res.status(500).json({ success: false, error: 'Errore salvataggio stato manutenzione.' }); }
 });
 app.post('/api/settings/advanced/regenerate-apikey', requireApiCapo, async (req, res) => {
    const newApiKey = 'yb_api_' + crypto.randomBytes(20).toString('hex');
    console.log(`Rigenerazione API Key.`);
    try {
        const currentSettings = await loadSettingsFromDb();
        const currentAdvancedSettings = currentSettings.advanced || {};
        const updatedAdvancedSettings = { ...currentAdvancedSettings, api_key: newApiKey };
        db.run("INSERT OR REPLACE INTO impostazioni (key, value) VALUES (?, ?)", ['advanced', JSON.stringify(updatedAdvancedSettings)], (err) => {
            if (err) { console.error("Errore salvataggio API key:", err); if (!res.headersSent) return res.status(500).json({ success: false, error: 'Errore DB.' }); }
            else { console.log("Nuova API Key salvata."); if (!res.headersSent) res.json({ success: true, message: 'Nuova chiave API generata.' }); }
        });
    } catch (error) { if (!res.headersSent) res.status(500).json({ success: false, error: 'Errore server.' }); }
});
app.post('/api/settings/advanced/factory-reset', requireApiCapo, (req, res) => {
    console.warn("!!! ESECUZIONE RESET IMPOSTAZIONI (SIMULATO) !!!");
    res.json({ success: true, message: 'Impostazioni ripristinate (simulato).' });
});


// --- Altre API (Panini, Personale, Chat - Mantenute come prima, assicurati siano definite) ---
// ... (le tue API per /api/panini/*, /api/personale/*, /api/chat/*) ...
// API Panini (Esempio placeholder)
app.get('/api/panini', async (req, res) => { /* ... */ res.json([]); });
app.get('/api/panini/:id', async (req, res) => { /* ... */ res.status(404).json({error: 'Not found'}); });
// API Personale (Esempio placeholder)
app.get('/api/personale', requireApiCapo, (req, res) => { db.all('SELECT * FROM dipendenti', [], (err, rows) => res.json({success: !err, personale: rows || []})); });
app.get('/api/personale/:id', requireApiCapo, (req, res) => { db.get('SELECT * FROM dipendenti WHERE id = ?', [req.params.id], (err, row) => res.status(row ? 200 : 404).json({success: !err && !!row, dipendente: row})); });
app.post('/api/personale', requireApiCapo, (req, res) => { /* ... codice add personale ... */ res.status(501).json({error: 'Not implemented'}); });
app.put('/api/personale/:id', requireApiCapo, (req, res) => { /* ... codice update personale ... */ res.status(501).json({error: 'Not implemented'}); });
app.delete('/api/personale/:id', requireApiCapo, (req, res) => { /* ... codice delete personale ... */ res.status(501).json({error: 'Not implemented'}); });
// API Chat (Esempio placeholder)
app.get('/api/chat/rooms', requireApiCapo, (req, res) => { /* ... codice get rooms ... */ res.json({rooms: []}); });
app.get('/api/chat/history/:roomId', requireLogin, (req, res) => { db.all('SELECT * FROM chat_messages WHERE room_id = ? ORDER BY timestamp ASC', [req.params.roomId], (err, rows) => res.json(rows || [])); });
app.delete('/api/chat/messages/:roomId', requireApiCapo, (req, res) => { /* ... codice delete messages ... */ res.json({success: true, deleted: 0}); });
app.delete('/api/chat/all-conversations', requireApiCapo, (req, res) => { /* ... codice delete all ... */ res.json({success: true, deleted: 0}); });


// --- WebSocket (Socket.IO) Configuration ---
io.on('connection', (socket) => {
    console.log('Nuovo utente connesso via WebSocket:', socket.id);
    // ... (codice gestione eventi socket.io come prima) ...
     socket.on('userJoin', (userData) => { /* ... */ });
     socket.on('operatorJoin', (operatorData) => { /* ... */ });
     socket.on('message', (message) => { /* ... */ });
     socket.on('typing', (data) => { /* ... */ });
     socket.on('disconnect', (reason) => { /* ... */ });
});
// Funzione per salvare messaggi chat nel DB
function saveMessageToDatabase(message) {
    const stmt = db.prepare(`INSERT INTO chat_messages (room_id, sender_id, sender_name, message, timestamp) VALUES (?, ?, ?, ?, ?)`);
    stmt.run(message.roomId, message.senderId, message.sender, message.text, message.timestamp, (err) => { if (err) console.error("Errore salvataggio msg chat:", err.message); });
    stmt.finalize();
}

// --- Rotte Varie e Gestione Errori ---
// Swagger UI
try {
    app.use('/swagger', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
} catch (e) { console.error("Errore caricamento Swagger:", e.message); }

// Catch-all per 404 (DEVE ESSERE DOPO TUTTE LE ALTRE ROUTE)
app.use((req, res, next) => {
    console.log(`404 - Pagina non trovata: ${req.method} ${req.originalUrl}`);
    res.status(404).render('error', { message: `Pagina non trovata: ${req.originalUrl}`, status: 404, user: req.user });
});

// Gestore Errori Generico (DEVE ESSERE L'ULTIMO MIDDLEWARE)
app.use((err, req, res, next) => {
    console.error("--------------------");
    console.error("ERRORE SERVER:", new Date().toISOString());
    console.error("Route:", req.method, req.originalUrl);
    console.error("Errore:", err.message);
    console.error("Stack:", err.stack);
    console.error("--------------------");
    const status = err.status || 500;
    // Evita di tentare il render se l'errore è avvenuto dopo l'invio parziale della risposta
    if (res.headersSent) {
        return next(err); // Passa all'handler di default di Express
    }
    res.status(status).render('error', {
        message: err.message || 'Errore interno del server',
        status: status,
        error: process.env.NODE_ENV === 'development' ? err : {},
        user: req.user
    });
});

// Avvio Server
server.listen(port, () => {
    console.log(`Server in esecuzione su http://localhost:${port}`);
    if (fs.existsSync('./swagger.json')) {
        console.log(`Documentazione API: http://localhost:${port}/swagger`);
    }
});

// Gestione chiusura corretta DB
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error(err.message);
        }
        console.log('Connessione database chiusa.');
        process.exit(0);
    });
});