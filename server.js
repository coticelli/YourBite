// Importa le librerie necessarie
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');
const authRoutes = require('./authRoutes');

// Crea un'istanza di Express
const app = express();
const port = 3000;

// Middleware
app.use(cors({ origin: '*' })); // Abilita CORS per tutte le richieste
app.use(bodyParser.json()); // Parsea il corpo della richiesta come JSON
app.use(express.static(path.join(__dirname, 'public'))); // Serve i file statici dalla cartella 'public'
app.use('/', authRoutes); // Aggiungi le route di autenticazione
const session = require('express-session');

app.use(session({
  secret: '1e01ad5f540721968c5c17c7789c5446', // Replace with a secure secret
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Set to `true` for HTTPS
}));

// Connessione al database SQLite
const db = new sqlite3.Database('./database.db');

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

// Swagger - Impostazione della documentazione API
app.use('/swagger', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Route per la homepage
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
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

            // Determina la URL di reindirizzamento in base al tipo utente
            let redirectUrl = '';
            switch (row.tipo) {
                case 'cliente':
                    redirectUrl = '/homepage_cliente.html';
                    break;
                case 'amministratore':
                    redirectUrl = '/homepage_admin.html';
                    break;
                case 'capo':
                    redirectUrl = '/homepage_capo.html';
                    break;
                default:
                    redirectUrl = ''; // Tipo utente non valido
                    break;
            }

            // Se non è stata trovata una URL di reindirizzamento, restituisci un errore
            if (!redirectUrl) {
                return res.status(400).json({ error: 'Tipo utente non valido, impossibile determinare la homepage.' });
            }

            // Risposta con il reindirizzamento e il nome utente
            res.json({ success: true, redirectUrl, username: row.username });
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
            [username, email, hashedPassword, tipo], function(err) {
                if (err) {
                    console.error('Errore durante l\'inserimento del nuovo utente:', err.message);
                    return res.status(500).json({ error: 'Errore durante la registrazione.' });
                }

                console.log(`Nuovo utente registrato: ${username}`);
                res.json({ success: true, message: 'Registrazione avvenuta con successo.' });
            });
    });
});

// Endpoint di logout (metodo POST)
app.post('/logout', (req, res) => {
    // Simula il logout
    res.json({ success: true, message: 'Logout effettuato con successo.' });
});

// Avvia il server sulla porta 3000
app.listen(port, () => {
    console.log(`Server in esecuzione su http://localhost:${port}`);
});
