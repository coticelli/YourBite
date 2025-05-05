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
const authRoutes = require('./authRoutes');
const axios = require('axios');
const http = require('http');
const { Server } = require('socket.io');
const exphbs = require('express-handlebars');
const https = require('https');

// Crea un'istanza di Express
const app = express();
const port = 3000;

// Crea un server HTTP da Express app (necessario per WebSocket)
const server = http.createServer(app);
// Inizializza Socket.IO con il server HTTP
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});
// --- Configurazione View Engine Handlebars ---
const hbs = exphbs.create({
    extname: '.hbs',
    defaultLayout: false,
    helpers: {
        json: function(context) {
            return JSON.stringify(context);
        }
    }
});

// IMPORTANTE: usa hbs.engine invece di exphbs.engine
app.engine('.hbs', hbs.engine);
app.set('view engine', '.hbs');
app.set('views', path.join(__dirname, 'views'));



// --- Configurazione View Engine Handlebars ---
app.engine('.hbs', exphbs.engine({
    extname: '.hbs', // Usa l'estensione .hbs per i file di template
    defaultLayout: false, // Per ora non usiamo layout di default, ma potremmo in futuro
}));
app.set('view engine', '.hbs');         // Imposta .hbs come estensione predefinita per le viste
app.set('views', path.join(__dirname, 'views')); // 3. Indica a Express dove trovare i file .hbs (nella cartella 'views')
// --- Fine Configurazione View Engine ---

// 4. Servi file statici (CSS, JS, Immagini) dalla cartella 'public'
app.use(express.static(path.join(__dirname, 'public')));
// Nota: authRoutes potrebbe dover essere spostato dopo la configurazione della sessione/passport se usa la sessione


// Middleware
app.use(cors({ origin: '*' }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

console.log(process.env.GOOGLE_CALLBACK_URL)


// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'your_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));


// Initialize passport
app.use(passport.initialize());
app.use(passport.session());
// Aggiungi questo dopo app.use(passport.session());
app.use((req, res, next) => {
    // Sincronizza user tra passport e session
    if (req.user && !req.session.user) {
        req.session.user = {
            id: req.user.id,
            username: req.user.username,
            email: req.user.email,
            tipo: req.user.tipo
        };
    }
    // Rendi disponibile l'utente a tutte le viste
    res.locals.user = req.session.user || req.user || null;
    next();
});


app.use('/', authRoutes);

// Connessione al database SQLite
const db = new sqlite3.Database('./database.db');


// Configure Google Strategy
// Configure Google Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL,
    scope: ['profile', 'email']
},
    (accessToken, refreshToken, profile, done) => {
        // Check if user exists in database using email
        const email = profile.emails && profile.emails.length > 0
            ? profile.emails[0].value
            : null;

        if (!email) {
            return done(new Error('No email found in Google profile'), null);
        }

        db.get('SELECT * FROM utenti WHERE email = ?', [email], (err, user) => {
            if (err) {
                return done(err);
            }

            if (user) {
                // User exists, return user
                return done(null, user);
            } else {
                // User doesn't exist, create new user
                const newUser = {
                    username: profile.displayName || email.split('@')[0],
                    email: email,
                    password: bcrypt.hashSync(Math.random().toString(36).slice(-8), 10), // Random password
                    tipo: 'cliente' // Default user type
                };

                db.run('INSERT INTO utenti (username, email, password, tipo) VALUES (?, ?, ?, ?)',
                    [newUser.username, newUser.email, newUser.password, newUser.tipo],
                    function (err) {
                        if (err) {
                            return done(err);
                        }

                        // Get the inserted user
                        newUser.id = this.lastID;
                        return done(null, newUser);
                    }
                );
            }
        });
    }));


// Serialize user to session
passport.serializeUser((user, done) => {
    done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser((id, done) => {
    db.get('SELECT * FROM utenti WHERE id = ?', [id], (err, user) => {
        done(err, user);
    });
});

// Google authentication routes
app.get('/auth/google', passport.authenticate('google', {
    scope: ['profile', 'email']
}));
// Aggiungi questo codice al tuo file server.js
// Middleware per verificare il ruolo capo
// Sostituisci la tua funzione verificaRuoloCapo con questa versione corretta
function verificaRuoloCapo(req, res, next) {
    // Debug - Log delle informazioni di sessione
    console.log('Session User:', req.session.user);
    console.log('Passport User:', req.user);

    // Verifica se l'utente è autenticato e ha il ruolo di capo
    // Controlla sia req.session.user che req.user (passport)
    if (
        (req.session && req.session.user && req.session.user.tipo === 'capo') ||
        (req.isAuthenticated && typeof req.isAuthenticated === 'function' && req.isAuthenticated() && req.user && req.user.tipo === 'capo')
    ) {
        return next();
    }

    // Per debug durante lo sviluppo - uncommenta per bypassare temporaneamente l'autenticazione
    // console.log('⚠️ DEBUG: Bypassando autenticazione per sviluppo');
    // return next();

    // Reindirizza alla pagina di login se non autorizzato
    console.log('Accesso negato: l\'utente non è un capo o non è autenticato');
    return res.redirect('/login');
}

// ============= ROTTE DASHBOARD CAPO =============
// Pagina Dashboard principale
app.get('/dashboard', verificaRuoloCapo, (req, res) => {
    // Qui potresti recuperare dati reali dal database
    const datiDashboard = {
        ordiniTotali: 247,
        venditeGiornaliere: 1895,
        clientiNuovi: 18,
        tempoMedioPreparazione: 12,
        ordiniRecenti: [
            { id: '1038', totale: '25.90', tempo: '10 minuti fa', stato: 'Completato' },
            { id: '1037', totale: '18.50', tempo: '22 minuti fa', stato: 'Completato' },
            { id: '1036', totale: '32.75', tempo: '35 minuti fa', stato: 'Completato' },
            { id: '1035', totale: '15.20', tempo: '45 minuti fa', stato: 'Completato' }
        ]
    };

    res.render('dashboard', {
        titolo: 'Dashboard Capo',
        dati: datiDashboard,
        user: req.user
    });
});

// ============= ROTTE GESTIONE ORDINI =============
// Pagina Ordini
app.get('/ordini', verificaRuoloCapo, (req, res) => {
    // Recupero ordini dal database
    const ordini = [
        { id: '1038', cliente: 'Marco Rossi', data: '24/03/2025 14:20', totale: '25.90', stato: 'Completato' },
        { id: '1037', cliente: 'Laura Bianchi', data: '24/03/2025 14:05', totale: '18.50', stato: 'Completato' },
        { id: '1036', cliente: 'Giuseppe Verdi', data: '24/03/2025 13:40', totale: '32.75', stato: 'Completato' },
        { id: '1035', cliente: 'Francesca Neri', data: '24/03/2025 13:10', totale: '15.20', stato: 'Completato' },
        { id: '1034', cliente: 'Antonio Russo', data: '24/03/2025 12:45', totale: '27.60', stato: 'In preparazione' },
        { id: '1033', cliente: 'Elena Martini', data: '24/03/2025 12:30', totale: '21.40', stato: 'In attesa' }
    ];

    res.render('ordini', {
        titolo: 'Gestione Ordini',
        ordini: ordini,
        user: req.user
    });
});

// API per visualizzare dettagli ordine
app.get('/ordini/:id', verificaRuoloCapo, (req, res) => {
    const idOrdine = req.params.id;
    // Qui recupereresti i dettagli dell'ordine dal database
    res.json({ message: `Dettagli dell'ordine ${idOrdine}` });
});

// API per aggiornare stato ordine
app.post('/ordini/:id/stato', verificaRuoloCapo, (req, res) => {
    const idOrdine = req.params.id;
    const nuovoStato = req.body.stato;

    // Qui aggiorneresti lo stato dell'ordine nel database
    res.json({
        success: true,
        message: `Stato dell'ordine ${idOrdine} aggiornato a ${nuovoStato}`
    });
});

// ============= ROTTE GESTIONE MENU =============
// Pagina Menu
app.get('/menu', verificaRuoloCapo, (req, res) => {
    // Recupero prodotti dal database
    const prodotti = [
        {
            id: 1,
            nome: 'Burger Classic',
            prezzo: 8.90,
            descrizione: 'Hamburger di manzo, insalata, pomodoro, cipolla e salsa speciale.',
            categoria: 'Panini',
            stato: 'Attivo',
            immagine: 'https://source.unsplash.com/random/300x200/?burger'
        },
        {
            id: 2,
            nome: 'Pizza Margherita',
            prezzo: 9.50,
            descrizione: 'Pomodoro, mozzarella, basilico e olio d\'oliva.',
            categoria: 'Pizze',
            stato: 'Attivo',
            immagine: 'https://source.unsplash.com/random/300x200/?pizza'
        },
        {
            id: 3,
            nome: 'Patatine Fritte',
            prezzo: 3.50,
            descrizione: 'Patatine croccanti servite con ketchup o maionese.',
            categoria: 'Patatine',
            stato: 'Attivo',
            immagine: 'https://source.unsplash.com/random/300x200/?fries'
        },
        {
            id: 4,
            nome: 'Chicken Burger',
            prezzo: 7.90,
            descrizione: 'Hamburger di pollo, insalata, pomodoro e salsa ai peperoni.',
            categoria: 'Panini',
            stato: 'Attivo',
            immagine: 'https://source.unsplash.com/random/300x200/?chicken'
        },
        {
            id: 5,
            nome: 'Cola',
            prezzo: 2.50,
            descrizione: 'Bevanda gassata in lattina 33cl.',
            categoria: 'Bevande',
            stato: 'Attivo',
            immagine: 'https://source.unsplash.com/random/300x200/?cola'
        },
        {
            id: 6,
            nome: 'Tiramisù',
            prezzo: 4.90,
            descrizione: 'Dolce cremoso al mascarpone con caffè e cacao.',
            categoria: 'Dessert',
            stato: 'Inattivo',
            immagine: 'https://source.unsplash.com/random/300x200/?dessert'
        }
    ];

    // Recupero categorie dal database
    const categorie = ['Tutti', 'Panini', 'Pizze', 'Patatine', 'Bevande', 'Dessert'];

    res.render('menu', {
        titolo: 'Gestione Menu',
        prodotti: prodotti,
        categorie: categorie,
        user: req.user
    });
});

// API per aggiungere prodotto al menu
app.post('/menu', verificaRuoloCapo, (req, res) => {
    const nuovoProdotto = req.body;

    // Qui aggiungeresti il prodotto al database
    res.json({
        success: true,
        message: 'Prodotto aggiunto con successo',
        prodotto: nuovoProdotto
    });
});

// API per aggiornare prodotto
app.put('/menu/:id', verificaRuoloCapo, (req, res) => {
    const idProdotto = req.params.id;
    const datiProdotto = req.body;

    // Qui aggiorneresti il prodotto nel database
    res.json({
        success: true,
        message: `Prodotto ${idProdotto} aggiornato con successo`
    });
});

// API per eliminare prodotto
app.delete('/menu/:id', verificaRuoloCapo, (req, res) => {
    const idProdotto = req.params.id;

    // Qui elimineresti il prodotto dal database
    res.json({
        success: true,
        message: `Prodotto ${idProdotto} eliminato con successo`
    });
});

const messages = [];
let messageCounter = 0;
const clients = {};
const typingStatus = {};

// Identifica un utente
app.post('/api/chat/identify', (req, res) => {
    const { user_type, username, client_id } = req.body;

    clients[client_id] = {
        id: client_id,
        type: user_type,
        name: username,
        online: true,
        lastActivity: Date.now()
    };

    // Se si tratta di un cliente, notifica tutti i manager
    if (user_type === 'cliente') {
        const clientList = Object.values(clients)
            .filter(c => c.type === 'cliente')
            .map(c => ({
                id: c.id,
                name: c.name,
                online: c.online,
                lastMessage: getLastMessageForClient(c.id)
            }));

        // Aggiungi messaggio alla coda per i manager
        messages.push({
            id: ++messageCounter,
            type: 'client_list',
            clients: clientList,
            timestamp: new Date().toISOString()
        });
    }

    res.json({ success: true });
});

// Poll per nuovi messaggi
app.get('/api/chat/poll', (req, res) => {
    const { client_id, last_message_id } = req.query;
    const lastId = parseInt(last_message_id) || 0;

    // Aggiorna l'ultimo accesso del client
    if (clients[client_id]) {
        clients[client_id].lastActivity = Date.now();
    }

    // Filtra i messaggi per questo client
    const newMessages = messages
        .filter(m => m.id > lastId &&
            (m.to_user === client_id ||
                m.client_id === client_id ||
                m.type === 'client_list' && clients[client_id]?.type === 'capo'))
        .map(m => ({ ...m }));

    res.json({
        success: true,
        messages: newMessages
    });
});

// Invia un messaggio
app.post('/api/chat/send', (req, res) => {
    const { type, message, client_id, to_user, timestamp } = req.body;

    // Aggiungi il messaggio alla coda
    const newMessage = {
        id: ++messageCounter,
        type,
        message,
        sender: clients[client_id]?.type || 'unknown',
        userId: client_id,
        to_user,
        timestamp,
    };

    messages.push(newMessage);

    res.json({ success: true, message_id: newMessage.id });
});

// Route per la pagina di gestione del personale
app.get('/personale', requireLogin, (req, res) => {
    res.render('personale', {
        pageTitle: 'Gestione Personale - YourBite',
        user: req.session.user
    });
});

// Aggiungi anche una route che gestisce l'URL con la P maiuscola per retrocompatibilità
app.get('/Personale', (req, res) => {
    res.redirect('/personale');  // Reindirizza alla versione minuscola
});

// API per ottenere i dati del personale
app.get('/api/personale', requireStaff, (req, res) => {
    // In un'app reale, questi dati verrebbero dal database
    db.all('SELECT * FROM dipendenti ORDER BY cognome, nome', [], (err, rows) => {
        if (err) {
            console.error('Errore nel recupero dipendenti:', err);
            return res.status(500).json({ error: 'Errore del server nel recupero dei dipendenti.' });
        }
        res.json({ success: true, personale: rows });
    });
});

// API per ottenere un singolo dipendente
app.get('/api/personale/:id', requireStaff, (req, res) => {
    const id = req.params.id;
    db.get('SELECT * FROM dipendenti WHERE id = ?', [id], (err, row) => {
        if (err) {
            console.error('Errore nel recupero dipendente:', err);
            return res.status(500).json({ error: 'Errore del server nel recupero del dipendente.' });
        }
        if (!row) {
            return res.status(404).json({ error: 'Dipendente non trovato.' });
        }
        res.json({ success: true, dipendente: row });
    });
});

// API per aggiungere un dipendente
app.post('/api/personale', requireStaff, (req, res) => {
    const { nome, cognome, posizione, reparto, email, telefono, dataNascita, dataAssunzione } = req.body;

    // Validazione
    if (!nome || !cognome || !posizione || !reparto) {
        return res.status(400).json({ error: 'Tutti i campi obbligatori devono essere compilati.' });
    }

    const query = `
        INSERT INTO dipendenti 
        (nome, cognome, posizione, reparto, email, telefono, data_nascita, data_assunzione, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `;

    db.run(query, [nome, cognome, posizione, reparto, email, telefono, dataNascita, dataAssunzione], function (err) {
        if (err) {
            console.error('Errore durante inserimento dipendente:', err);
            return res.status(500).json({ error: 'Errore del server durante l\'inserimento del dipendente.' });
        }

        res.status(201).json({ success: true, id: this.lastID, message: 'Dipendente aggiunto con successo.' });
    });
});

// API per aggiornare un dipendente
app.put('/api/personale/:id', requireStaff, (req, res) => {
    const id = req.params.id;
    const { nome, cognome, posizione, reparto, email, telefono, dataNascita, dataAssunzione } = req.body;

    // Validazione
    if (!nome || !cognome || !posizione || !reparto) {
        return res.status(400).json({ error: 'Tutti i campi obbligatori devono essere compilati.' });
    }

    const query = `
        UPDATE dipendenti
        SET nome = ?, cognome = ?, posizione = ?, reparto = ?, email = ?, 
            telefono = ?, data_nascita = ?, data_assunzione = ?, updated_at = datetime('now')
        WHERE id = ?
    `;

    db.run(query, [nome, cognome, posizione, reparto, email, telefono, dataNascita, dataAssunzione, id], function (err) {
        if (err) {
            console.error('Errore durante aggiornamento dipendente:', err);
            return res.status(500).json({ error: 'Errore del server durante l\'aggiornamento del dipendente.' });
        }

        if (this.changes === 0) {
            return res.status(404).json({ error: 'Dipendente non trovato.' });
        }

        res.json({ success: true, message: 'Dipendente aggiornato con successo.' });
    });
});

// API per eliminare un dipendente
app.delete('/api/personale/:id', requireStaff, (req, res) => {
    const id = req.params.id;

    db.run('DELETE FROM dipendenti WHERE id = ?', [id], function (err) {
        if (err) {
            console.error('Errore durante eliminazione dipendente:', err);
            return res.status(500).json({ error: 'Errore del server durante l\'eliminazione del dipendente.' });
        }

        if (this.changes === 0) {
            return res.status(404).json({ error: 'Dipendente non trovato.' });
        }

        res.json({ success: true, message: 'Dipendente eliminato con successo.' });
    });
});

// Ottieni la cronologia della chat
app.get('/api/chat/history', (req, res) => {
    const { client_id } = req.query;

    // Filtra i messaggi di tipo chat_message rilevanti per questo client
    const chatHistory = messages.filter(m =>
        m.type === 'chat_message' &&
        (m.userId === client_id || m.to_user === client_id)
    );

    res.json({
        success: true,
        messages: chatHistory
    });
});

// Ottieni la lista dei client (solo per manager)
app.get('/api/chat/clients', (req, res) => {
    const { manager_id } = req.query;

    // Verifica che sia un manager
    if (!clients[manager_id] || clients[manager_id].type !== 'capo') {
        return res.status(403).json({
            success: false,
            error: 'Unauthorized'
        });
    }

    // Prepara la lista dei client
    const clientList = Object.values(clients)
        .filter(c => c.type === 'cliente')
        .map(c => ({
            id: c.id,
            name: c.name,
            online: c.online,
            lastMessage: getLastMessageForClient(c.id)
        }));

    res.json({
        success: true,
        clients: clientList
    });
});

// Aggiorna lo stato di digitazione
app.post('/api/chat/typing', (req, res) => {
    const { is_typing, client_id } = req.body;

    // Ottieni il tipo di utente
    const userType = clients[client_id]?.type;

    // Aggiungi il messaggio alla coda
    messages.push({
        id: ++messageCounter,
        type: 'typing',
        is_typing,
        sender: userType,
        userId: client_id,
        timestamp: new Date().toISOString()
    });

    res.json({ success: true });
});

// Funzione di utilità per ottenere l'ultimo messaggio per un cliente
function getLastMessageForClient(clientId) {
    for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (msg.type === 'chat_message' &&
            (msg.userId === clientId || msg.to_user === clientId)) {
            return {
                text: msg.message,
                timestamp: msg.timestamp
            };
        }
    }
    return null;
}

// Clean up clients periodically
setInterval(() => {
    const now = Date.now();
    Object.keys(clients).forEach(id => {
        if (now - clients[id].lastActivity > 60000) { // 1 minuto
            clients[id].online = false;
        }
        if (now - clients[id].lastActivity > 3600000) { // 1 ora
            delete clients[id];
        }
    });
}, 30000);

// ============= ROTTE GESTIONE CLIENTI =============
// Pagina Clienti
app.get('/clienti', verificaRuoloCapo, (req, res) => {
    // Recupero clienti dal database
    const clienti = [
        {
            id: 1,
            nome: 'Marco Rossi',
            email: 'marco.rossi@email.com',
            telefono: '+39 123 456 7890',
            ordini: 12,
            punti: 250,
            stato: 'Attivo',
            avatar: 'https://source.unsplash.com/random/100x100/?man'
        },
        {
            id: 2,
            nome: 'Laura Bianchi',
            email: 'laura.bianchi@email.com',
            telefono: '+39 123 456 7891',
            ordini: 8,
            punti: 180,
            stato: 'Attivo',
            avatar: 'https://source.unsplash.com/random/100x100/?woman'
        },
        {
            id: 3,
            nome: 'Giuseppe Verdi',
            email: 'giuseppe.verdi@email.com',
            telefono: '+39 123 456 7892',
            ordini: 15,
            punti: 320,
            stato: 'Attivo',
            avatar: 'https://source.unsplash.com/random/100x100/?man2'
        },
        {
            id: 4,
            nome: 'Francesca Neri',
            email: 'francesca.neri@email.com',
            telefono: '+39 123 456 7893',
            ordini: 5,
            punti: 90,
            stato: 'Attivo',
            avatar: 'https://source.unsplash.com/random/100x100/?woman2'
        },
        {
            id: 5,
            nome: 'Antonio Russo',
            email: 'antonio.russo@email.com',
            telefono: '+39 123 456 7894',
            ordini: 3,
            punti: 60,
            stato: 'Inattivo',
            avatar: 'https://source.unsplash.com/random/100x100/?man3'
        },
        {
            id: 6,
            nome: 'Elena Martini',
            email: 'elena.martini@email.com',
            telefono: '+39 123 456 7895',
            ordini: 10,
            punti: 210,
            stato: 'Attivo',
            avatar: 'https://source.unsplash.com/random/100x100/?woman3'
        }
    ];

    res.render('clienti', {
        titolo: 'Gestione Clienti',
        clienti: clienti,
        user: req.user
    });
});

// API per visualizzare dettagli cliente
app.get('/clienti/:id', verificaRuoloCapo, (req, res) => {
    const idCliente = req.params.id;

    // Qui recupereresti i dettagli del cliente dal database
    res.json({ message: `Dettagli del cliente ${idCliente}` });
});

// API per aggiornare cliente
app.put('/clienti/:id', verificaRuoloCapo, (req, res) => {
    const idCliente = req.params.id;
    const datiCliente = req.body;

    // Qui aggiorneresti i dati del cliente nel database
    res.json({
        success: true,
        message: `Cliente ${idCliente} aggiornato con successo`
    });
});

// API per esportare dati clienti
app.get('/clienti/export/data', verificaRuoloCapo, (req, res) => {
    // Qui genereresti un file CSV/Excel con i dati dei clienti

    // Esempio: invia un file fittizio
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=clienti.csv');
    res.send('ID,Nome,Email,Telefono,Ordini,Punti,Stato\n1,Marco Rossi,marco.rossi@email.com,+39 123 456 7890,12,250,Attivo');
});

// ============= ROTTE IMPOSTAZIONI =============
// Pagina Impostazioni
app.get('/impostazioni', verificaRuoloCapo, (req, res) => {
    // Recupero impostazioni dal database
    const impostazioni = {
        locale: {
            nome: 'Fast Food da Mario',
            indirizzo: 'Via Roma 123, Milano',
            telefono: '+39 02 1234567',
            email: 'info@fastfoodmario.it',
            descrizione: 'Fast Food da Mario offre una vasta selezione di panini, pizze, patatine fritte e bevande. Serviamo cibo di qualità dal 2010.',
            logo: '/images/logo.png'
        },
        visualizzazione: {
            mostraPrezziIVA: true,
            mostraIngredienti: true,
            mostraValoriNutrizionali: false,
            mostraAllergeni: true
        }
    };

    res.render('impostazioni', {
        titolo: 'Impostazioni',
        impostazioni: impostazioni,
        user: req.user
    });
});

// API per aggiornare impostazioni
app.post('/impostazioni', verificaRuoloCapo, (req, res) => {
    const nuoveImpostazioni = req.body;

    // Qui aggiorneresti le impostazioni nel database
    res.json({
        success: true,
        message: 'Impostazioni aggiornate con successo'
    });
});

// API per caricare nuovo logo
app.post('/impostazioni/logo', verificaRuoloCapo, (req, res) => {
    // Qui gestiresti il caricamento del file e lo salveresti

    // Nota: questa route richiede un middleware per la gestione dei file
    // come multer, che dovresti aggiungere al tuo server.js

    res.json({
        success: true,
        message: 'Logo caricato con successo',
        path: '/images/logo-nuovo.png' // Percorso del nuovo logo
    });
});

// ============= ALTRE ROTTE UTILI =============
// Rotta per ricevere notifiche in tempo reale (se usi websockets)
app.get('/notifiche', verificaRuoloCapo, (req, res) => {
    const notifiche = [
        { id: 1, messaggio: 'Nuovo ordine ricevuto', tempo: '2 minuti fa', letto: false },
        { id: 2, messaggio: 'Scorte di patatine in esaurimento', tempo: '1 ora fa', letto: true },
        { id: 3, messaggio: 'Nuovo cliente registrato', tempo: '3 ore fa', letto: true }
    ];

    res.json(notifiche);
});

// Rotta per statistiche in tempo reale (per dashboard)
app.get('/statistiche', verificaRuoloCapo, (req, res) => {
    // Qui recupereresti dati in tempo reale dal database
    const statistiche = {
        venditeOggi: 1895,
        confrontoIeri: '+12%',
        ordiniOggi: 247,
        clientiNuovi: 18,
        prodottiPiuVenduti: [
            { nome: 'Burger Classic', quantita: 78 },
            { nome: 'Patatine Fritte', quantita: 65 },
            { nome: 'Cola', quantita: 54 }
        ]
    };

    res.json(statistiche);
});
app.get('/auth/google/callback',
    passport.authenticate('google', {
        failureRedirect: '/login'
    }),
    (req, res) => {
        // Determine redirect URL based on user type
        let redirectUrl = '/homepage_cliente';
        if (req.user && req.user.tipo) {
            switch (req.user.tipo) {
                case 'amministratore':
                    redirectUrl = '/homepage_admin';
                    break;
                case 'capo':
                    redirectUrl = '/homepage_capo';
                    break;
                default:
                    redirectUrl = '/homepage_cliente';
            }
        }

        // Create or update session
        req.session.user = {
            id: req.user.id,
            username: req.user.username,
            email: req.user.email,
            tipo: req.user.tipo
        };

        res.redirect(redirectUrl);
    }
);


// Creazione della tabella utenti, se non esiste
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS utenti (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        tipo TEXT NOT NULL DEFAULT 'cliente'
    )`, (err) => {
        if (err) {
            console.error('Errore durante la creazione della tabella:', err.message);
        } else {
            console.log('Tabella utenti creata o già esistente.');
        }
    });

    // Creazione della tabella per i messaggi di chat
    db.run(`CREATE TABLE IF NOT EXISTS chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_id TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        sender_name TEXT NOT NULL,
        message TEXT NOT NULL,
        timestamp TEXT NOT NULL
    )`, (err) => {
        if (err) {
            console.error('Errore durante la creazione della tabella chat_messages:', err.message);
        } else {
            console.log('Tabella chat_messages creata o già esistente.');
        }
    });

    // Creazione della tabella per i panini se non esiste
    db.run(`CREATE TABLE IF NOT EXISTS panini (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        descrizione TEXT,
        prezzo REAL NOT NULL,
        categoria TEXT NOT NULL,
        immagine_url TEXT,
        ingredienti TEXT,
        disponibile INTEGER DEFAULT 1
    )`, (err) => {
        if (err) {
            console.error('Errore durante la creazione della tabella panini:', err.message);
        } else {
            console.log('Tabella panini creata o già esistente.');
        }
    });

    // Inserimento utenti di esempio con password criptate
    const hashedPasswordAdmin = bcrypt.hashSync('amministratore', 10);
    const hashedPasswordCapo = bcrypt.hashSync('capo', 10);
    const hashedPasswordCliente = bcrypt.hashSync('cliente', 10);

    // Inserimento dati nel database, se non esistono già
    db.run(`INSERT OR IGNORE INTO utenti (username, email, password, tipo) VALUES (?, ?, ?, ?)`,
        ['admin', 'admin@example.com', hashedPasswordAdmin, 'amministratore']);
    db.run(`INSERT OR IGNORE INTO utenti (username, email, password, tipo) VALUES (?, ?, ?, ?)`,
        ['capo', 'capo@example.com', hashedPasswordCapo, 'capo']);
    db.run(`INSERT OR IGNORE INTO utenti (username, email, password, tipo) VALUES (?, ?, ?, ?)`,
        ['cliente', 'cliente@example.com', hashedPasswordCliente, 'cliente']);
});

// Configurazione WebSocket
io.on('connection', (socket) => {
    console.log('Nuovo utente connesso:', socket.id);

    // Gestione dell'ingresso dell'utente nella chat
    socket.on('userJoin', (userData) => {
        console.log('Utente entrato:', userData);
        // Crea un ID stanza basato sull'ID utente
        const roomId = `support_${userData.userId}`;
        socket.join(roomId);

        // Memorizza l'ID dell'utente e la stanza nel socket per uso futuro
        socket.userData = userData;
        socket.currentRoom = roomId;

        console.log(`Utente ${userData.username} entrato nella stanza: ${roomId}`);

        // Notifica operatori che un utente è entrato in chat
        io.to('support_staff').emit('new_support_request', {
            roomId,
            user: userData
        });
    });

    // Gestione per lo staff di assistenza
    socket.on('operatorJoin', (operatorData) => {
        console.log('Operatore entrato:', operatorData);
        socket.join('support_staff');

        // Se specificato un roomId, entra anche in quella stanza
        if (operatorData.roomId) {
            socket.join(operatorData.roomId);
            socket.currentRoom = operatorData.roomId;

            // Notifica gli utenti nella stanza che l'operatore è entrato
            io.to(operatorData.roomId).emit('operatorJoin', {
                username: operatorData.username,
                userId: operatorData.userId
            });
        }
    });

    // Gestione invio messaggi
    socket.on('message', (message) => {
        console.log('Messaggio ricevuto:', message);

        // Se il messaggio non specifica un roomId, usa la stanza corrente dell'utente
        const roomId = message.roomId || socket.currentRoom;

        if (!roomId) {
            console.error('Nessun roomId disponibile per inviare il messaggio');
            return;
        }

        // Broadcast del messaggio a tutti nella stanza (incluso mittente per conferma)
        io.to(roomId).emit('message', message);

        // Salva il messaggio nel database
        saveMessageToDatabase({
            roomId,
            senderId: message.sender,
            sender: message.senderName,
            text: message.content,
            timestamp: message.timestamp
        });
    });

    // Gestione indicatore di digitazione
    socket.on('typing', (data) => {
        // Se data non contiene un roomId, usa la stanza corrente
        const roomId = data.roomId || socket.currentRoom;
        if (roomId) {
            // Invia l'indicatore di digitazione a tutti tranne il mittente
            socket.to(roomId).emit('typing', data);
        }
    });

    // Gestione disconnessione
    socket.on('disconnect', () => {
        console.log('Utente disconnesso:', socket.id);
        // Se l'utente era in una stanza e aveva dati utente, notifica gli altri
        if (socket.currentRoom && socket.userData) {
            socket.to(socket.currentRoom).emit('userLeave', {
                username: socket.userData.username,
                userId: socket.userData.userId
            });
        }
    });
});

// Funzione per salvare i messaggi nel database
function saveMessageToDatabase(message) {
    const stmt = db.prepare(`
        INSERT INTO chat_messages (room_id, sender_id, sender_name, message, timestamp)
        VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(
        message.roomId,
        message.senderId,
        message.sender,
        message.text,
        message.timestamp
    );
    stmt.finalize();
    console.log('Messaggio salvato nel database:', message);
}

// Swagger - Impostazione della documentazione API
app.use('/swagger', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use((req, res, next) => {
    // Log per debug durante lo sviluppo
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    console.log('Session ID:', req.sessionID);
    console.log('Session User:', req.session && req.session.user ? `${req.session.user.username} (${req.session.user.tipo})` : 'nessuno');
    console.log('Passport User:', req.user ? `${req.user.username} (${req.user.tipo})` : 'nessuno');
    console.log('---');
    next();
});
// Aggiungi questa rotta per debugging
app.get('/auth-status', (req, res) => {
    console.log("Auth status check - Session user:", req.session?.user);
    console.log("Auth status check - Passport user:", req.user);
    
    // Sincronizza i dati utente tra passport e session se necessario
    if (req.user && (!req.session.user || req.session.user.tipo !== req.user.tipo)) {
        console.log("Sincronizzazione utente da passport a session");
        req.session.user = {
            id: req.user.id,
            username: req.user.username,
            email: req.user.email,
            tipo: req.user.tipo
        };
    }
    
    res.json({
        isAuthenticated: req.isAuthenticated ? req.isAuthenticated() : (req.session && req.session.user ? true : false),
        sessionUser: req.session.user || null,
        passportUser: req.user || null
    });
});


// Route per la homepage
app.get('/', (req, res) => {
    // 5. Usa res.render per processare il template 'index.hbs'
    // Passa un oggetto con i dati da inserire nel template
    res.render('index', { pageTitle: 'Benvenuto - La Mia App' }); // 'index' si riferisce a views/index.hbs
});

// Middleware per sincronizzare user tra passport e session
app.use((req, res, next) => {
    // Sincronizza passport.user con session.user
    if (req.isAuthenticated() && req.user && (!req.session.user || req.user.id !== req.session.user.id)) {
        console.log("Sincronizzazione automatica utente:", req.user.username);
        req.session.user = {
            id: req.user.id,
            username: req.user.username,
            email: req.user.email,
            tipo: req.user.tipo
        };
    }
    next();
});

// Route per la pagina di chat assistenza
app.get('/chat', requireLogin, (req, res) => {
    res.render('chat', { 
        pageTitle: 'Chat Assistenza', 
        user: req.session.user,
        userJson: JSON.stringify(req.session.user || {}) // Aggiungi questo!
    });
});


// Route per la pagina admin della chat
app.get('/admin-chat', requireLogin, (req, res) => { // Cambiato percorso
    if (req.session.user && (req.session.user.tipo === 'amministratore' || req.session.user.tipo === 'capo')) {

        res.render('admin-chat', { pageTitle: 'Admin Chat', user: req.session.user });

    } else {
        res.redirect('/');
    }
});

app.get('/api/user/info', (req, res) => {
    if (req.session && req.session.user) {
        res.json({
            success: true,
            user: {
                id: req.session.user.id,
                username: req.session.user.username,
                tipo: req.session.user.tipo
            }
        });
    } else {
        res.json({
            success: false,
            message: 'Utente non autenticato'
        });
    }
});

// Endpoint per ottenere la cronologia dei messaggi
app.get('/api/chat/history/:roomId', requireLogin, (req, res) => {
    const roomId = req.params.roomId;
    db.all('SELECT * FROM chat_messages WHERE room_id = ? ORDER BY timestamp ASC', [roomId], (err, rows) => {
        if (err) {
            console.error('Errore durante il recupero dei messaggi:', err);
            return res.status(500).json({ error: 'Errore del server.' });
        }
        res.json(rows);
    });

});


// Reindirizza da homepage_capo alla dashboard
app.get('/homepage_capo', verificaRuoloCapo, (req, res) => {
    console.log("Rendering homepage_capo per:", req.session.user);
    res.render('homepage_capo', {
        pageTitle: 'Homepage Capo',
        user: req.session.user,
        userJson: JSON.stringify(req.session.user || {})
    });
});

// Middleware per upload file (aggiungi multer)
const multer = require('multer');
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/images/uploads/')
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        cb(null, uniqueSuffix + '-' + file.originalname)
    }
});
const upload = multer({ storage: storage });

// Rotta per upload immagini prodotti
app.post('/upload-image', verificaRuoloCapo, upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'Nessun file caricato' });
    }

    const imagePath = '/images/uploads/' + req.file.filename;
    res.json({
        success: true,
        message: 'Immagine caricata con successo',
        path: imagePath
    });
});
// Delete all messages in a chat room
app.delete('/api/chat/messages/:roomId', requireStaff, (req, res) => {
    const roomId = req.params.roomId;

    // Validate the room ID format (should be like 'support_123')
    if (!roomId || !roomId.startsWith('support_')) {
        return res.status(400).json({
            success: false,
            error: 'ID stanza non valido'
        });
    }

    // Delete all messages for this room from the database
    db.run('DELETE FROM chat_messages WHERE room_id = ?', [roomId], function (err) {
        if (err) {
            console.error('Error deleting messages:', err);
            return res.status(500).json({
                success: false,
                error: 'Errore durante l\'eliminazione dei messaggi dal database'
            });
        }

        // Check if any rows were affected
        if (this.changes === 0) {
            // No messages were deleted (maybe they were already deleted)
            return res.json({
                success: true,
                deleted: 0,
                message: 'Nessun messaggio trovato da eliminare'
            });
        }

        // Add a system message to record the deletion event
        const systemMessage = {
            room_id: roomId,
            sender_id: 'system',
            sender_name: 'Sistema',
            message: `Un operatore ha eliminato ${this.changes} messaggi da questa chat.`,
            timestamp: new Date().toISOString()
        };

        db.run(
            'INSERT INTO chat_messages (room_id, sender_id, sender_name, message, timestamp) VALUES (?, ?, ?, ?, ?)',
            [systemMessage.room_id, systemMessage.sender_id, systemMessage.sender_name, systemMessage.message, systemMessage.timestamp],
            function (err) {
                if (err) {
                    console.error('Error adding system message:', err);
                    // Still return success for the deletion
                }

                // Log this action for audit purposes
                console.log(`[${new Date().toISOString()}] Operator ${req.session.user.username} (ID: ${req.session.user.id}) deleted ${this.changes} messages from room ${roomId}`);

                res.json({
                    success: true,
                    deleted: this.changes,
                    message: `${this.changes} messaggi eliminati con successo`
                });
            }
        );
    });
});
// Delete all conversations and related messages
app.delete('/api/chat/all-conversations', requireStaff, (req, res) => {
    // Start a transaction to ensure data consistency
    db.serialize(() => {
        // Begin transaction
        db.run('BEGIN TRANSACTION');

        // First, get count of distinct room_ids for reporting
        db.get('SELECT COUNT(DISTINCT room_id) as count FROM chat_messages', [], (err, result) => {
            if (err) {
                console.error('Error counting conversations:', err);
                db.run('ROLLBACK');
                return res.status(500).json({
                    success: false,
                    error: 'Errore durante il conteggio delle conversazioni'
                });
            }

            const conversationCount = result ? result.count : 0;

            // Delete all chat messages
            db.run('DELETE FROM chat_messages', function (err) {
                if (err) {
                    console.error('Error deleting all chat messages:', err);
                    db.run('ROLLBACK');
                    return res.status(500).json({
                        success: false,
                        error: 'Errore durante l\'eliminazione dei messaggi'
                    });
                }

                // Create a system log entry
                const logMessage = `Operatore ${req.session.user.username} (ID: ${req.session.user.id}) ha eliminato tutte le conversazioni (${conversationCount} in totale).`;

                // Log this action for audit purposes
                console.log(`[${new Date().toISOString()}] ${logMessage}`);

                // You could optionally save this action to a separate admin_logs table

                // Commit transaction
                db.run('COMMIT', function (err) {
                    if (err) {
                        console.error('Error committing transaction:', err);
                        db.run('ROLLBACK');
                        return res.status(500).json({
                            success: false,
                            error: 'Errore durante il commit della transazione'
                        });
                    }

                    // Return success response
                    res.json({
                        success: true,
                        deleted: conversationCount,
                        message: `${conversationCount} conversazioni eliminate con successo`
                    });
                });
            });
        });
    });
});

// Add this near your other API endpoints
app.get('/api/chat/rooms', requireStaff, (req, res) => {
    // Get list of unique chat rooms from the database
    const query = `
        SELECT DISTINCT room_id, 
               (SELECT sender_name FROM chat_messages WHERE room_id = cm.room_id AND sender_id = SUBSTR(room_id, 9) LIMIT 1) as sender_name,
               SUBSTR(room_id, 9) as user_id,
               (SELECT message FROM chat_messages WHERE room_id = cm.room_id ORDER BY timestamp DESC LIMIT 1) as last_message
        FROM chat_messages cm
        ORDER BY (SELECT MAX(timestamp) FROM chat_messages WHERE room_id = cm.room_id) DESC
    `;

    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Error querying chat rooms:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        res.json({ rooms: rows });
    });
});

app.post('/delete-user-data', (req, res) => {
    const userId = req.body.user_id;
    deleteUserData(userId)
        .then(() => res.status(200).json({ message: 'Dati utente eliminati con successo.' }))
        .catch((err) => res.status(500).json({ error: 'Errore durante eliminazione dei dati.' }));
});

async function deleteUserData(userId) {
    return new Promise((resolve, reject) => {
        console.warn(`Funzione deleteUserData chiamata per userId: ${userId}, ma non implementata.`);
        // Simula l'eliminazione
        // db.run('DELETE FROM ... WHERE user_id = ?', [userId], (err) => { ... });
        resolve();
    });
}


function requireLogin(req, res, next) {
    // Controlla se esiste una sessione utente
    if (req.session && req.session.user) {
        // L'utente è autenticato, prosegui
        return next();
    } else if (req.isAuthenticated && typeof req.isAuthenticated === 'function' && req.isAuthenticated()) {
        // Utente autenticato con Passport
        return next();
    } else {
        // L'utente non è autenticato, reindirizza alla pagina di login
        console.log('Utente non autenticato, reindirizzamento a /login');
        return res.redirect('/login'); // Senza estensione .hbs
    }
}


function requireAdmin(req, res, next) {
    if (req.session && req.session.user && req.session.user.tipo === 'amministratore') {
        return next();
    } else {
        // L'utente non ha i permessi necessari
        return res.status(403).render('error', {
            message: 'Accesso negato. Devi essere un amministratore per visualizzare questa pagina.'
        });
    }
}

function requireStaff(req, res, next) {
    if (req.session && req.session.user &&
        (req.session.user.tipo === 'amministratore' || req.session.user.tipo === 'capo')) {
        return next();
    } else {
        // Usa JSON invece di render per evitare problemi con la vista mancante
        return res.status(403).json({
            error: 'Accesso negato. Non hai i permessi necessari.'
        });
    }
}


// Pagina di Signup
app.get('/signup', (req, res) => {
    res.render('signup', { pageTitle: 'YourBite - Registrati' }); // Passiamo il titolo della pagina
});

// Pagina di Login
app.get('/login', (req, res) => {
    // Renderizza il template views/login.hbs
    res.render('login', { pageTitle: 'YourBite - Login' }); // Passiamo il titolo
});

// Example for rendering homepage_cliente
app.get('/homepage_cliente', requireLogin, (req, res) => {
    res.render('homepage_cliente', {
        pageTitle: 'Homepage Cliente',
        user: req.session.user,
        username: req.session.user.username  // Make sure username is explicitly passed
    });
});
app.get('/homepage_admin', requireLogin, (req, res) => {
    res.render('homepage_admin', { pageTitle: 'Homepage Admin', user: req.session.user });

});

// Route per il login
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    // Controlla che email e password siano forniti
    if (!email || !password) {
        return res.status(400).json({ error: 'Email e password sono richiesti.' });
    }

    // Cerca l'utente nel database
    db.get('SELECT * FROM utenti WHERE email = ?', [email], (err, row) => {
        if (err) {
            return res.status(500).json({ error: 'Errore del server.' });
        }

        if (!row) {
            return res.status(400).json({ error: 'Email o password non validi.' });
        }

        // Confronta la password con quella criptata nel database
        bcrypt.compare(password.trim(), row.password, (err, result) => {
            if (err) {
                return res.status(500).json({ error: 'Errore durante il login.' });
            }

            if (!result) {
                return res.status(400).json({ error: 'Email o password non validi.' });
            }

            // Salva i dati dell'utente nella sessione
            req.session.user = {
                id: row.id,
                username: row.username,
                email: row.email,
                tipo: row.tipo
            };

            // Determina la URL di reindirizzamento in base al tipo utente
            let redirectUrl = '';
            switch (row.tipo) {
                case 'cliente':
                    redirectUrl = '/homepage_cliente'; // Nuovo percorso per HBS
                    break;
                case 'amministratore':
                    redirectUrl = '/homepage_admin'; // Nuovo percorso per HBS
                    break;
                case 'capo':
                    redirectUrl = '/homepage_capo'; // Nuovo percorso per HBS
                    break;
                default:
                    redirectUrl = '/login'; // Nuovo percorso per HBS
                    break;
            }

            // Se non viene trovata una URL di reindirizzamento, restituisci un errore
            if (!redirectUrl) {
                return res.status(400).json({ error: 'Tipo utente non valido, impossibile determinare la homepage.' });
            }

            // Risposta con il reindirizzamento e il nome utente
            res.json({
                success: true,
                redirectUrl,
                username: row.username,
                tipo: row.tipo  // Assicurati che questa proprietà sia inclusa
            });
        });
    });
});
app.post('/signup', async (req, res) => {
    try {
        console.log('Richiesta di registrazione ricevuta');

        const { username, email, password, tipo } = req.body;
        console.log('Dati ricevuti:', { username, email, tipo, password: '***hidden***' });

        // Verifica che tutti i campi siano presenti
        if (!username || !email || !password || !tipo) {
            return res.status(400).json({ error: 'Tutti i campi sono obbligatori.' });
        }

        // Validazione dell'email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Formato email non valido.' });
        }

        // Validazione della password
        const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*?&]{8,}$/;
        if (!passwordRegex.test(password)) {
            return res.status(400).json({ error: 'La password deve essere lunga almeno 8 caratteri e contenere almeno una lettera e un numero.' });
        }

        // Verifica che il tipo utente sia valido
        const validTypes = ['cliente', 'amministratore', 'capo'];
        if (!validTypes.includes(tipo)) {
            return res.status(400).json({ error: 'Tipo utente non valido.' });
        }

        // Verifica se l'email è già in uso
        db.get('SELECT * FROM utenti WHERE email = ?', [email], (err, row) => {
            if (err) {
                console.error('Errore database durante la verifica email:', err.message);
                return res.status(500).json({ error: 'Errore del server durante la verifica dell\'email.' });
            }

            if (row) {
                return res.status(400).json({ error: 'Questa email è già in uso.' });
            }

            // Verifica se l'username è già in uso
            db.get('SELECT * FROM utenti WHERE username = ?', [username], (err, row) => {
                if (err) {
                    console.error('Errore database durante la verifica username:', err.message);
                    return res.status(500).json({ error: 'Errore del server durante la verifica dell\'username.' });
                }

                if (row) {
                    return res.status(400).json({ error: 'Questo username è già in uso.' });
                }

                // Cripta la password
                const hashedPassword = bcrypt.hashSync(password, 10);

                db.run(
                    `INSERT INTO utenti (username, email, password, tipo, created_at) 
                     VALUES (?, ?, ?, ?, datetime('now'))`,
                    [username, email, hashedPassword, tipo],
                    function (err) {
                        if (err) {
                            console.error('Errore durante l\'inserimento del nuovo utente:', err.message);
                            return res.status(500).json({ error: 'Errore durante la registrazione.' });
                        }

                        console.log(`Nuovo utente registrato: ${username} (ID: ${this.lastID}, Tipo: ${tipo})`);

                        // Definisci una URL di redirect in base al tipo utente
                        const redirectMap = {
                            'cliente': '/homepage_cliente',
                            'amministratore': '/homepage_admin',
                            'capo': '/homepage_capo'
                        };

                        const redirectUrl = redirectMap[tipo] || '/login';

                        res.json({
                            success: true,
                            message: 'Registrazione avvenuta con successo.',
                            userId: this.lastID,
                            redirectUrl
                        });
                    }
                );
            });
        });
    } catch (error) {
        console.error('Errore inaspettato durante la registrazione:', error);
        res.status(500).json({ error: 'Si è verificato un errore inaspettato. Riprova più tardi.' });
    }
});


// Funzione per verificare se un'URL di immagine è valida
function isImageUrlValid(url) {
    if (!url) return false;

    // Controlla se l'URL è relativa o assoluta e ben formattata
    return (
        url.startsWith('http') ||
        url.startsWith('/') ||
        url.startsWith('./') ||
        url.startsWith('../')
    ) && (
            url.endsWith('.jpg') ||
            url.endsWith('.jpeg') ||
            url.endsWith('.png') ||
            url.endsWith('.webp') ||
            url.endsWith('.gif') ||
            url.includes('unsplash.com') ||
            url.includes('placeholder.com')
        );
}

// Endpoint per inizializzare il database con tutti i 50 prodotti
app.get('/api/initialize-database', requireStaff, async (req, res) => {
    try {
        // Verifica se il database è già inizializzato
        db.get('SELECT COUNT(*) as count FROM panini', [], (err, row) => {
            if (err) {
                console.error('Errore nel conteggio prodotti:', err);
                return res.status(500).json({ error: 'Errore database' });
            }

            // Se ci sono già prodotti, chiedi conferma per sovrascrivere
            if (row.count > 0) {
                if (!req.query.confirm || req.query.confirm !== 'true') {
                    return res.json({
                        success: false,
                        message: `Il database contiene già ${row.count} prodotti. Aggiungere 'confirm=true' alla query per confermare la reinizializzazione.`
                    });
                }

                // Con confirm=true, procedi alla reinizializzazione
                console.log('Pulizia database richiesta, eliminazione prodotti esistenti...');
                db.run('DELETE FROM panini', function (err) {
                    if (err) {
                        console.error('Errore nella pulizia del database:', err);
                        return res.status(500).json({ error: 'Errore nella pulizia del database' });
                    }

                    // Dopo la pulizia, inserisci i nuovi prodotti
                    insertAllProducts(res);
                });
            } else {
                // Se il database è vuoto, procedi direttamente all'inserimento
                insertAllProducts(res);
            }
        });
    } catch (error) {
        console.error('Errore nell\'inizializzazione del database:', error);
        res.status(500).json({ error: 'Errore interno del server' });
    }
});


// --- API Prodotti con utilizzo tabella panini ---
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
                console.log("API /api/products: Utilizzo dati di esempio statici.");
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

                console.log(`Restituendo ${formattedRows.length} prodotti dal database`);
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

// Funzione per analizzare ingredienti (se sono memorizzati come stringa nel DB)
function parseIngredients(ingredientsStr) {
    if (!ingredientsStr) return [];

    // Se ingredienti è già in formato JSON (stringa array), parsalo
    if (typeof ingredientsStr === 'string') {
        try {
            if (ingredientsStr.startsWith('[') && ingredientsStr.endsWith(']')) {
                return JSON.parse(ingredientsStr);
            }
            // Altrimenti, dividi la stringa per virgole o altro separatore
            return ingredientsStr.split(',').map(item => item.trim());
        } catch (e) {
            console.warn("Errore nel parsing ingredienti:", e);
            return ingredientsStr.split(',').map(item => item.trim());
        }
    }

    // Se ingredientsStr è già un array
    if (Array.isArray(ingredientsStr)) {
        return ingredientsStr;
    }

    // Fallback
    return [];
}

// Funzione per generare 50 prodotti di default
function getDefaultProducts() {
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

// Endpoint per popolare il database con i prodotti predefiniti
app.get('/api/populate-products', requireStaff, (req, res) => {
    const products = getDefaultProducts();

    // Prepara la query INSERT
    const stmt = db.prepare(`
        INSERT OR IGNORE INTO panini 
        (nome, descrizione, prezzo, categoria, immagine_url, ingredienti, disponibile) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    // Contatore prodotti aggiunti
    let addedCount = 0;

    // Inserisci ogni prodotto
    products.forEach(product => {
        stmt.run(
            product.name,
            product.description,
            product.price,
            product.category,
            product.image,
            JSON.stringify(product.ingredients),
            product.available ? 1 : 0,
            function (err) {
                if (!err && this.changes > 0) {
                    addedCount++;
                }
            }
        );
    });

    // Finalizza l'inserimento
    stmt.finalize(err => {
        if (err) {
            console.error("Errore nell'inserimento dei prodotti:", err);
            return res.status(500).json({ error: "Errore durante l'inserimento dei prodotti" });
        }

        res.json({
            success: true,
            message: `${addedCount} prodotti inseriti nel database con successo.`
        });
    });
});

// Endpoint per ottenere le categorie disponibili
app.get('/api/categories', (req, res) => {
    try {
        db.all("SELECT DISTINCT categoria FROM panini ORDER BY categoria", [], (err, rows) => {
            if (err) {
                console.error("Errore nel recupero categorie:", err);
                // Fallback
                const defaultCategories = ["hamburger", "pollo", "pizza", "vegetariano", "contorni", "bevande", "dessert", "speciali"];
                return res.json(defaultCategories);
            }

            if (rows && rows.length > 0) {
                const categories = rows.map(row => row.categoria);
                res.json(categories);
            } else {
                // Se non ci sono categorie nel DB, restituisci le categorie predefinite
                const defaultCategories = ["hamburger", "pollo", "pizza", "vegetariano", "contorni", "bevande", "dessert", "speciali"];
                res.json(defaultCategories);
            }
        });
    } catch (error) {
        console.error("Errore critico in API categories:", error);
        res.status(500).json({ error: "Errore interno del server" });
    }
});

// Funzione helper per inserire tutti i prodotti
// Funzione helper per inserire tutti i prodotti
function insertAllProducts(res) {
    const products = getDefaultProducts();
    let inserted = 0;
    let errors = 0;

    // Inizia la transazione
    db.run('BEGIN TRANSACTION');

    const stmt = db.prepare(`
        INSERT INTO panini (nome, descrizione, prezzo, categoria, immagine_url, ingredienti, disponibile)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    // Inserisci ogni prodotto
    products.forEach(product => {
        stmt.run(
            product.name,
            product.description,
            product.price,
            product.category,
            product.image,
            JSON.stringify(product.ingredients),
            product.available ? 1 : 0,
            function (err) {
                if (err) {
                    console.error(`Errore inserimento prodotto ${product.id}:`, err);
                    errors++;
                } else {
                    inserted++;
                }
            }
        );
    });

    // Finalizza gli inserimenti
    stmt.finalize();

    // Commit della transazione
    db.run('COMMIT', function (err) {
        if (err) {
            console.error('Errore commit transazione:', err);
            db.run('ROLLBACK');
            return res.status(500).json({ error: 'Errore durante il commit della transazione' });
        }

        res.json({
            success: true,
            message: `Database inizializzato con successo. Inseriti ${inserted} prodotti.`,
            errors: errors
        });
    });
} // <-- Parentesi graffa mancante per chiudere la funzione insertAllProducts

// Endpoint di logout (metodo POST)
app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ error: 'Errore durante il logout.' });
        }
        res.clearCookie('connect.sid'); // Pulisci il cookie di sessione
        res.json({ success: true, message: 'Logout effettuato con successo.' });
    });
});

// Chiudi il database quando il server viene arrestato
process.on('SIGINT', () => {
    db.close(err => {
        if (err) {
            console.error('Errore durante la chiusura del database:', err);
        } else {
            console.log('Database chiuso con successo.');
        }
        process.exit(0);
    });
});


// Endpoint di logout (metodo POST)
app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ error: 'Errore durante il logout.' });
        }
        res.clearCookie('connect.sid'); // Pulisci il cookie di sessione
        res.json({ success: true, message: 'Logout effettuato con successo.' });
    });
});

// Avvia il server sulla porta 3000 (usa il server HTTP invece di app.listen)
server.listen(port, () => {
    console.log(`Server in esecuzione su http://localhost:${port}`);
});
