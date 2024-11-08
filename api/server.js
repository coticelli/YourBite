// Importa le dipendenze necessarie
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const path = require('path');
const bcrypt = require('bcrypt'); // Importa bcrypt per la crittografia
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');

// Crea un'istanza di Express
const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Serve i file statici (HTML, CSS, immagini, ecc.) dalla cartella 'public'
app.use(express.static(path.join(__dirname, 'public'))); // Serve 'public' per file statici

// Crea una connessione al database SQLite
const db = new sqlite3.Database('./database.db');

// Crea la tabella degli utenti
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS utenti (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        firstName TEXT NOT NULL,
        lastName TEXT NOT NULL,
        province TEXT NOT NULL,
        cap TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL
    )`);
});

app.use('/swagger', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Route per la homepage
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html')); // Homepage con pulsanti "Registrati" e "Accedi"
});

app.get('/registrazione', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'registrazione.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Route per la registrazione (POST)
app.post('/registrazione', async (req, res) => {
    const { firstName, lastName, province, cap, phone, email, password } = req.body;

    // Verifica che tutti i campi siano presenti
    if (!firstName || !lastName || !province || !cap || !phone || !email || !password) {
        return res.status(400).json({ success: false, message: 'Tutti i campi sono richiesti.' });
    }

    // Verifica del formato della password
    const passwordPattern = /^(?=.*[!@#$%^&*(),.?":{}|<>])[A-Za-z\d!@#$%^&*(),.?":{}|<>]{8,}$/;
    if (!passwordPattern.test(password)) {
        return res.status(400).json({ success: false, message: 'La password deve contenere almeno 8 caratteri e un carattere speciale.' });
    }

    // Controlla se l'email è già registrata
    db.get('SELECT * FROM utenti WHERE email = ?', [email], (err, row) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Errore del server.' });
        }
        if (row) {
            return res.status(400).json({ success: false, message: 'Email già registrata.' });
        }

        // Crittografa la password prima di inserirla nel database
        bcrypt.hash(password, 10, (err, hashedPassword) => {
            if (err) {
                return res.status(500).json({ success: false, message: 'Errore durante la registrazione.' });
            }

            // Inserisci l'utente nel database
            db.run('INSERT INTO utenti (firstName, lastName, province, cap, phone, email, password) VALUES (?, ?, ?, ?, ?, ?, ?)', 
            [firstName, lastName, province, cap, phone, email, hashedPassword], function(err) {
                if (err) {
                    return res.status(500).json({ success: false, message: 'Errore durante la registrazione.' });
                }
                res.status(200).json({ success: true, message: 'Registrazione avvenuta con successo!' });
            });
        });
    });
});

// Route per il login (POST)
app.post('/login', (req, res) => {
    console.log(req.body); // Aggiungi questo per vedere i dati ricevuti dal client

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

        // Confronto della password
        bcrypt.compare(password, row.password, (err, result) => {
            if (err) {
                return res.status(500).json({ error: 'Errore durante il login.' });
            }
            if (!result) {
                return res.status(400).json({ error: 'Email o password non validi.' });
            }

            res.json({ message: `Benvenuto, ${row.firstName}!` });
        });
    });
});

// Route per gestire gli errori 404
app.get('*', (req, res) => {
    res.status(404).send('File non trovato');
});

// Inizia il server
app.listen(port, () => {
    console.log(`Server in esecuzione su http://37.27.202.176:${port}`);
});
