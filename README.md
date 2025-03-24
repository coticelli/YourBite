<div align="center">
  <img src="https://github.com/user-attachments/assets/5f4dee4f-666a-4164-89f3-e05ac5350ff8" width="200">
  <h1>YourBite</h1>
  <p><i>Ordini personalizzati, esperienza senza paragoni</i></p>
  
  ![Version](https://img.shields.io/badge/version-1.0.0-blue)
  ![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker)
  
  <p>Ultimo aggiornamento: 2023-03-24</p>
</div>

---

## 📋 Indice

- [Panoramica](#-panoramica)
- [Problema e Soluzione](#-problema-e-soluzione)
- [Target di Mercato](#-target-di-mercato)
- [Avvio Rapido](#-avvio-rapido)
- [Guida Dettagliata](#-guida-dettagliata)
- [Requisiti Funzionali](#-requisiti-funzionali)
- [Requisiti Non Funzionali](#-requisiti-non-funzionali)
- [Requisiti di Dominio](#-requisiti-di-dominio)
- [Struttura Dati](#-struttura-dati)
- [Tecnologie Utilizzate](#-tecnologie-utilizzate)
- [Concorrenza](#-concorrenza)

---

## 🚀 Panoramica

**YourBite** è una piattaforma innovativa progettata per rivoluzionare l'esperienza di ordinazione nei fast food e ristoranti. Consente ai clienti di:

- Creare menu personalizzati in modo semplice e intuitivo
- Selezionare e combinare panini, bibite, patatine e snack tramite smartphone
- Ricaricare il saldo dell'account con pagamenti in contanti nei punti vendita fisici
- Utilizzare una valuta digitale interna per effettuare ordini rapidamente

La piattaforma mette a disposizione un'interfaccia intuitiva sia per i ristoratori che per i clienti, ottimizzando l'intero processo di ordinazione e preparazione.

---

## 🔍 Problema e Soluzione

### Sfide attuali
I ristoratori affrontano molteplici difficoltà nella gestione quotidiana delle operazioni:

- **Gestione inefficiente degli ordini** durante i periodi di alta affluenza
- **Difficoltà di personalizzazione** degli ordini secondo le preferenze dei clienti
- **Malintesi sugli ingredienti** che causano insoddisfazione e recensioni negative
- **Ritardi nella preparazione** dovuti a confusione e processi manuali

### Come YourBite risolve questi problemi

✅ **Ordini digitali personalizzati** che eliminano gli errori di comunicazione  
✅ **Gestione automatizzata** che riduce il carico di lavoro dello staff  
✅ **Selezione ingredienti intuitiva** che migliora l'esperienza del cliente  
✅ **Flusso di lavoro ottimizzato** che aumenta l'efficienza operativa  
✅ **Tracciamento in tempo reale** che mantiene i clienti informati sull'avanzamento dell'ordine

---

## 👥 Target di Mercato

YourBite si rivolge a due segmenti chiave del mercato:

<table>
  <tr>
    <td width="50%" align="center"><b>🏢 Ristoratori</b></td>
    <td width="50%" align="center"><b>🧑‍🤝‍🧑 Clienti</b></td>
  </tr>
  <tr>
    <td>
      • Proprietari di fast food<br>
      • Gestori di catene di ristorazione<br>
      • Ristoranti con alto volume di clienti<br>
      • Locali con menu personalizzabili
    </td>
    <td>
      • Clienti abituali di fast food<br>
      • Persone con preferenze alimentari specifiche<br>
      • Utenti tecnologicamente attivi<br>
      • Consumatori attenti alla velocità del servizio
    </td>
  </tr>
</table>

---

## 🚀 Avvio Rapido

### Prerequisiti
- Docker installato sul sistema
- Connessione internet stabile

### Windows
1. Scarica questa repository
2. Fai doppio clic su `start-yourbite.bat`
3. Attendi l'avvio dell'applicazione (lo script installerà Docker se necessario)
4. Il browser si aprirà automaticamente su http://localhost:3000

### Linux
1. Scarica questa repository
2. Apri il terminale nella cartella del progetto
3. Rendi eseguibile lo script: `chmod +x start-yourbite.sh`
4. Esegui lo script: `./start-yourbite.sh`
5. L'applicazione si avvierà e aprirà automaticamente il browser

---

## 📖 Guida Dettagliata

### Architettura del Sistema

YourBite utilizza un'architettura containerizzata con Docker per semplificare distribuzione e esecuzione:

- **Frontend**: Interfaccia web responsive per clienti e pannello di amministrazione per ristoratori
- **Backend**: API RESTful che gestisce la logica di business
- **Database**: Archiviazione persistente per utenti, ordini, menu e transazioni
- **Autenticazione**: Accesso sicuro tramite email/password o Google OAuth

### Ruoli Utente

L'applicazione prevede due tipi principali di utenti:

1. **Clienti**: Possono navigare menu, personalizzare ordini, effettuare pagamenti
2. **Ristoratori**: Possono gestire menu, monitorare ordini, analizzare le vendite

### Risoluzione dei problemi comuni

<details>
<summary><b>Verificare lo stato dell'applicazione</b></summary>

```bash
docker ps
```
Dovresti vedere un container con l'immagine "cotii/yourbite-app" nell'elenco
</details>

<details>
<summary><b>Cambio porta predefinita</b></summary>

Se la porta 3000 è già in uso:
```bash
docker run -d -p 8080:3000 cotii/yourbite-app
```
Poi accedi all'applicazione su http://localhost:8080
</details>

<details>
<summary><b>Avvio manuale dell'applicazione</b></summary>

Su Windows:
```bash
docker pull cotii/yourbite-app
docker run -d -p 3000:3000 cotii/yourbite-app
```

Su Linux:
```bash
sudo docker pull cotii/yourbite-app
sudo docker run -d -p 3000:3000 cotii/yourbite-app
```
</details>

<details>
<summary><b>Problemi con l'autenticazione Google</b></summary>

Assicurati che:
1. Il servizio sia accessibile tramite il localhost esatto configurato (http://localhost:3000)
2. Le credenziali Google OAuth siano configurate correttamente
3. L'URL di callback impostato nella console Google Cloud sia esattamente: `http://localhost:3000/auth/google/callback`
</details>

<details>
<summary><b>Persistenza dei dati</b></summary>

I dati vengono memorizzati all'interno del container. Per conservarli tra riavvii:
```bash
docker run -d -p 3000:3000 -v ./data:/usr/src/app/data cotii/yourbite-app
```
</details>

---

## 📋 Requisiti Funzionali

### Pagamenti e Transazioni
- **Metodi di Pagamento**: Supporto per carte di credito, PayPal e wallet digitali
- **Ricarica Wallet Virtuale**: Possibilità di ricaricare il saldo in contanti presso punti vendita fisici
- **Sistema di Bonus**: Programma di fidelizzazione con punti bonus per ordini ripetuti

### Gestione Ordini
- **Personalizzazione Ingredienti**: Opzioni per aggiungere o rimuovere ingredienti dai piatti
- **Notifiche in Tempo Reale**: Aggiornamenti sullo stato dell'ordine
- **Sincronizzazione Venditore-App**: Sincronizzazione di tempi di preparazione e consegna

### Esperienza Utente
- **Registrazione e Login**: Accesso tramite email, social media o numero di telefono
- **Layout Personalizzato**: Interfaccia adattata a ciascun venditore, con offerte specifiche
- **Menu del Mese**: Sezione dedicata con sondaggi interattivi per il feedback
- **Personalizzazione Linguistica**: Possibilità di modificare la lingua dell'app

### Backend e Integrazione
- **API per Ristoranti**: Integrazione per la gestione e l'aggiornamento in tempo reale
- **Database Ingredienti**: Informazioni complete su allergeni e valori nutrizionali
- **Supporto Cliente**: FAQ, chat live e assistenza multicanale
- **Offerte e Consegne**: Sistema di promozioni e gestione delle consegne

---

## ⚙️ Requisiti Non Funzionali

### Performance
- **Tempi di Caricamento**: Pagine caricate in meno di 2 secondi
- **Esperienza Fluida**: Gestione simultanea di multiple interazioni
- **Connettività**: Requisito di connessione internet stabile per funzionalità complete

### User Experience
- **Responsive Design**: Ottimizzazione per dispositivi mobili, tablet e desktop
- **Accessibilità**: Conformità alle linee guida di accessibilità standard

### Infrastruttura
- **Scalabilità**: Architettura progettata per gestire crescita di utenza senza degradare le prestazioni
- **Sicurezza**: Protezione dei dati personali e transazioni

---

## 🏛️ Requisiti di Dominio

### Gestione Finanziaria
- **Pagamenti Digitali**: Integrazione sicura di sistemi di pagamento
- **Transazioni Offline**: Supporto per operazioni senza connessione diretta tramite il wallet digitale

### Integrazione Sistemi
- **Compatibilità API**: Collegamento con sistemi gestionali esistenti nei ristoranti
- **Flusso di Lavoro**: Garantire operazioni armonizzate in tempo reale

### Sicurezza Alimentare
- **Tracciabilità Ingredienti**: Database dettagliato per personalizzazioni sicure
- **Informazioni Allergeni**: Gestione accurata delle informazioni su allergeni

### Marketing e Fidelizzazione
- **Promozioni**: Sistema di offerte speciali e opzioni di consegna
- **Programma Fedeltà**: Meccanismi di incentivazione all'uso continuativo

---

## 🗄️ Struttura Dati

Di seguito un esempio della struttura dati utilizzata nell'applicazione:

<details>
<summary><b>Visualizza esempio JSON</b></summary>

```json
{
  "PaymentMethods": [
    {
      "Type": "CreditCard",
      "Details": {
        "CardNumber": "XXXX-XXXX-XXXX-XXXX",
        "ExpiryDate": "12/24",
        "CVV": "123"
      }
    },
    {
      "Type": "PayPal",
      "Details": {
        "Email": "user@example.com"
      }
    },
    {
      "Type": "DigitalWallet",
      "Details": {
        "WalletID": "wallet123456789"
      }
    }
  ],
  "WalletRecharge": {
    "Amount": 100.00,
    "PaymentMethod": "Cash",
    "Location": "Piazza Grasso 537, Borgo Donatella, CB 40928"
  },
  "RestaurantAPI": {
    "RestaurantID": "12345",
    "Menu": [
      {
        "ItemID": "item001",
        "Name": "Burger",
        "Price": 8.99,
        "Ingredients": ["Beef", "Lettuce", "Tomato", "Cheese"]
      },
      {
        "ItemID": "item002",
        "Name": "Pizza",
        "Price": 12.99,
        "Ingredients": ["Tomato Sauce", "Mozzarella", "Pepperoni"]
      }
    ],
    "Order": {
      "OrderID": "order123",
      "CustomerID": "zio",
      "Items": [
        {
          "ItemID": "item001",
          "Quantity": 2
        },
        {
          "ItemID": "item002",
          "Quantity": 1
        }
      ],
      "Status": "Preparation"
    }
  },
  "IngredientDatabase": {
    "Ingredients": [
      {
        "IngredientID": "ing001",
        "Name": "Beef",
        "Allergens": ["None"],
        "NutritionalValues": {
          "Calories": 250,
          "Proteins": 20,
          "Carbs": 5,
          "Fats": 15
        }
      },
      {
        "IngredientID": "ing002",
        "Name": "Lettuce",
        "Allergens": ["None"],
        "NutritionalValues": {
          "Calories": 10,
          "Proteins": 1,
          "Carbs": 2,
          "Fats": 0.5
        }
      }
    ]
  }
}
```
</details>

### Relazioni tra Entità

```
Cliente 1:N Ordini
Ristoratore 1:N Menu
Menu 1:N Prodotti
Prodotto 1:N Ingredienti
Ordine N:M Prodotti
Wallet 1:1 Cliente
Transazione N:1 Cliente
```

---

## 💻 Tecnologie Utilizzate

<table>
  <tr>
    <td align="center"><img src="https://img.icons8.com/color/48/000000/nodejs.png"/><br>Node.js</td>
    <td align="center"><img src="https://img.icons8.com/color/48/000000/docker.png"/><br>Docker</td>
    <td align="center"><img src="https://img.icons8.com/color/48/000000/javascript.png"/><br>JavaScript</td>
    <td align="center"><img src="https://img.icons8.com/color/48/000000/google-logo.png"/><br>OAuth</td>
  </tr>
</table>

### Architettura Tecnica

- **Frontend**: HTML5, CSS3, JavaScript (React.js)
- **Backend**: Node.js, Express.js
- **Persistenza**: JSON file-based (MVP), espandibile a database relazionale
- **Containerizzazione**: Docker per deployment semplificato
- **Autenticazione**: Sistema locale + Google OAuth

---

## 🥊 Concorrenza

Il mercato delle piattaforme di ordinazione per ristoranti comprende diversi competitor:

- **NeatMenu, Eatsee, Menubly** - Piattaforme specializzate in menu digitali
- **Almenu, OctoTable, BuonMenu** - Soluzioni per la gestione degli ordini
- **MenuDrive, Square for Restaurants** - Sistemi integrati POS e ordinazione
- **Ordermark, Flipdish, Yumm** - Aggregatori di ordini e consegne

**Vantaggi competitivi di YourBite**:
- Sistema integrato di wallet ricaricabile anche offline
- Personalizzazione avanzata degli ingredienti
- Interfaccia utente altamente intuitiva
- Integrazione diretta con i flussi di lavoro esistenti dei ristoratori

---

<div align="center">
  <p>Sviluppato da <b>Fabio Coticelli</b></p>
  <p>
    <a href="mailto:fabiocoticelli06@gmail.com">fabiocoticelli06@gmail.com</a> |
    <a href="https://github.com/coticelli">GitHub</a>
  </p>
</div>
