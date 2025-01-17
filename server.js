const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');

// Crea un'istanza di Express
const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json()); // Assicurati che il body parser sia configurato correttamente
app.use(express.static(path.join(__dirname, 'public')));

// Connessione al database
const db = new sqlite3.Database('./database.db');

db.serialize(() => {
    // Creazione della tabella utenti
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

    db.run(`INSERT OR IGNORE INTO utenti (username, email, password, tipo) VALUES (?, ?, ?, ?)`, 
        ['admin', 'admin@example.com', hashedPasswordAdmin, 'amministratore']);
    db.run(`INSERT OR IGNORE INTO utenti (username, email, password, tipo) VALUES (?, ?, ?, ?)`, 
        ['capo', 'capo@example.com', hashedPasswordCapo, 'capo']);
    db.run(`INSERT OR IGNORE INTO utenti (username, email, password, tipo) VALUES (?, ?, ?, ?)`, 
        ['cliente', 'cliente@example.com', hashedPasswordCliente, 'cliente']);
});

// Swagger
app.use('/swagger', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Route per la homepage
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route per il login
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email e password sono richiesti.' });
    }

    db.get('SELECT * FROM utenti WHERE email = ?', [email], (err, row) => {
        if (err) {
            return res.status(500).json({ error: 'Errore del server.' });
        }

        if (!row) {
            return res.status(400).json({ error: 'Email o password non validi.' });
        }

        bcrypt.compare(password.trim(), row.password, (err, result) => {
            if (err) {
                return res.status(500).json({ error: 'Errore durante il login.' });
            }

            if (!result) {
                return res.status(400).json({ error: 'Email o password non validi.' });
            }

            let redirectUrl = '';

            // Verify the user type and assign the correct URL
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
                    redirectUrl = ''; // In case of invalid user type
                    break;
            }

            // If redirectUrl is not set, show error
            if (!redirectUrl) {
                return res.status(400).json({ error: 'Tipo utente non valido, impossibile determinare la homepage.' });
            }

            // Log the response data for debugging
            console.log('Redirect URL:', redirectUrl);

            // Respond with the redirect URL and username
            res.json({ success: true, redirectUrl, username: row.username });
        });
    });
});

// Route per la registrazione
app.post('/register', (req, res) => {
    const { username, email, password, tipo } = req.body;

    if (!username || !email || !password || !tipo) {
        return res.status(400).json({ error: 'Tutti i campi sono obbligatori.' });
    }

    // Validazione della password
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(password)) {
        return res.status(400).json({ error: 'La password deve essere lunga almeno 8 caratteri e contenere almeno una lettera e un numero.' });
    }

    const validTypes = ['cliente', 'amministratore', 'capo'];
    if (!validTypes.includes(tipo)) {
        return res.status(400).json({ error: 'Tipo utente non valido.' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);

    // Verifica se l'email esiste già nel database
    db.get('SELECT * FROM utenti WHERE email = ?', [email], (err, row) => {
        if (err) {
            console.error('Errore durante la verifica dell\'email:', err.message);
            return res.status(500).json({ error: 'Errore del server.' });
        }

        if (row) {
            return res.status(400).json({ error: 'Questa email è già in uso.' });
        }

        // Inserisci il nuovo utente nel database
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
    // Esegui il logout
    res.json({ success: true, message: 'Logout effettuato con successo.' });
});

// Inizia il server
app.listen(port, () => {
    console.log(`Server in esecuzione su http://localhost:${port}`);
});
