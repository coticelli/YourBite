const express = require('express');
const bodyParser = require ( 'body-parser');
const fs = require('fs');

const app = express();

app.use(bodyParser.json());

app.post('/login', (req, res) => {
    const {username, password} = req.body;
    console.log(`richiesta di login per l'utente ${username}`);
    console.log(`Password ${password}`);

    fs.readFile('utenti.json', 'utf8', (err, data) => {
        if(err) {
            res.status(500).json({ message: 'errore nella lettura'})
            return;
        }

        try{
            const utenti = JSON.parse(data);

            const user = utenti.find(u => u.user === username && u.pwd === password);

            if(user)
            {
                res.status(200).json({
                    "status" : "OK",
                    "user": "admin",
                    "password": user.user,
                    "ruolo": user.ruolo
                });
            }
            else {
                    res.status(401).json({message:'Credenziali non valide'});
            }
        }
        catch (err) {
            res.status(500).json({ message: 'Errore nel parsing'});
        }
    });
});

app.get('/utenti', (req, res) => {
    fs.readFile('utenti.json', 'utf8', (err, data) => {
        if(err){
            res.status(500).json({ message: 'Errore nella lettura'});
            return;
        }
        try{
            const utenti = JSON.parse(data);
            res.status(200).json(utenti);
        }
        catch (err) {
            res.status(500).json({message: 'Errore nel parsing'}) 
        }
    });
})

app.post('/utenti', (req, res) => {
    const {user, pwd, ruolo} = req.body;

    if(!user || !pwd || !ruolo) {
        return res.status(400).json({ message: 'Errore nella lettura'});
    }

    try{
        const utenti = JSON.parse(data);

        const userExists = utenti.find(u => u.user === user);
        if (userExists){
            return res.status(400).json({message: 'utente già esistente'});
        }

        const nuovoUtente = {user, pwd, ruolo};
        utenti.push(nuovoUtente);

        fs.writeFile('server/utenti.json', JSON.stringify(utenti, null, 2), (err) => {
            if(err) {
                res.status(500).json({message: 'errore nel salvataggio'});
                return;
            }
            res.status(201).json({message: 'utente aggiunto', nuovoUtente});
        });
        
    }catch(err) {
        res.status(500).json ({message: 'errore nel parsing'});
    }
})

app.delete('/utenti/:user', (req, res) => {
    const usernameToDelete = req.params.user;

    fs.readFile('server/utenti.json', 'utf8', (err, data) => {
        if (err) {
            res.status(500).json({ message: 'Errore nella lettura' });
            return;
        }

        try {
            let utenti = JSON.parse(data);

            const userIndex = utenti.findIndex(u => u.user === usernameToDelete);
            if (userIndex === -1) {
                return res.status(404).json({ message: 'Utente non trovato' });
            }

            // Remove the user from the array
            utenti.splice(userIndex, 1);

            fs.writeFile('server/utenti.json', JSON.stringify(utenti, null, 2), (err) => {
                if (err) {
                    res.status(500).json({ message: 'Errore nel salvataggio' });
                    return;
                }
                res.status(200).json({ message: `Utente ${usernameToDelete} eliminato con successo` });
            });
        } catch (err) {
            res.status(500).json({ message: 'Errore nel parsing' });
        }
    });
});

app.put('/utenti/:user', (req, res) => {
    const usernameToUpdate = req.params.user;
    const { newUser, newPwd, newRuolo } = req.body;

    fs.readFile('server/utenti.json', 'utf8', (err, data) => {
        if (err) {
            res.status(500).json({ message: 'Errore nella lettura' });
            return;
        }

        try {
            let utenti = JSON.parse(data);

            const userIndex = utenti.findIndex(u => u.user === usernameToUpdate);
            if (userIndex === -1) {
                return res.status(404).json({ message: 'Utente non trovato' });
            }

            // Update the user's information
            if (newUser) utenti[userIndex].user = newUser;
            if (newPwd) utenti[userIndex].pwd = newPwd;
            if (newRuolo) utenti[userIndex].ruolo = newRuolo;

            fs.writeFile('utenti.json', JSON.stringify(utenti, null, 2), (err) => {
                if (err) {
                    res.status(500).json({ message: 'Errore nel salvataggio' });
                    return;
                }
                res.status(200).json({ message: `Utente ${usernameToUpdate} aggiornato con successo`, updatedUser: utenti[userIndex] });
            });
        } catch (err) {
            res.status(500).json({ message: 'Errore nel parsing' });
        }
    });
});



const PORT = 3000;

app.listen(PORT, () => {
    console.log(`server in esecuzione sulla porta ${PORT}`);
});
