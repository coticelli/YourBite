require('dotenv').config();

const express = require('express');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const LocalStrategy = require('passport-local').Strategy;
const session = require('express-session');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');
// const authRoutes = require('./authRoutes'); // Commentato se non usi un file separato
const axios = require('axios');
const http = require('http');
const { Server } = require('socket.io');
const exphbs = require('express-handlebars');
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const archiver = require('archiver');
const multer = require('multer');

// Crea un'istanza di Express
const app = express();
const port = process.env.PORT || 3000;

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
    secret: process.env.SESSION_SECRET || 'fallback_super_secret_key_12345',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// Initialize passport
app.use(passport.initialize());
app.use(passport.session());

// Middleware per rendere user disponibile alle viste
app.use((req, res, next) => {
    res.locals.user = req.user || null;
    next();
});

// --- Database Setup ---
const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) { console.error("Errore FATALE connessione DB:", err.message); process.exit(1); }
    else { console.log("Connesso al database SQLite:", dbPath); initializeDatabase(); }
});

function initializeDatabase() { /* ... codice invariato ... */
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS utenti (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL, tipo TEXT NOT NULL DEFAULT 'cliente', created_at TEXT DEFAULT CURRENT_TIMESTAMP, google_id TEXT UNIQUE)`,(err) => { if(err) console.error("Errore utenti:", err.message); else { console.log("Tabella 'utenti' OK."); insertDefaultUsers(); } });
        db.run(`CREATE TABLE IF NOT EXISTS chat_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, room_id TEXT NOT NULL, sender_id TEXT NOT NULL, sender_name TEXT NOT NULL, message TEXT NOT NULL, timestamp TEXT NOT NULL)`,(err) => { if(err) console.error("Errore chat_messages:", err.message); else console.log("Tabella 'chat_messages' OK."); });
        db.run(`CREATE TABLE IF NOT EXISTS impostazioni (key TEXT PRIMARY KEY, value TEXT)`,(err) => { if(err) console.error("Errore impostazioni:", err.message); else console.log("Tabella 'impostazioni' OK."); });
        db.run(`CREATE TABLE IF NOT EXISTS dipendenti (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, cognome TEXT NOT NULL, posizione TEXT, reparto TEXT, email TEXT UNIQUE, telefono TEXT, data_nascita TEXT, data_assunzione TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT)`,(err) => { if(err) console.error("Errore dipendenti:", err.message); else console.log("Tabella 'dipendenti' OK."); });
    });
}
function insertDefaultUsers() { /* ... codice invariato ... */
    const users = [ { username: 'admin', email: 'admin@example.com', password: 'amministratore', tipo: 'amministratore' }, { username: 'capo', email: 'capo@example.com', password: 'capo', tipo: 'capo' }, { username: 'cliente', email: 'cliente@example.com', password: 'cliente', tipo: 'cliente' } ];
    const stmt = db.prepare("INSERT INTO utenti (username, email, password, tipo) VALUES (?, ?, ?, ?)");
    users.forEach(user => { db.get("SELECT id FROM utenti WHERE email = ? OR username = ?", [user.email, user.username], (err, row) => { if (err) { console.error(`Errore controllo utente ${user.username}:`, err.message); return; } if (!row) { const hashedPassword = bcrypt.hashSync(user.password, 10); stmt.run(user.username, user.email, hashedPassword, user.tipo, (errInsert) => { if (errInsert) console.error(`Errore inserimento utente ${user.username}:`, errInsert.message); else console.log(`Utente di default ${user.username} inserito.`); }); } }); });
    stmt.finalize((err) => { if (!err) console.log("Verifica utenti di default completata."); else console.error("Errore finalize utenti default:", err); });
}

// --- Passport Configuration ---
// Local Strategy
passport.use(new LocalStrategy({ usernameField: 'email', passwordField: 'password' }, (email, password, done) => { /* ... codice LocalStrategy invariato ... */
    db.get('SELECT * FROM utenti WHERE email = ?', [email], (err, user) => { if (err) { return done(err); } if (!user) { return done(null, false, { message: 'Email non trovata.' }); } bcrypt.compare(password, user.password, (compareErr, isMatch) => { if (compareErr) { return done(compareErr); } if (isMatch) { return done(null, user); } else { return done(null, false, { message: 'Password errata.' }); } }); });
}));
// Google Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) { passport.use(new GoogleStrategy({ /* ... codice GoogleStrategy ... */
    clientID: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET, callbackURL: process.env.GOOGLE_CALLBACK_URL || '/auth/google/callback', scope: ['profile', 'email'] }, (accessToken, refreshToken, profile, done) => { /* ... logica google ... */
    const email = profile.emails?.[0]?.value; const googleId = profile.id; const displayName = profile.displayName || email?.split('@')[0] || `google_user_${googleId.substring(0,5)}`; if (!email) return done(new Error('Nessuna email trovata'), null); db.get('SELECT * FROM utenti WHERE google_id = ? OR email = ?', [googleId, email], (err, user) => { if (err) return done(err); if (user) { if (!user.google_id && googleId) { db.run('UPDATE utenti SET google_id = ? WHERE id = ?', [googleId, user.id], (updateErr) => { if (updateErr) console.error("Errore update Google ID:", updateErr); return done(null, user); }); } else { return done(null, user); } } else { const randomPassword = crypto.randomBytes(16).toString('hex'); const hashedPassword = bcrypt.hashSync(randomPassword, 10); let finalUsername = displayName; db.get('SELECT id FROM utenti WHERE username = ?', [finalUsername], (errUser, existingUser) => { if (errUser) return done(errUser); if (existingUser) finalUsername = `${displayName}_${googleId.substring(0, 5)}`; db.run('INSERT INTO utenti (username, email, password, tipo, google_id) VALUES (?, ?, ?, ?, ?)', [finalUsername, email, hashedPassword, 'cliente', googleId], function (errInsert) { if (errInsert) return done(errInsert); const newUser = { id: this.lastID, username: finalUsername, email: email, tipo: 'cliente', google_id: googleId }; return done(null, newUser); }); }); } }); }));
} else { console.warn("Variabili Google non configurate."); }
// Serialize/Deserialize User
passport.serializeUser((user, done) => { done(null, user.id); });
passport.deserializeUser((id, done) => { db.get('SELECT id, username, email, tipo FROM utenti WHERE id = ?', [id], (err, user) => { done(err, user); }); });

// --- Middleware Autenticazione/Autorizzazione ---
function requireLogin(req, res, next) { /* ... codice invariato ... */
    if (req.isAuthenticated()) return next(); req.session.returnTo = req.originalUrl; console.log('requireLogin fallito, redirect a /login'); res.redirect('/login');
}
function verificaRuoloCapo(req, res, next) { /* ... codice invariato ... */
    if (req.isAuthenticated() && req.user?.tipo === 'capo') return next(); console.log('verificaRuoloCapo fallito, accesso negato.'); res.status(403).render('error', { message: 'Accesso negato. Devi essere un Capo.', user: req.user });
}
function requireApiCapo(req, res, next) { /* ... codice invariato ... */
     if (req.isAuthenticated() && req.user?.tipo === 'capo') return next(); res.status(403).json({ success: false, error: 'Accesso negato. Permessi insufficienti.' });
 }
function requireAdmin(req, res, next) { /* ... codice invariato ... */
    if (req.isAuthenticated() && req.user?.tipo === 'amministratore') return next(); res.status(403).render('error', { message: 'Accesso negato. Devi essere Amministratore.', user: req.user });
}


// --- Rotta per Verifica Stato Autenticazione (DOPO passport init, PRIMA delle protette) ---
app.get('/auth-status', (req, res) => {
    const user = req.user || null;
    console.log(`[GET /auth-status] Richiesta. Autenticato: ${req.isAuthenticated()}. User:`, user ? {id: user.id, username: user.username, tipo: user.tipo} : 'Nessuno');
    res.json({
        isAuthenticated: req.isAuthenticated(),
        passportUser: user ? { id: user.id, username: user.username, email: user.email, tipo: user.tipo } : null
    });
});
// --- Fine Rotta /auth-status ---

// --- Rotte Pubbliche Specifiche ---
app.get('/', (req, res) => res.render('index', { pageTitle: 'Benvenuto' }));
app.get('/login', (req, res) => { /* ... codice invariato ... */
    if (req.isAuthenticated()) { let redirectUrl = '/homepage_cliente'; if (req.user.tipo === 'capo') redirectUrl = '/homepage_capo'; else if (req.user.tipo === 'amministratore') redirectUrl = '/homepage_admin'; return res.redirect(redirectUrl); } res.render('login', { pageTitle: 'YourBite - Login' });
});
app.get('/signup', (req, res) => { /* ... codice invariato ... */
     if (req.isAuthenticated()) { let redirectUrl = '/homepage_cliente'; if (req.user.tipo === 'capo') redirectUrl = '/homepage_capo'; else if (req.user.tipo === 'amministratore') redirectUrl = '/homepage_admin'; return res.redirect(redirectUrl); } res.render('signup', { pageTitle: 'YourBite - Registrati' });
});

// --- Rotte Autenticazione (Google e POST /login, /signup, /logout) ---
// POST /login
app.post('/login', (req, res, next) => { /* ... codice invariato ... */
     passport.authenticate('local', (err, user, info) => { if (err) { return next(err); } if (!user) { return res.status(401).json({ success: false, error: info.message || 'Email o password non validi.' }); } req.logIn(user, (loginErr) => { if (loginErr) { return next(loginErr); } let redirectUrl = '/homepage_cliente'; if (user.tipo === 'capo') redirectUrl = '/homepage_capo'; else if (user.tipo === 'amministratore') redirectUrl = '/homepage_admin'; const returnTo = req.session.returnTo || redirectUrl; delete req.session.returnTo; return res.json({ success: true, redirectUrl: returnTo, username: user.username, tipo: user.tipo }); }); })(req, res, next);
 });
// POST /signup
app.post('/signup', async (req, res) => { /* ... codice signup esistente ... */ });
// POST /logout
app.post('/logout', (req, res, next) => { /* ... codice logout esistente ... */ });
// Rotte Google Auth
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) { /* ... codice google auth invariato ... */
    app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] })); app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/login' }), (req, res) => { let redirectUrl = '/homepage_cliente'; if (req.user.tipo === 'capo') redirectUrl = '/homepage_capo'; else if (req.user.tipo === 'amministratore') redirectUrl = '/homepage_admin'; const returnTo = req.session.returnTo || redirectUrl; delete req.session.returnTo; res.redirect(returnTo); });
}

// --- Rotte Pagine Protette ---
app.get('/homepage_cliente', requireLogin, (req, res) => res.render('homepage_cliente', { pageTitle: 'Homepage', user: req.user }));
app.get('/homepage_admin', requireLogin, requireAdmin, (req, res) => res.render('homepage_admin', { pageTitle: 'Admin', user: req.user }));
app.get('/homepage_capo', requireLogin, verificaRuoloCapo, (req, res) => res.render('homepage_capo', { pageTitle: 'Dashboard Capo', user: req.user }));
app.get('/dashboard', requireLogin, verificaRuoloCapo, (req, res) => res.render('dashboard', { pageTitle: 'Dashboard', user: req.user }));
app.get('/ordini', requireLogin, verificaRuoloCapo, (req, res) => res.render('ordini', { pageTitle: 'Ordini', user: req.user }));
app.get('/menu', requireLogin, verificaRuoloCapo, (req, res) => res.render('menu', { pageTitle: 'Menu', user: req.user }));
app.get('/clienti', requireLogin, verificaRuoloCapo, (req, res) => res.render('clienti', { pageTitle: 'Clienti', user: req.user }));
app.get('/personale', requireLogin, verificaRuoloCapo, (req, res) => res.render('personale', { pageTitle: 'Personale', user: req.user }));
app.get('/impostazioni', requireLogin, verificaRuoloCapo, async (req, res) => { /* ... codice come prima ... */
     try { const settings = await loadSettingsFromDb(); res.render('impostazioni', { titolo: 'Impostazioni', impostazioniJson: JSON.stringify(settings), user: req.user }); } catch (error) { console.error("Errore caricamento impostazioni render:", error); res.status(500).render('error', { message: 'Errore impostazioni', user: req.user }); }
 });
 app.get('/chat', requireLogin, (req, res) => res.render('chat', { pageTitle: 'Chat Assistenza', user: req.user }));
 app.get('/admin-chat', requireLogin, verificaRuoloCapo, (req, res) => res.render('admin-chat', { pageTitle: 'Admin Chat', user: req.user }));

// --- API Endpoints Impostazioni ---
async function loadSettingsFromDb() { /* ... codice come prima ... */
    return new Promise((resolve, reject) => { db.all("SELECT key, value FROM impostazioni", [], (err, rows) => { if (err) { console.error("Errore DB lettura impostazioni:", err); return reject(new Error("Errore database")); } const settings = {}; const defaultSettings = getDefaultSettings(); rows.forEach(row => { try { if (row.value === 'true') settings[row.key] = true; else if (row.value === 'false') settings[row.key] = false; else if ((row.value.startsWith('{') && row.value.endsWith('}')) || (row.value.startsWith('[') && row.value.endsWith(']'))) settings[row.key] = JSON.parse(row.value); else if (!isNaN(parseFloat(row.value)) && isFinite(row.value) && row.value.trim() !== '') settings[row.key] = parseFloat(row.value); else settings[row.key] = row.value; } catch (e) { console.warn(`Parse fallito per ${row.key}`); settings[row.key] = row.value; } }); resolve({ ...defaultSettings, ...settings }); }); });
}


// Funzione di fallback modificata per corrispondere alla struttura della tabella panini
function getDefaultProducts() {
    console.warn("API /api/products: Utilizzo dati di esempio statici.");
    return [
        // HAMBURGER (10)
        {
            id: 1, 
            name: "Classic Burger", 
            description: "Hamburger di manzo con cheddar, lattuga, pomodoro e salsa speciale",
            price: 7.50, 
            category: "hamburger", 
            image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
            ingredients: ["manzo", "cheddar", "lattuga", "pomodoro", "salsa speciale"],
            available: true,
            rating: 4.8,
            badges: ["bestseller"]
        },
        {
            id: 2, 
            name: "Cheeseburger Deluxe", 
            description: "Doppio hamburger di manzo con doppio formaggio, cipolle caramellate e salsa BBQ",
            price: 8.50, 
            category: "hamburger", 
            image: "https://images.unsplash.com/photo-1553979459-d2229ba7433b?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
            ingredients: ["manzo", "formaggio", "cipolle caramellate", "salsa BBQ"],
            available: true,
            rating: 4.7
        },
        {
            id: 3, 
            name: "Bacon Supreme", 
            description: "Hamburger di manzo con bacon croccante, formaggio, lattuga e salsa ai funghi",
            price: 9.00, 
            category: "hamburger", 
            image: "https://images.unsplash.com/photo-1582196016295-f8c8bd4b3a99?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
            ingredients: ["manzo", "bacon", "formaggio", "lattuga", "salsa ai funghi"],
            available: true,
            rating: 4.9,
            badges: ["bestseller"]
        },
        {
            id: 4, 
            name: "Double Cheese", 
            description: "Doppio hamburger di manzo con triplo formaggio cheddar e salsa special",
            price: 10.00, 
            category: "hamburger", 
            image: "https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
            ingredients: ["doppio manzo", "triplo cheddar", "salsa special"],
            available: true,
            rating: 4.6
        },
        {
            id: 5, 
            name: "Mushroom Swiss", 
            description: "Hamburger con funghi trifolati, formaggio svizzero e salsa tartufata",
            price: 9.50, 
            category: "hamburger", 
            image: "https://images.unsplash.com/photo-1560614382-d9002da5c7c1?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
            ingredients: ["manzo", "funghi", "formaggio svizzero", "salsa tartufata"],
            available: true,
            rating: 4.5
        },
        {
            id: 6, 
            name: "Avocado Burger", 
            description: "Hamburger con guacamole fresco, jalapenos, pomodoro e cipolla rossa",
            price: 10.50, 
            category: "hamburger", 
            image: "https://images.unsplash.com/photo-1550317138-10000687a72b?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
            ingredients: ["manzo", "guacamole", "jalapenos", "pomodoro", "cipolla rossa"],
            available: true,
            rating: 4.7,
            badges: ["new"]
        },
        {
            id: 7, 
            name: "BBQ Bacon Burger", 
            description: "Hamburger con salsa BBQ, bacon croccante, cipolla croccante e cheddar",
            price: 9.50, 
            category: "hamburger", 
            image: "https://images.unsplash.com/photo-1572802419224-296b0aeee0d9?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
            ingredients: ["manzo", "salsa BBQ", "bacon", "cipolla croccante", "cheddar"],
            available: true,
            rating: 4.8
        },
        {
            id: 8, 
            name: "Italian Burger", 
            description: "Hamburger con mozzarella, pomodori secchi, rucola e pesto",
            price: 9.00, 
            category: "hamburger", 
            image: "https://images.unsplash.com/photo-1603064752734-4c48eff53d05?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
            ingredients: ["manzo", "mozzarella", "pomodori secchi", "rucola", "pesto"],
            available: true,
            rating: 4.6
        },
        {
            id: 9, 
            name: "Blue Cheese Burger", 
            description: "Hamburger con formaggio blue, noci e confettura di cipolla rossa",
            price: 10.00, 
            category: "hamburger", 
            image: "https://images.unsplash.com/photo-1551782450-a2132b4ba21d?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
            ingredients: ["manzo", "gorgonzola", "noci", "confettura di cipolla"],
            available: true,
            rating: 4.3
        },
        {
            id: 10, 
            name: "Mini Burger Trio", 
            description: "Tre mini hamburger: classico, BBQ e formaggio piccante",
            price: 12.00, 
            category: "hamburger", 
            image: "https://images.unsplash.com/photo-1550547660-d9450f859349?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
            ingredients: ["manzo", "vari formaggi", "salse assortite"],
            available: true,
            rating: 4.9,
            badges: ["promo"]
        },
        
        // POLLO (7)
        {
            id: 11, 
            name: "Crispy Chicken", 
            description: "Pollo croccante con insalata, pomodoro e maionese al limone",
            price: 6.50, 
            category: "pollo", 
            image: "https://images.unsplash.com/photo-1606755962773-d324e0a13086?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
            ingredients: ["pollo", "insalata", "pomodoro", "maionese al limone"],
            available: true,
            rating: 4.5
        },
        {
            id: 12, 
            name: "Spicy Chicken", 
            description: "Pollo speziato con peperoncino, jalapenos e salsa piccante",
            price: 7.00, 
            category: "pollo", 
            image: "https://images.unsplash.com/photo-1593703148583-34370374ea01?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
            ingredients: ["pollo", "peperoncino", "jalapenos", "salsa piccante"],
            available: true,
            rating: 4.6,
            badges: ["promo"]
        },
        {
            id: 13, 
            name: "Chicken Avocado", 
            description: "Panino con pollo grigliato, avocado, rucola e salsa allo yogurt",
            price: 8.50, 
            category: "pollo", 
            image: "https://images.unsplash.com/photo-1550471448-9e33c6e24a6e?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
            ingredients: ["pollo grigliato", "avocado", "rucola", "salsa yogurt"],
            available: true,
            rating: 4.7
        },
        {
            id: 14, 
            name: "Buffalo Chicken", 
            description: "Pollo fritto con salsa buffalo piccante, sedano e salsa blue cheese",
            price: 8.00, 
            category: "pollo", 
            image: "https://images.unsplash.com/photo-1626082895534-28ec1a805cf3?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
            ingredients: ["pollo fritto", "salsa buffalo", "sedano", "salsa blue cheese"],
            available: true,
            rating: 4.4
        },
        {
            id: 15, 
            name: "Honey Mustard Chicken", 
            description: "Sandwich di pollo con salsa miele e senape, insalata e pomodoro",
            price: 7.50, 
            category: "pollo", 
            image: "https://images.unsplash.com/photo-1520217185029-38036bd1e118?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
            ingredients: ["pollo", "salsa miele e senape", "insalata", "pomodoro"],
            available: true,
            rating: 4.3
        },
        {
            id: 16, 
            name: "BBQ Chicken", 
            description: "Pollo grigliato con salsa barbecue, cipolla caramellata e cheddar",
            price: 7.50, 
            category: "pollo", 
            image: "https://images.unsplash.com/photo-1465406325903-9d93bc677e8b?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
            ingredients: ["pollo grigliato", "salsa bbq", "cipolla caramellata", "cheddar"],
            available: true,
            rating: 4.5
        },
        {
            id: 17, 
            name: "Chicken Parmigiana", 
            description: "Sandwich con cotoletta di pollo, pomodoro, mozzarella e basilico",
            price: 8.00, 
            category: "pollo", 
            image: "https://images.unsplash.com/photo-1601276884922-9df47f06cd8e?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
            ingredients: ["cotoletta di pollo", "salsa pomodoro", "mozzarella", "basilico"],
            available: true,
            rating: 4.8,
            badges: ["bestseller"]
        },
        
        // PIZZA (7)
        {
            id: 18, 
            name: "Margherita", 
            description: "Pizza classica con pomodoro, mozzarella e basilico fresco",
            price: 8.50, 
            category: "pizza", 
            image: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
            ingredients: ["impasto", "pomodoro", "mozzarella", "basilico"],
            available: true,
            rating: 4.7
        },
        {
            id: 19, 
            name: "Diavola", 
            description: "Pizza con pomodoro, mozzarella e salame piccante",
            price: 9.50, 
            category: "pizza", 
            image: "https://images.unsplash.com/photo-1589840700256-41c5d84af80d?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
            ingredients: ["impasto", "pomodoro", "mozzarella", "salame piccante"],
            available: true,
            rating: 4.8,
            badges: ["bestseller"]
        },
        {
            id: 20, 
            name: "Quattro Formaggi", 
            description: "Pizza bianca con quattro tipi di formaggio",
            price: 10.00, 
            category: "pizza", 
            image: "https://images.unsplash.com/photo-1585238342024-78d387f4a707?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
            ingredients: ["impasto", "mozzarella", "gorgonzola", "fontina", "parmigiano"],
            available: true,
            rating: 4.6
        },
        {
            id: 21, 
            name: "Capricciosa", 
            description: "Pizza con pomodoro, mozzarella, funghi, carciofi, olive e prosciutto cotto",
            price: 11.00, 
            category: "pizza", 
            image: "https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
            ingredients: ["impasto", "pomodoro", "mozzarella", "funghi", "carciofi", "olive", "prosciutto cotto"],
            available: true,
            rating: 4.5
        },
        {
            id: 22, 
            name: "Ortolana", 
            description: "Pizza con verdure grigliate, pomodoro e mozzarella",
            price: 9.50, 
            category: "pizza", 
            image: "https://images.unsplash.com/photo-1513104890138-7c749659a591?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
            ingredients: ["impasto", "pomodoro", "mozzarella", "zucchine", "melanzane", "peperoni"],
            available: true,
            rating: 4.4
        },
        {
            id: 23, 
            name: "Prosciutto e Funghi", 
            description: "Pizza con pomodoro, mozzarella, prosciutto cotto e funghi",
            price: 10.00, 
            category: "pizza", 
            image: "https://images.unsplash.com/photo-1600628421066-f6bda6a7b976?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
            ingredients: ["impasto", "pomodoro", "mozzarella", "prosciutto cotto", "funghi"],
            available: true,
            rating: 4.6
        },
        {
            id: 24, 
            name: "Bufala", 
            description: "Pizza con pomodoro, mozzarella di bufala e basilico",
            price: 11.50, 
            category: "pizza", 
            image: "https://images.unsplash.com/photo-1595708684082-a173bb3a06c5?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
            ingredients: ["impasto", "pomodoro", "mozzarella di bufala", "basilico"],
            available: true,
            rating: 4.9,
            badges: ["new"]
        },
        
        // VEGETARIANO (6)
        {
            id: 25, 
            name: "Veggie Delight", 
            description: "Burger vegetariano con formaggio, cipolla caramellata e rucola",
            price: 6.00, 
            category: "vegetariano", 
            image: "https://images.unsplash.com/photo-1550547660-d9450f859349?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
            ingredients: ["burger vegetariano", "formaggio", "cipolla caramellata", "rucola"],
            available: true,
            rating: 4.3,
            badges: ["new"]
        },
        {
            id: 26, 
            name: "Falafel Pita", 
            description: "Pita con falafel, hummus, insalata e salsa tahini",
            price: 7.00, 
            category: "vegetariano", 
            image: "https://images.unsplash.com/photo-1593001872095-7d5b3868fb1d?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
            ingredients: ["falafel", "hummus", "insalata", "salsa tahini", "pita"],
            available: true,
            rating: 4.4
        },
        {
            id: 27, 
            name: "Panino Caprese", 
            description: "Panino con mozzarella, pomodoro, basilico e olio d'oliva",
            price: 6.50, 
            category: "vegetariano", 
            image: "https://images.unsplash.com/photo-1627308595171-d1b5d67129c4?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
            ingredients: ["pane", "mozzarella", "pomodoro", "basilico", "olio d'oliva"],
            available: true,
            rating: 4.2
        },
        {
            id: 28, 
            name: "Beyond Burger", 
            description: "Hamburger plant-based con formaggio vegano, lattuga e pomodoro",
            price: 9.00, 
            category: "vegetariano", 
            image: "https://images.unsplash.com/photo-1532768799449-931182a3614e?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
            ingredients: ["beyond burger", "formaggio vegano", "lattuga", "pomodoro"],
            available: true,
            rating: 4.7,
            badges: ["promo"]
        },
        {
            id: 29, 
            name: "Wrap Vegetariano", 
            description: "Wrap con hummus, verdure grigliate e salsa yogurt",
            price: 7.50, 
            category: "vegetariano", 
            image: "https://images.unsplash.com/photo-1600850056064-a8b380df8395?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
            ingredients: ["tortilla", "hummus", "verdure grigliate", "yogurt"],
            available: true,
            rating: 4.3
        },
        {
            id: 30, 
            name: "Insalata Buddha Bowl", 
            description: "Insalata con quinoa, ceci, avocado, verdure e dressing al limone",
            price: 8.50, 
            category: "vegetariano", 
            image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
            ingredients: ["quinoa", "ceci", "avocado", "verdure miste", "dressing al limone"],
            available: true,
            rating: 4.5
        },
        
        // CONTORNI (5)
        {
            id: 31, 
            name: "Patatine Fritte", 
            description: "Patatine fritte croccanti servite con ketchup e maionese",
            price: 3.50, 
            category: "contorni", 
            image: "https://images.unsplash.com/photo-1585109649139-366815a0d713?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
            ingredients: ["patate", "sale", "ketchup", "maionese"],
            available: true,
            rating: 4.7,
            badges: ["bestseller"]
        },
        {
            id: 32, 
            name: "Anelli di Cipolla", 
            description: "Anelli di cipolla fritti in pastella croccante",
            price: 4.00, 
            category: "contorni", 
            image: "https://images.unsplash.com/photo-1639024471283-03518883512d?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
            ingredients: ["cipolla", "pastella", "spezie"],
            available: true,
            rating: 4.5
        },
        {
            id: 33, 
            name: "Insalata Mista", 
            description: "Insalata mista con pomodori, carote e dressing alla vinaigrette",
            price: 4.50, 
            category: "contorni", 
            image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
            ingredients: ["lattuga", "pomodori", "carote", "vinaigrette"],
            available: true,
            rating: 4.2
        },
        {
            id: 34, 
            name: "Patate Dolci Fritte", 
            description: "Patatine di patate dolci con salsa aioli",
            price: 4.50, 
            category: "contorni", 
            image: "https://images.unsplash.com/photo-1604135307399-86c6ce0aba8e?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
            ingredients: ["patate dolci", "sale", "aioli"],
            available: true,
            rating: 4.6,
            badges: ["new"]
        },
        {
            id: 35, 
            name: "Mozzarella Sticks", 
            description: "Bastoncini di mozzarella impanati e fritti, serviti con salsa marinara",
            price: 5.00, 
            category: "contorni", 
            image: "https://images.unsplash.com/photo-1548340748-6d98e4c1bf77?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
            ingredients: ["mozzarella", "pangrattato", "salsa marinara"],
            available: true,
            rating: 4.8
        },
        
        // BEVANDE (7)
        {
            id: 36, 
            name: "Coca Cola", 
            description: "Coca Cola classica in lattina",
            price: 2.50, 
            category: "bevande", 
            image: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
            ingredients: ["bevanda gassata"],
            available: true,
            rating: 4.9
        },
        {
            id: 37, 
            name: "Acqua Naturale", 
            description: "Acqua minerale naturale in bottiglia",
            price: 1.50, 
            category: "bevande", 
            image: "https://images.unsplash.com/photo-1616118132534-381148898bb4?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
            ingredients: ["acqua minerale"],
            available: true,
            rating: 4.7
        },
        {
            id: 38, 
            name: "Birra Artigianale", 
            description: "Birra artigianale locale in bottiglia",
            price: 4.50, 
            category: "bevande", 
            image: "https://images.unsplash.com/photo-1608270586620-248524c67de9?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
            ingredients: ["birra artigianale"],
            available: true,
            rating: 4.6,
            badges: ["new"]
        },
        {
            id: 39, 
            name: "Fanta", 
            description: "Bibita gassata all'arancia in lattina",
            price: 2.50, 
            category: "bevande", 
            image: "https://images.unsplash.com/photo-1624517452488-04869289c4ca?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
            ingredients: ["bevanda gassata all'arancia"],
            available: true,
            rating: 4.5
        },
        {
            id: 40, 
            name: "Smoothie Frutta", 
            description: "Smoothie fresco con frutta di stagione e yogurt",
            price: 4.00, 
            category: "bevande", 
            image: "https://images.unsplash.com/photo-1505252585461-04db1eb84625?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
            ingredients: ["frutta mista", "yogurt", "miele"],
            available: true,
            rating: 4.7
        },
        {
            id: 41, 
            name: "Tè Freddo", 
            description: "Tè freddo alla pesca fatto in casa",
            price: 3.00, 
            category: "bevande", 
            image: "https://images.unsplash.com/photo-1556679343-c1306b5ce384?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
            ingredients: ["tè", "pesca", "limone", "menta"],
            available: true,
            rating: 4.4
        },
        {
            id: 42, 
            name: "Caffè Americano", 
            description: "Caffè americano caldo",
            price: 2.00, 
            category: "bevande", 
            image: "https://images.unsplash.com/photo-1509042239860-f0ca3bf6d889?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
            ingredients: ["caffè"],
            available: true,
            rating: 4.3
        },
        
        // DESSERT (5)
        {
            id: 43, 
            name: "Tiramisu", 
            description: "Dolce italiano classico con mascarpone, caffè e cacao",
            price: 5.00, 
            category: "dessert", 
            image: "https://images.unsplash.com/photo-1571877899592-073131018ac5?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
            ingredients: ["savoiardi", "mascarpone", "caffè", "cacao"],
            available: true,
            rating: 4.8,
            badges: ["bestseller"]
        },
        {
            id: 44, 
            name: "Cheesecake", 
            description: "Cheesecake con base di biscotto e topping ai frutti di bosco",
            price: 5.50, 
            category: "dessert", 
            image: "https://images.unsplash.com/photo-1524351199678-941a58a3df50?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
            ingredients: ["formaggio", "biscotti", "frutti di bosco"],
            available: true,
            rating: 4.7
        },
        {
            id: 45, 
            name: "Brownie al Cioccolato", 
            description: "Brownie al cioccolato servito con gelato alla vaniglia",
            price: 5.00, 
            category: "dessert", 
            image: "https://images.unsplash.com/photo-1564355808539-22fda35bed7e?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
            ingredients: ["cioccolato", "uova", "burro", "gelato alla vaniglia"],
            available: true,
            rating: 4.9,
            badges: ["new"]
        },
        {
            id: 46, 
            name: "Gelato Artigianale", 
            description: "Gelato artigianale in vari gusti: vaniglia, cioccolato, fragola",
            price: 4.00, 
            category: "dessert", 
            image: "https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
            ingredients: ["latte", "panna", "zucchero", "aromi naturali"],
            available: true,
            rating: 4.6
        },
        {
            id: 47, 
            name: "Cannolo Siciliano", 
            description: "Cannolo siciliano tradizionale con ricotta e gocce di cioccolato",
            price: 4.50, 
            category: "dessert", 
            image: "https://images.unsplash.com/photo-1626803775151-61d756612f97?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
            ingredients: ["scorza di cannolo", "ricotta", "zucchero", "gocce di cioccolato"],
            available: true,
            rating: 4.5
        },
        
        // SPECIALI (3)
        {
            id: 48, 
            name: "Combo Family", 
            description: "4 hamburger, 2 porzioni di patatine grandi, 4 bevande a scelta",
            price: 25.00, 
            category: "speciali", 
            image: "https://images.unsplash.com/photo-1457460866886-40ef8d4b42a0?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
            ingredients: ["hamburger", "patatine", "bevande"],
            available: true,
            rating: 4.9,
            badges: ["promo"]
        },
        {
            id: 49, 
            name: "Menu Bambino", 
            description: "Mini burger, patatine, bibita e sorpresa",
            price: 8.00, 
            category: "speciali", 
            image: "https://images.unsplash.com/photo-1608039790184-c4c1a7f9a871?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
            ingredients: ["mini burger", "patatine", "bibita"],
            available: true,
            rating: 4.7
        },
        {
            id: 50, 
            name: "Piatto Gourmet", 
            description: "Hamburger gourmet con formaggio di capra, tartufo e chips di patate viola",
            price: 15.00, 
            category: "speciali", 
            image: "https://images.unsplash.com/photo-1525059696034-4967a8e1dca2?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
            ingredients: ["manzo wagyu", "formaggio di capra", "tartufo", "chips di patate viola"],
            available: true,
            rating: 4.8,
            badges: ["new", "promo"]
        }
    ];
}


app.get('/api/settings', requireApiCapo, async (req, res) => { /* ... codice come prima ... */
    try { const settings = await loadSettingsFromDb(); res.json({ success: true, settings }); } catch (error) { res.status(500).json({ success: false, error: 'Errore caricamento impostazioni.' }); }
});
app.post('/api/settings', requireApiCapo, (req, res) => { /* ... codice come prima ... */
    const newSettings = req.body.settings; if (!newSettings || typeof newSettings !== 'object') return res.status(400).json({ success: false, error: 'Dati mancanti.' });
    db.serialize(() => { db.run('BEGIN TRANSACTION'); let errorOccurred = false; const stmt = db.prepare("INSERT OR REPLACE INTO impostazioni (key, value) VALUES (?, ?)"); const promises = []; for (const key in newSettings) { if (Object.hasOwnProperty.call(newSettings, key)) { const value = newSettings[key]; let dbValue; try { if (typeof value === 'object' && value !== null) dbValue = JSON.stringify(value); else dbValue = String(value); } catch (e) { console.error(`Errore stringify ${key}:`, e); errorOccurred = true; break; } if (!errorOccurred) { const promise = new Promise((resolve, reject) => { stmt.run(key, dbValue, function(err) { if (err) reject(err); else resolve(); }); }); promises.push(promise); } } }
    Promise.all(promises).then(() => { stmt.finalize((finalizeErr) => { if (finalizeErr) throw finalizeErr; db.run('COMMIT', (commitErr) => { if (commitErr) throw commitErr; console.log("Impostazioni salvate."); if (!res.headersSent) res.json({ success: true, message: 'Impostazioni salvate.' }); }); }); }).catch((err) => { console.error("Errore salvataggio impostazioni:", err); db.run('ROLLBACK', (rbErr) => { if (rbErr) console.error("Errore ROLLBACK:", rbErr); if (!res.headersSent) res.status(500).json({ success: false, error: 'Errore salvataggio impostazioni.' }); }); }); });
});

// --- API Endpoints Gestione Utenti (Settings) ---
app.get('/api/settings/users', requireApiCapo, (req, res) => { /* ... codice come prima ... */ });
app.post('/api/settings/users', requireApiCapo, (req, res) => { /* ... codice come prima ... */ });
app.put('/api/settings/users/:id', requireApiCapo, (req, res) => { /* ... codice come prima ... */ });
app.delete('/api/settings/users/:id', requireApiCapo, (req, res) => { /* ... codice come prima ... */ });

// --- API Endpoints Sicurezza (Parzialmente Reali) ---
app.post('/api/settings/security/change-password', requireApiCapo, (req, res) => { /* ... codice come prima ... */ });
 app.post('/api/settings/security/toggle-2fa', requireApiCapo, async (req, res) => { /* ... codice come prima ... */ });
 app.delete('/api/settings/security/sessions/:sessionId', requireApiCapo, (req, res) => { /* ... codice simulato ... */ });
 app.delete('/api/settings/security/sessions/all', requireApiCapo, (req, res) => { /* ... codice simulato ... */ });

// --- API Endpoints Integrazioni (Salvano stato base) ---
app.post('/api/settings/integrations/connect/:service', requireApiCapo, async (req, res) => { /* ... codice come prima ... */ });
app.post('/api/settings/integrations/disconnect/:service', requireApiCapo, async (req, res) => { /* ... codice come prima ... */ });
app.post('/api/settings/integrations/webhook', requireApiCapo, async (req, res) => { /* ... codice come prima ... */ });

// --- API Endpoints Backup/Restore (Simulati) ---
app.post('/api/settings/backup/manual', requireApiCapo, (req, res) => { /* ... codice simulato ... */ });
const backupStorage = multer.diskStorage({ destination: (req, file, cb) => { const dir = './backups/uploads'; if (!fs.existsSync(dir)){ fs.mkdirSync(dir, { recursive: true }); } cb(null, dir); }, filename: (req, file, cb) => { cb(null, `restore_${Date.now()}_${file.originalname}`); } });
const restoreUpload = multer({ storage: backupStorage, limits: { fileSize: 50 * 1024 * 1024 } });
app.post('/api/settings/backup/restore', requireApiCapo, restoreUpload.single('restoreFile'), (req, res) => { /* ... codice simulato ... */ });

// --- API Endpoints Avanzate (Parzialmente Reali) ---
app.post('/api/settings/advanced/clear-cache', requireApiCapo, (req, res) => { /* ... codice simulato ... */ });
app.post('/api/settings/advanced/maintenance', requireApiCapo, async (req, res) => { /* ... codice come prima ... */ });
app.post('/api/settings/advanced/regenerate-apikey', requireApiCapo, async (req, res) => { /* ... codice corretto come prima ... */ });
app.post('/api/settings/advanced/factory-reset', requireApiCapo, (req, res) => { /* ... codice simulato ... */ });


// --- Altre API (Panini, Personale, Chat - Placeholder) ---
// --- API Prodotti con utilizzo tabella panini ---
function parseIngredients(ingredientsStr) {
    if (!ingredientsStr) return [];
    
    // Se ingredienti è già in formato JSON (stringa array), parsalo
    if (ingredientsStr.startsWith('[') && ingredientsStr.endsWith(']')) {
        try {
            return JSON.parse(ingredientsStr);
        } catch (e) {
            console.warn("Errore nel parsing JSON ingredienti:", e);
        }
    }
    
    // Altrimenti, dividi la stringa per virgole o altro separatore
    return ingredientsStr.split(',').map(item => item.trim());
}



// GET /api/products (Utilizza la tabella 'panini' esistente)
// Supporta filtri: ingredients, maxPrice, category


app.get('/api/products', async (req, res) => {
    try {
        let query = "SELECT id, nome, descrizione, prezzo, categoria, immagine_url, ingredienti, disponibile FROM panini";
        const params = [];
        const filters = [];
        
        // Filtro per categoria (solo se non è "all")
        if (req.query.category && req.query.category !== 'all') {
            filters.push("categoria = ?");
            params.push(req.query.category);
        }
        
        // Filtro per prezzo massimo
        if (req.query.maxPrice && !isNaN(parseFloat(req.query.maxPrice))) {
            filters.push("prezzo <= ?");
            params.push(parseFloat(req.query.maxPrice));
        }
        
        // Costruisci la query con i filtri
        if (filters.length > 0) {
            query += " WHERE " + filters.join(" AND ");
        }
        
        // Ordina per nome e limita a 100 risultati
        query += " ORDER BY nome LIMIT 100";
        
        console.log("Query prodotti:", query, params);
        
        // Esegui la query
        db.all(query, params, (err, rows) => {
            if (err) {
                console.error("Errore recupero panini:", err);
                // Fallback a dati statici se DB fallisce
                return res.json(getDefaultProducts());
            }
            
            if (rows.length > 0) {
                // Formatta i dati per mantenere compatibilità con il frontend
                let formattedRows = rows.map(row => ({
                    id: row.id,
                    name: row.nome,
                    description: row.descrizione,
                    price: row.prezzo,
                    category: row.categoria,
                    image: row.immagine_url,
                    ingredients: parseIngredients(row.ingredienti),
                    available: row.disponibile === 1,
                    rating: 4.0 + Math.random() * 0.9,  // Rating casuale tra 4.0 e 4.9
                    badges: Math.random() > 0.7 ? [["bestseller", "new", "promo"][Math.floor(Math.random() * 3)]] : []
                }));
                
                // Filtro per ingredienti (applicato dopo la query perché necessita di parsing)
                if (req.query.ingredients) {
                    const requestedIngredients = req.query.ingredients.split(',').map(i => i.trim().toLowerCase());
                    
                    formattedRows = formattedRows.filter(product => {
                        // Verifica che il prodotto abbia almeno uno degli ingredienti richiesti
                        return product.ingredients && product.ingredients.some(ingredient => 
                            requestedIngredients.some(reqIng => 
                                ingredient.toLowerCase().includes(reqIng)
                            )
                        );
                    });
                }
                
                console.log(`Restituendo ${formattedRows.length} prodotti`);
                res.json(formattedRows);
            } else {
                // Se non ci sono panini nel database o nessuno corrisponde ai filtri, usa dati predefiniti
                console.log("Nessun prodotto trovato, uso dati predefiniti");
                let defaultProducts = getDefaultProducts();
                
                // Applica gli stessi filtri ai dati predefiniti
                if (req.query.maxPrice && !isNaN(parseFloat(req.query.maxPrice))) {
                    const maxPrice = parseFloat(req.query.maxPrice);
                    defaultProducts = defaultProducts.filter(p => p.price <= maxPrice);
                }
                
                if (req.query.category && req.query.category !== 'all') {
                    defaultProducts = defaultProducts.filter(p => p.category === req.query.category);
                }
                
                if (req.query.ingredients) {
                    const requestedIngredients = req.query.ingredients.split(',').map(i => i.trim().toLowerCase());
                    defaultProducts = defaultProducts.filter(product => 
                        product.ingredients.some(ingredient => 
                            requestedIngredients.some(reqIng => 
                                ingredient.toLowerCase().includes(reqIng)
                            )
                        )
                    );
                }
                
                console.log(`Restituendo ${defaultProducts.length} prodotti predefiniti`);
                res.json(defaultProducts);
            }
        });
    } catch (error) {
        console.error("Errore critico in API products:", error);
        res.status(500).json({ error: "Errore interno del server" });
    }
});

// GET /api/categories - Ottieni tutte le categorie disponibili
app.get('/api/categories', (req, res) => {
    db.all("SELECT DISTINCT categoria FROM panini WHERE disponibile = 1 ORDER BY categoria", [], (err, rows) => {
        if (err) {
            console.error("Errore recupero categorie:", err);
            return res.json(["hamburger", "pollo", "vegetariano", "pesce"]); // Categorie predefinite
        }
        
        if (rows.length > 0) {
            const categories = rows.map(row => row.categoria);
            res.json(categories);
        } else {
            res.json(["hamburger", "pollo", "vegetariano", "pesce"]); // Categorie predefinite
        }
    });
});

// GET /api/ingredients - Ottieni tutti gli ingredienti disponibili
app.get('/api/ingredients', (req, res) => {
    db.all("SELECT ingredienti FROM panini WHERE disponibile = 1", [], (err, rows) => {
        if (err) {
            console.error("Errore recupero ingredienti:", err);
            return res.json(["manzo", "pollo", "insalata", "pomodoro", "formaggio", "bacon"]); // Ingredienti predefiniti
        }
        
        if (rows.length > 0) {
            // Estrai tutti gli ingredienti dai prodotti
            const allIngredients = new Set();
            rows.forEach(row => {
                const ingredients = parseIngredients(row.ingredienti);
                ingredients.forEach(ingredient => allIngredients.add(ingredient.trim().toLowerCase()));
            });
            
            res.json(Array.from(allIngredients));
        } else {
            res.json(["manzo", "pollo", "insalata", "pomodoro", "formaggio", "bacon"]); // Ingredienti predefiniti
        }
    });
});

// GET /api/user/info (Spostata qui per essere sicuri sia definita)
app.get('/api/user/info', requireLogin, (req, res) => {
    if (req.user) { res.json({ success: true, user: { id: req.user.id, username: req.user.username, email: req.user.email, tipo: req.user.tipo } }); }
    else { res.status(401).json({ success: false, message: 'Utente non autenticato' }); }
});

// API Personale (Esempio placeholder)
app.get('/api/personale', requireApiCapo, (req, res) => { db.all('SELECT * FROM dipendenti', [], (err, rows) => res.json({success: !err, personale: rows || []})); });
app.get('/api/personale/:id', requireApiCapo, (req, res) => { db.get('SELECT * FROM dipendenti WHERE id = ?', [req.params.id], (err, row) => res.status(row ? 200 : 404).json({success: !err && !!row, dipendente: row})); });
app.post('/api/personale', requireApiCapo, (req, res) => { res.status(501).json({error: 'Not implemented'}); });
app.put('/api/personale/:id', requireApiCapo, (req, res) => { res.status(501).json({error: 'Not implemented'}); });
app.delete('/api/personale/:id', requireApiCapo, (req, res) => { res.status(501).json({error: 'Not implemented'}); });
// API Chat (Esempio placeholder)
app.get('/api/chat/rooms', requireApiCapo, (req, res) => {
     // Query reale per ottenere le stanze uniche e ultimo messaggio
     const query = ` SELECT DISTINCT room_id, (SELECT message FROM chat_messages WHERE room_id = cm.room_id ORDER BY timestamp DESC LIMIT 1) as last_message, (SELECT sender_name FROM chat_messages WHERE room_id = cm.room_id AND sender_id LIKE 'client_%' ORDER BY timestamp DESC LIMIT 1) as sender_name, SUBSTR(room_id, 9) as user_id, (SELECT MAX(timestamp) FROM chat_messages WHERE room_id = cm.room_id) as last_timestamp FROM chat_messages cm ORDER BY last_timestamp DESC `;
     db.all(query, [], (err, rows) => {
         if (err) { console.error("Errore recupero chat rooms:", err); return res.status(500).json({rooms: []}); }
         res.json({ rooms: rows });
     });
 });
app.get('/api/chat/history/:roomId', requireLogin, (req, res) => { db.all('SELECT * FROM chat_messages WHERE room_id = ? ORDER BY timestamp ASC', [req.params.roomId], (err, rows) => res.json(rows || [])); });
app.delete('/api/chat/messages/:roomId', requireApiCapo, (req, res) => { /* ... codice delete messages ... */ res.json({success: true, deleted: 0}); });
app.delete('/api/chat/all-conversations', requireApiCapo, (req, res) => { /* ... codice delete all ... */ res.json({success: true, deleted: 0}); });


// --- WebSocket (Socket.IO) Configuration ---
io.on('connection', (socket) => {
    console.log(`[Socket Connect] Nuovo socket connesso: ${socket.id}`);

    socket.on('identify', (userData) => {
        if (!userData || !userData.userId || !userData.username || !userData.userType) { console.error(`[Socket Identify] Dati non validi da ${socket.id}:`, userData); return; }
        socket.userId = userData.userId; socket.username = userData.username; socket.userType = userData.userType;
        console.log(`[Socket Identify] ${socket.id} = ${socket.username} (${socket.userType}, ID: ${socket.userId})`);

        if (socket.userType === 'cliente') {
            const roomId = `support_${socket.userId}`;
            if (!socket.rooms.has(roomId)) { socket.join(roomId); console.log(`[Socket Identify] Cliente ${socket.username} (${socket.id}) aggiunto a ${roomId}`); }
            socket.currentRoom = roomId;
            io.to('support_staff').emit('new_support_request', { roomId, user: { userId: socket.userId, username: socket.username } });
            console.log(`[Socket Identify] Emesso 'new_support_request' a 'support_staff' per ${roomId}`);
        } else if (socket.userType === 'capo' || socket.userType === 'amministratore') {
            if (!socket.rooms.has('support_staff')) { socket.join('support_staff'); console.log(`[Socket Identify] Operatore ${socket.username} (${socket.id}) aggiunto a 'support_staff'`); }
        }
    });

    socket.on('operatorJoinRoom', (data) => {
        if (socket.userType === 'capo' || socket.userType === 'amministratore') {
            const { roomId } = data;
            if (!roomId || !roomId.startsWith('support_')) { console.error(`[Operator Join] Stanza non valida: ${roomId}`); return; }
            if (socket.currentRoom && socket.currentRoom !== roomId && socket.rooms.has(socket.currentRoom)) { socket.leave(socket.currentRoom); console.log(`[Operator Join] ${socket.username} (${socket.id}) lasciato ${socket.currentRoom}`); }
            if (!socket.rooms.has(roomId)) { socket.join(roomId); console.log(`[Operator Join] ${socket.username} (${socket.id}) entrato ${roomId}`); }
            socket.currentRoom = roomId;
            db.all('SELECT * FROM chat_messages WHERE room_id = ? ORDER BY timestamp ASC', [roomId], (err, rows) => {
                if (!err && rows) { socket.emit('past_messages', { roomId: roomId, messages: rows }); console.log(`[Operator Join] Inviati ${rows.length} messaggi passati a ${socket.username} per ${roomId}`); }
                else { console.error(`[Operator Join] Errore recupero cronologia per ${roomId}:`, err); }
            });
        } else { console.warn(`[Operator Join] Tentativo non autorizzato da ${socket.id}`); }
    });

    socket.on('message', (message) => {
        const roomId = message.roomId || socket.currentRoom;
        if (!roomId || !roomId.startsWith('support_')) { console.error(`[Message] da ${socket.id} (${socket.username}) senza roomId valido:`, message); return; }

        // Verifica che il socket sia nella stanza prima di salvare e inviare
        if (socket.rooms.has(roomId)) {
            console.log(`[Message] Ricevuto per ${roomId} da ${message.senderName}: "${message.content}"`);
            saveMessageToDatabase({ roomId, senderId: message.sender, sender: message.senderName, text: message.content, timestamp: message.timestamp || new Date().toISOString() }, (err, savedMsg) => {
                 if(err) { console.error(`[Message] Errore salvataggio DB per ${roomId}:`, err); return; }
                 console.log(`[Message] Messaggio salvato (ID: ${savedMsg?.id}). Invio a ${roomId}...`);
                 io.to(roomId).emit('message', message); // Invia a tutti nella stanza
            });
        } else {
             console.warn(`[Message] Socket ${socket.id} (${socket.username}) tentato invio a ${roomId} senza join.`);
             // Considera se forzare il join o inviare errore al mittente
         }
    });

    socket.on('typing', (data) => {
        const roomId = data.roomId || socket.currentRoom;
        if (roomId && socket.rooms.has(roomId)) { socket.to(roomId).emit('typing', data); }
    });

    socket.on('disconnect', (reason) => {
        console.log(`[Socket Disconnect] ${socket.username || socket.id} disconnesso: ${reason}`);
        if (socket.currentRoom && socket.userData && socket.userType === 'cliente') {
            console.log(`[Socket Disconnect] Notifico uscita di ${socket.username} da ${socket.currentRoom}`);
            io.to('support_staff').emit('userLeave', { userId: socket.userData.userId, username: socket.userData.username, roomId: socket.currentRoom });
        }
    });
});
// Funzione per salvare messaggi chat nel DB (con callback)
function saveMessageToDatabase(message, callback) {
    const stmt = db.prepare(`INSERT INTO chat_messages (room_id, sender_id, sender_name, message, timestamp) VALUES (?, ?, ?, ?, ?)`);
    stmt.run(message.roomId, message.senderId, message.sender, message.text, message.timestamp, function(err) {
        if (callback) callback(err, err ? null : { id: this.lastID, ...message });
    });
    stmt.finalize();
}


// --- Rotte Varie e Gestione Errori ---
// Swagger UI
try { app.use('/swagger', swaggerUi.serve, swaggerUi.setup(swaggerDocument)); } catch (e) { console.error("Errore caricamento Swagger:", e.message); }

// Catch-all per 404
app.use((req, res, next) => { /* ... codice invariato ... */
    console.log(`404 - Pagina non trovata: ${req.method} ${req.originalUrl}`);
    res.status(404).render('error', { message: `Pagina non trovata: ${req.originalUrl}`, status: 404, user: req.user });
});

// Gestore Errori Generico
app.use((err, req, res, next) => { /* ... codice invariato ... */
    console.error("--------------------"); console.error("ERRORE SERVER:", new Date().toISOString()); console.error("Route:", req.method, req.originalUrl); console.error("Errore:", err.message); console.error("Stack:", err.stack); console.error("--------------------");
    const status = err.status || 500; if (res.headersSent) { return next(err); }
    res.status(status).render('error', { message: err.message || 'Errore interno del server', status: status, error: process.env.NODE_ENV === 'development' ? err : {}, user: req.user });
});

// Avvio Server
server.listen(port, () => {
    console.log(`Server in esecuzione su http://localhost:${port}`);
    if (fs.existsSync('./swagger.json')) { console.log(`Documentazione API: http://localhost:${port}/swagger`); }
});

// Gestione chiusura corretta DB
process.on('SIGINT', () => { /* ... codice invariato ... */
    db.close((err) => { if (err) console.error(err.message); console.log('Connessione database chiusa.'); process.exit(0); });
});