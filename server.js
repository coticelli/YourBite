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
    res.json({
        isAuthenticated: req.isAuthenticated ? req.isAuthenticated() : false,
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

// Route per la pagina di chat assistenza
app.get('/chat', requireLogin, (req, res) => {
    res.render('chat', { pageTitle: 'Chat Assistenza', user: req.session.user });
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
app.get('/homepage_capo', requireLogin, (req, res) => {
    // Renderizza la pagina homepage_capo o reindirizza alla dashboard
    // Opzione 1: Renderizza homepage_capo
    res.render('homepage_capo', {
        pageTitle: 'Homepage Capo',
        user: req.session.user
    });

    // Opzione 2: Reindirizza alla dashboard (scegli una delle due opzioni)
    // res.redirect('/dashboard');
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
        return res.status(403).render('error', {
            message: 'Accesso negato. Non hai i permessi necessari per visualizzare questa pagina.'
        });
    }
}


// Pagina di Signup
app.get('/signup', (req, res) => {
    // Renderizza il template views/signup.hbs
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
app.get('/homepage_capo', requireLogin, (req, res) => {
    res.render('homepage_capo', { pageTitle: 'Homepage Capo', user: req.session.user });
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

// Route per la registrazione
app.post('/signup', (req, res) => {
    console.log('Dati ricevuti:', req.body); // Log per il debug
    const { username, email, password, tipo } = req.body;

    // Verifica che tutti i campi siano presenti
    if (!username || !email || !password || !tipo) {
        return res.status(400).json({ error: 'Tutti i campi sono obbligatori.' });
    }

    // Validazione della password (minimo 8 caratteri, almeno una lettera e un numero)
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(password)) {
        return res.status(400).json({ error: 'La password deve essere lunga almeno 8 caratteri e contenere almeno una lettera e un numero.' });
    }

    // Verifica che il tipo utente sia valido
    const validTypes = ['cliente', 'amministratore', 'capo'];
    if (!validTypes.includes(tipo)) {
        return res.status(400).json({ error: 'Tipo utente non valido.' });
    }

    // Cripta la password
    const hashedPassword = bcrypt.hashSync(password, 10);

    // Verifica se l'email è già in uso
    db.get('SELECT * FROM utenti WHERE email = ?', [email], (err, row) => {
        if (err) {
            console.error('Errore durante la verifica dell\'email:', err.message);
            return res.status(500).json({ error: 'Errore del server.' });
        }

        if (row) {
            return res.status(400).json({ error: 'Questa email è già in uso.' });
        }

        // Inserisce il nuovo utente nel database
        db.run(`INSERT INTO utenti (username, email, password, tipo) VALUES (?, ?, ?, ?)`,
            [username, email, hashedPassword, tipo], function (err) {
                if (err) {
                    console.error('Errore durante l\'inserimento del nuovo utente:', err.message);
                    return res.status(500).json({ error: 'Errore durante la registrazione.' });
                }

                console.log(`Nuovo utente registrato: ${username}`);
                // Definisci una URL di redirect in base al tipo utente
                let redirectUrl = '';
                switch (tipo) {
                    case 'cliente':
                        redirectUrl = '/homepage_cliente'; // Nuovo
                        break;
                    case 'amministratore':
                        redirectUrl = '/homepage_admin'; // Nuovo
                        break;
                    case 'capo':
                        redirectUrl = '/homepage_capo'; // Nuovo
                        break;
                    default:
                        redirectUrl = '/login'; // Nuovo
                        break;
                }
                res.json({ success: true, message: 'Registrazione avvenuta con successo.', redirectUrl });
            });
    });
});

app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Errore durante il logout:', err);
            return res.status(500).send('Errore durante il logout');
        }
        res.redirect('/');
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

// Funzione per recuperare i panini da API esterna
async function fetchPaniniFromExternalAPI() {
    try {
        // Utilizzo di TheMealDB API come esempio - API gratuita per ricette
        // Questa API restituisce pasti che possiamo "trasformare" in panini
        const response = await axios.get('https://www.themealdb.com/api/json/v1/1/filter.php?c=Beef');

        // Trasformiamo i dati nel formato che ci serve per i panini
        const meals = response.data.meals || [];
        return meals.map(meal => ({
            id: meal.idMeal,
            nome: meal.strMeal.includes('burger') ? meal.strMeal : `${meal.strMeal} Burger`,
            descrizione: `Delizioso panino con ${meal.strMeal}`,
            prezzo: (Math.random() * 5 + 5).toFixed(2), // Prezzo casuale tra 5 e 10
            categoria: determineCategory(meal.strMeal),
            ingredienti: `Carne, ${meal.strMeal.toLowerCase()}, lattuga, pomodoro, cipolla, salsa speciale`,
            disponibile: true,
            immagine: meal.strMealThumb
        }));
    } catch (error) {
        console.error('Errore nel recupero dei panini dall\'API esterna:', error);
        return [];
    }
}

// Funzione di supporto per determinare la categoria del panino
function determineCategory(mealName) {
    const lowerName = mealName.toLowerCase();
    if (lowerName.includes('chicken') || lowerName.includes('pollo')) return 'Pollo';
    if (lowerName.includes('beef') || lowerName.includes('meat')) return 'Hamburger';
    if (lowerName.includes('veg')) return 'Vegetariano';
    return 'Speciale';
}

// Cache per evitare troppe chiamate all'API esterna
let paniniCache = [];
let lastFetchTime = 0;
const CACHE_DURATION = 3600000; // 1 ora in millisecondi


// Rate-limit friendly endpoint for McDonald's API
// Enhanced caching solution for McDonald's API with rate limit handling
app.get('/api/panini', async (req, res) => {
    console.log('API Panini endpoint called');
    
    // Use current timestamp to check cache
    const currentTime = Date.now();
    
    // Extend cache duration to 24 hours to minimize API calls
    const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
    
    // Check if we have valid cached data
    if (paniniCache.length > 0 && currentTime - lastFetchTime < CACHE_DURATION) {
      console.log(`Using cached data from ${new Date(lastFetchTime).toISOString()}`);
      return res.json(paniniCache);
    }
    
    // If cache is expired or empty, try to refresh from API
    try {
      console.log("Cache expired or empty, attempting to fetch from API");
      
      // Use a single product to test API availability
      const testId = '200426'; // Double Hamburger
      
      const options = {
        method: 'GET',
        hostname: 'mcdonald-s-products-api.p.rapidapi.com',
        port: null,
        path: `/us/products/${testId}`,
        headers: {
          'x-rapidapi-key': '0f52344f89msha7a8f67f53837d7p1b4f2ejsnac674f8dd02c',
          'x-rapidapi-host': 'mcdonald-s-products-api.p.rapidapi.com'
        }
      };
      
      // Test if API is accessible and not rate limited
      const apiAvailable = await new Promise((resolve) => {
        const request = https.request(options, function(response) {
          if (response.statusCode === 200) {
            resolve(true);
          } else if (response.statusCode === 429) {
            console.log("Rate limit hit, using enhanced fallback data");
            resolve(false);
          } else {
            console.log(`API error: ${response.statusCode}, using enhanced fallback data`);
            resolve(false);
          }
          
          // Consume the response data to free up memory
          response.on('data', () => {});
          response.on('end', () => {});
        });
        
        request.on('error', function(error) {
          console.error('API request error:', error);
          resolve(false);
        });
        
        request.end();
      });
      
      if (!apiAvailable) {
        throw new Error("API unavailable or rate limited");
      }
      
      // If we get here, we could try fetching more products,
      // but since we know you're hitting rate limits, let's use our enhanced data
      console.log("Using enhanced fallback data due to API rate limits");
    } catch (error) {
      console.log("Couldn't refresh from API:", error.message);
    }
    
    // Use our enhanced fallback data that mimics McDonald's products
    const enhancedFallbackData = [
      {
        id: "200426",
        nome: "Double Hamburger",
        prezzo: "6.90",
        descrizione: "Due succulenti hamburger di manzo con ketchup, senape, cipolla e sottaceti su un morbido panino.",
        categoria: "Hamburger",
        immagine: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
        ingredienti: "Pane, doppia carne di manzo, ketchup, senape, cipolla, sottaceti"
      },
      {
        id: "200438",
        nome: "McChicken",
        prezzo: "6.50",
        descrizione: "Croccante filetto di pollo impanato con lattuga fresca e delicata maionese su un panino tostato.",
        categoria: "Pollo",
        immagine: "https://images.unsplash.com/photo-1606755962773-d324e0a13086?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
        ingredienti: "Pane, filetto di pollo impanato, lattuga, maionese"
      },
      {
        id: "200445",
        nome: "Filet-O-Fish",
        prezzo: "6.75",
        descrizione: "Filetto di pesce impanato, formaggio e salsa tartara avvolti in un morbido panino.",
        categoria: "Pesce",
        immagine: "https://images.unsplash.com/photo-1562967914-01efa7e87832?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
        ingredienti: "Pane, filetto di pesce impanato, formaggio, salsa tartara"
      },
      {
        id: "200443",
        nome: "Bacon Cheddar McChicken",
        prezzo: "7.25",
        descrizione: "Pollo impanato con formaggio cheddar, croccante bacon, lattuga e salsa speciale.",
        categoria: "Pollo",
        immagine: "https://images.unsplash.com/photo-1626078299034-57a3a242ad99?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
        ingredienti: "Pane, filetto di pollo, formaggio cheddar, bacon, lattuga, salsa speciale"
      },
      {
        id: "1001",
        nome: "Big Mac",
        prezzo: "7.50",
        descrizione: "Iconico hamburger con doppio strato di carne, formaggio, lattuga, cipolla e salsa speciale su un panino a tre strati.",
        categoria: "Hamburger",
        immagine: "https://images.unsplash.com/photo-1582196016295-f8c8bd4b3a99?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
        ingredienti: "Pane a tre strati, doppia carne di manzo, formaggio, lattuga, cipolla, cetrioli, salsa speciale"
      },
      {
        id: "1002",
        nome: "Quarter Pounder con formaggio",
        prezzo: "8.00",
        descrizione: "Un quarto di libbra di carne di manzo succulenta con formaggio, cipolla fresca, sottaceti, ketchup e senape.",
        categoria: "Hamburger",
        immagine: "https://images.unsplash.com/photo-1553979459-d2229ba7433b?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
        ingredienti: "Pane, carne di manzo, formaggio, cipolla, sottaceti, ketchup, senape"
      },
      {
        id: "1003",
        nome: "Veggie Deluxe",
        prezzo: "6.50",
        descrizione: "Hamburger vegetariano con pomodoro, insalata fresca e salsa speciale per un'alternativa senza carne.",
        categoria: "Vegetariano",
        immagine: "https://images.unsplash.com/photo-1550547660-d9450f859349?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
        ingredienti: "Pane, patty vegetale, pomodoro, insalata, salsa speciale"
      },
      {
        id: "1004",
        nome: "Double Cheeseburger",
        prezzo: "7.25",
        descrizione: "Doppio hamburger con doppio formaggio, cipolla, sottaceti e salse per gli amanti del gusto intenso.",
        categoria: "Hamburger",
        immagine: "https://images.unsplash.com/photo-1586190848861-99aa4a171e90?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
        ingredienti: "Pane, doppia carne di manzo, doppio formaggio, cipolla, sottaceti, ketchup, senape"
      },
      {
        id: "1005",
        nome: "Spicy Chicken Deluxe",
        prezzo: "7.75",
        descrizione: "Pollo piccante con lattuga fresca, pomodoro e maionese al pepe per un tocco di calore.",
        categoria: "Pollo",
        immagine: "https://images.unsplash.com/photo-1626078299034-57a3a242ad99?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
        ingredienti: "Pane, filetto di pollo piccante impanato, lattuga, pomodoro, maionese al pepe"
      }
    ];
    
    // Update cache with enhanced fallback data
    paniniCache = enhancedFallbackData;
    lastFetchTime = currentTime;
    
    res.json(enhancedFallbackData);
  });

// Helper function to map API categories to our categories
function mapCategory(category) {
    const categoryMap = {
        'burgers': 'Hamburger',
        'chicken': 'Pollo',
        'salad': 'Vegetariano',
        'drinks': 'Bevande',
        'desserts': 'Dessert',
        'breakfast': 'Colazione'
    };

    return categoryMap[category.toLowerCase()] || 'Speciale';
}
// Endpoint API per ottenere un panino specifico tramite ID
app.get('/api/panini/:id', async (req, res) => {
    const id = req.params.id;
    try {
        const currentTime = Date.now();
        // Aggiorna la cache se è scaduta
        if (paniniCache.length === 0 || currentTime - lastFetchTime > CACHE_DURATION) {
            paniniCache = await fetchPaniniFromExternalAPI();
            lastFetchTime = currentTime;
        }

        const panino = paniniCache.find(p => p.id.toString() === id);
        if (!panino) {
            return res.status(404).json({ error: 'Panino non trovato.' });
        }
        res.json(panino);
    } catch (error) {
        console.error('Errore durante il recupero del panino:', error);
        res.status(500).json({ error: 'Errore del server nel recupero del panino.' });
    }
});

// Endpoint API per filtrare i panini
app.get('/api/panini/filtro', async (req, res) => {
    const { categoria, prezzo_min, prezzo_max, ingrediente, disponibile } = req.query;

    try {
        const currentTime = Date.now();
        // Aggiorna la cache se è scaduta
        if (paniniCache.length === 0 || currentTime - lastFetchTime > CACHE_DURATION) {
            paniniCache = await fetchPaniniFromExternalAPI();
            lastFetchTime = currentTime;
        }

        // Filtra i panini in base ai parametri della query
        let filteredPanini = [...paniniCache];

        if (categoria) {
            filteredPanini = filteredPanini.filter(p =>
                p.categoria.toLowerCase() === categoria.toLowerCase()
            );
        }

        if (prezzo_min) {
            filteredPanini = filteredPanini.filter(p =>
                parseFloat(p.prezzo) >= parseFloat(prezzo_min)
            );
        }

        if (prezzo_max) {
            filteredPanini = filteredPanini.filter(p =>
                parseFloat(p.prezzo) <= parseFloat(prezzo_max)
            );
        }

        if (ingrediente) {
            filteredPanini = filteredPanini.filter(p =>
                p.ingredienti.toLowerCase().includes(ingrediente.toLowerCase())
            );
        }

        if (disponibile !== undefined) {
            const isDisponibile = disponibile === 'true';
            filteredPanini = filteredPanini.filter(p => p.disponibile === isDisponibile);
        }

        res.json(filteredPanini);
    } catch (error) {
        console.error('Errore durante il filtraggio dei panini:', error);
        res.status(500).json({ error: 'Errore del server nel filtraggio dei panini.' });
    }
});

// Anche supportare l'endpoint senza lo slash iniziale
app.get('api/panini/filtro', async (req, res) => {
    // Reindirizza alla versione corretta dell'endpoint
    res.redirect('/api/panini/filtro' + (Object.keys(req.query).length ? '?' + new URLSearchParams(req.query).toString() : ''));
});

// Endpoint API per filtrare per categoria specifica
app.get('/api/panini/categoria/:categoria', async (req, res) => {
    const categoria = req.params.categoria;

    try {
        const currentTime = Date.now();
        // Aggiorna la cache se è scaduta
        if (paniniCache.length === 0 || currentTime - lastFetchTime > CACHE_DURATION) {
            paniniCache = await fetchPaniniFromExternalAPI();
            lastFetchTime = currentTime;
        }

        const filteredPanini = paniniCache.filter(p =>
            p.categoria.toLowerCase() === categoria.toLowerCase()
        );

        res.json(filteredPanini);
    } catch (error) {
        console.error('Errore durante il recupero dei panini per categoria:', error);
        res.status(500).json({ error: 'Errore del server nel recupero dei panini per categoria.' });
    }
});

// Avvia il server sulla porta 3000 (usa il server HTTP invece di app.listen)
server.listen(port, () => {
    console.log(`Server in esecuzione su http://localhost:${port}`);
});