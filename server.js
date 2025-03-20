require('dotenv').config();

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
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
const axios = require('axios');

// Crea un'istanza di Express
const app = express();
const port = 3000;

// Middleware
app.use(cors({ origin: '*' })); // Abilita CORS per tutte le richieste
app.use(bodyParser.json()); // Parsea il corpo della richiesta come JSON
app.use(express.static(path.join(__dirname, 'public'))); // Serve i file statici dalla cartella 'public'
app.use('/', authRoutes); // Aggiungi le route di autenticazione
const session = require('express-session');

// Initialize passport and session middleware
app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

app.use(passport.initialize());
app.use(passport.session());

const clientId = '1162998261881771';
const redirectUri = 'http://localhost:3000/auth/facebook/callback'; 

const facebookLoginUrl = `https://www.facebook.com/v12.0/dialog/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=state_param`;

// Connessione al database SQLite
const db = new sqlite3.Database('./database.db');




passport.use(new GoogleStrategy({
    clientID : "556734462631-9cissld95v9q2dvpql2mblfo8a4o76rc.apps.googleusercontent.com", // Replace with your Google Client ID
    callbackURL: 'http://localhost:3000/auth/google/callback', // Same as Google Developer Console redirect URI
  },
  (token, tokenSecret, profile, done) => {
    // This will be called after a successful authentication
    // Store the profile info in session or database
    return done(null, profile);
  }
));

// To serialize the user info into the session
passport.serializeUser((user, done) => {
    done(null, user);
});

// To deserialize the user info from the session
passport.deserializeUser((user, done) => {
    done(null, user);
});


app.get('/auth/google', passport.authenticate('google', {
    scope: ['profile', 'email'] // Request profile and email info
}));


app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/' }),
    (req, res) => {
      // On successful authentication, you can redirect to the homepage or dashboard
      res.redirect('/homepage_cliente.html'); // Change the URL based on user type
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

// Endpoint di callback di Facebook
app.get('/auth/facebook/callback', (req, res) => {
    const { code } = req.query; // Ottieni il parametro 'code' dalla query string

    if (!code) {
        return res.status(400).send('Errore: nessun codice di autorizzazione ricevuto.');
    }

    // Scambia il 'code' per un 'access_token' di Facebook
    const tokenUrl = `https://graph.facebook.com/v12.0/oauth/access_token?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${process.env.FACEBOOK_CLIENT_SECRET}&code=${code}`;

    axios.get(tokenUrl)
        .then(response => {
            const accessToken = response.data.access_token;

            // Usa il token di accesso per ottenere i dati dell'utente
            const userUrl = `https://graph.facebook.com/me?access_token=${accessToken}`;
            return axios.get(userUrl);
        })
        .then(userResponse => {
            // Qui puoi ottenere i dati dell'utente da Facebook
            const userData = userResponse.data;

            // Puoi decidere cosa fare con questi dati, come salvarli nel DB
            // Ad esempio, crea una sessione per l'utente
            req.session.user = userData;

            // Esegui il reindirizzamento o altre operazioni
            res.redirect('/homepage_cliente.html'); // Cambia a seconda del tipo di utente
        })
        .catch(err => {
            console.error('Errore durante l\'accesso a Facebook:', err);
            res.status(500).send('Errore nel login con Facebook');
        });
});

  
app.post('/delete-user-data', (req, res) => {
    const userId = req.body.user_id;
    
    // Logica per rimuovere i dati dal DB
    deleteUserData(userId)
      .then(() => res.status(200).json({ message: 'Dati utente eliminati con successo.' }))
      .catch((err) => res.status(500).json({ error: 'Errore durante l’eliminazione dei dati.' }));
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
