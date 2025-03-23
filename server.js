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
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
});


app.use('/', authRoutes);

// Connessione al database SQLite
const db = new sqlite3.Database('./database.db');

// Configure Google Strategy
passport.use(new GoogleStrategy({
    
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback',
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
                function(err) {
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

// Add this endpoint to your server.js file

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
    db.run('DELETE FROM chat_messages WHERE room_id = ?', [roomId], function(err) {
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
            function(err) {
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
            db.run('DELETE FROM chat_messages', function(err) {
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
                db.run('COMMIT', function(err) {
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
    } else {
        // L'utente non è autenticato, reindirizza alla pagina di login
        return res.redirect('/login.hbs');
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

// Endpoint API per ottenere tutti i panini
app.get('/api/panini', async (req, res) => {
    try {
        const currentTime = Date.now();
        // Aggiorna la cache se è scaduta
        if (paniniCache.length === 0 || currentTime - lastFetchTime > CACHE_DURATION) {
            paniniCache = await fetchPaniniFromExternalAPI();
            lastFetchTime = currentTime;
        }
        res.json(paniniCache);
    } catch (error) {
        console.error('Errore durante il recupero dei panini:', error);
        res.status(500).json({ error: 'Errore del server nel recupero dei panini.' });
    }
});

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