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

        fs.writeFile('utenti.json', JSON.stringify(utenti, null, 2), (err) => {
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




const PORT = 3000;

app.listen(PORT, () => {
    console.log(`server in esecuzione sulla porta ${PORT}`);

});
