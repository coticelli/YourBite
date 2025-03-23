# YourBite

## Descrizione
YourBite è una piattaforma innovativa progettata per i ristoratori, che permette ai clienti di creare menu personalizzati in modo semplice e immediato. Gli utenti possono scegliere e combinare panini, bibite, patatine e snack direttamente dal proprio smartphone. Inoltre, è possibile ricaricare il saldo del proprio account con pagamenti in contante presso i punti vendita fisici, con la conversione dell'importo in una valuta digitale utilizzabile per effettuare ordini.

## Target
Propietari di fast food e clienti di fast food

## Problema
I ristoratori affrontano frequentemente difficoltà nella gestione efficiente degli ordini, nonché nel garantire un'esperienza cliente altamente personalizzata. In scenari di alto volume, ad esempio, un ristorante può ricevere numerosi ordini in breve tempo, causando confusione nello staff e ritardi nella preparazione. Tali disguidi possono generare malintesi sugli ingredienti richiesti dai clienti, con il rischio di insoddisfazione e recensioni negative. Inoltre, la carenza di un sistema intuitivo per la personalizzazione degli ordini rende arduo rispondere in modo rapido alle richieste specifiche, come l'eliminazione di allergeni o l'aggiunta di ingredienti extra. YourBite risponde a questa esigenza con una piattaforma che semplifica la personalizzazione degli ordini, ottimizzando l'efficienza operativa e incrementando le vendite, migliorando al contempo la soddisfazione del cliente.

## Competitor
NeatMenu, Eatsee, Menubly, Almenu, OctoTable, BuonMenu, MenuDrive, Square for Restaurants, Ordermark, Flipdish, Yumm.

---

## Istruzioni per l'utilizzo con Docker

### Prerequisiti
- Docker Desktop installato e in esecuzione sul tuo sistema
- Connessione internet stabile per il download dell'immagine Docker

### Come avviare l'applicazione

1. **Avviare Docker Desktop** sul tuo computer

2. **Aprire il terminale o prompt dei comandi**:
   - Su Windows: Cerca "Prompt dei comandi" o "PowerShell" nel menu Start
   - Su Mac: Apri l'applicazione Terminal
   - Su Linux: Apri qualsiasi terminale disponibile

3. **Eseguire il seguente comando** per scaricare e avviare l'applicazione:
   ```
   docker run -d -p 3000:3000 cotii/yourbite-app
   ```
   
   Questo comando fa:
   - Scarica l'immagine dell'applicazione da Docker Hub (al primo avvio)
   - Crea un container in esecuzione in background
   - Espone l'applicazione sulla porta 3000 del tuo computer

4. **Accedere all'applicazione**:
   - Apri il tuo browser web 
   - Visita l'indirizzo: [http://localhost:3000](http://localhost:3000)
   - L'applicazione YourBite dovrebbe caricarsi automaticamente

### Comandi utili

- **Verificare che l'applicazione sia in esecuzione**:
  ```
  docker ps
  ```
  Dovresti vedere un container con l'immagine "cotii/yourbite-app" nell'elenco

- **Visualizzare i log dell'applicazione**:
  ```
  docker logs [ID_CONTAINER]
  ```
  Sostituisci [ID_CONTAINER] con l'ID mostrato nel comando "docker ps"

- **Arrestare l'applicazione**:
  ```
  docker stop [ID_CONTAINER]
  ```

- **Rimuovere il container dopo l'arresto**:
  ```
  docker rm [ID_CONTAINER]
  ```

- **Aggiornare all'ultima versione** (se sono state rilasciate modifiche):
  ```
  docker pull cotii/yourbite-app
  ```
  Dopo aver scaricato la nuova versione, arrestare il vecchio container e avviarne uno nuovo.

### Risoluzione problemi

- **Se la porta 3000 è occupata** puoi usare una porta diversa:
  ```
  docker run -d -p 8080:3000 cotii/yourbite-app
  ```
  Poi accedi all'applicazione su [http://localhost:8080](http://localhost:8080)

- **Se l'immagine non si scarica correttamente**:
  ```
  docker pull cotii/yourbite-app
  ```
  Questo forza il download dell'immagine

---

## Requisiti Funzionali

**Metodi di Pagamento**:  
- Supporto per una varietà di metodi di pagamento, inclusi carte di credito, PayPal e wallet digitali.

**Ricarica del Wallet Virtuale in Contanti**:  
- Possibilità di ricaricare il wallet virtuale in contante presso i punti vendita fisici, utilizzando modalità offline.

**Integrazione API per Fast Food/Ristoranti**:  
- Integrazione di API per la gestione e l'aggiornamento in tempo reale degli ordini e dei menu.

**Database degli Ingredienti**:  
- Creazione di un database completo con dettagli su allergeni, valori nutrizionali e opzioni di personalizzazione.

**Notifiche Ordine**:  
- Sistema di notifiche in tempo reale per aggiornamenti sullo stato dell'ordine.

**Pagina di Supporto**:  
- Sezione dedicata al supporto clienti, con FAQ, chat live e assistenza via email o telefono.

**Registrazione e Login**:  
- Accesso tramite email, social media o numero di telefono.

**Sistema di Bonus**:  
- Programma di fidelizzazione che premia gli utenti con punti bonus per ordini ripetuti.

**Offerte e Consegna del Cibo**:  
- Visualizzazione di offerte speciali e opzioni per la consegna a domicilio.

**Sincronizzazione tra Venditore e App**:  
- Sincronizzazione dei tempi di preparazione e consegna per fornire stime precise sul tempo di arrivo.

**Layout e Prodotti Personalizzati**:  
- Layout personalizzato per ogni venditore, con offerte specifiche.

**Personalizzazione degli Ingredienti**:  
- Opzione per i clienti di aggiungere o rimuovere ingredienti dai piatti ordinati.

**Visualizzazione del Menu del Mese**:  
- Sezione dedicata al menu del mese, con sondaggi interattivi per il feedback degli utenti.

**Personalizzazione della Lingua**:  
- Possibilità di modificare la lingua dell'app in base alle preferenze individuali.

---

## Requisiti Non Funzionali

**Connessione Internet**:  
- Una connessione internet stabile è necessaria per il corretto funzionamento dell'applicazione.

**Prestazioni**:  
- L'esperienza utente deve essere fluida, anche con la gestione simultanea.

**Interfaccia Responsive**:  
- L'applicazione sarà ottimizzata per dispositivi mobili, tablet e desktop.

**Tempi di Caricamento**:  
- Le pagine devono caricarsi in meno di 2 secondi, per garantire una navigazione veloce e senza interruzioni.

**Scalabilità**:  
- Il sistema sarà progettato per scalare facilmente, consentendo l'aumento del numero di utenti e ristoranti senza compromettere le prestazioni.

---

## Requisiti di Dominio

**Metodi di Pagamento**:  
- La gestione dei pagamenti digitali è un aspetto cruciale per l'efficace operatività della piattaforma.

**Ricarica del Wallet Virtuale in Contanti**:  
- È fondamentale includere modalità di pagamento offline, in modo da garantire un'esperienza completa anche senza necessità di connessione immediata.

**Integrazione API per Fast Food/Ristoranti**:  
- L'integrazione con sistemi esistenti nei ristoranti è essenziale per garantire un flusso di lavoro armonioso e in tempo reale.

**Database degli Ingredienti**:  
- Un database accurato è indispensabile per la sicurezza alimentare e per la corretta personalizzazione del menu, soprattutto in relazione agli allergeni.

**Offerte e Consegna del Cibo**:  
- Le offerte speciali e le opzioni di consegna sono un incentivo per incrementare le vendite e soddisfare le aspettative dei clienti.

**Sistema di Bonus**:  
- Un programma di fidelizzazione efficace è uno strumento chiave per incentivare la clientela a utilizzare frequentemente la piattaforma.

---

![image](https://github.com/user-attachments/assets/5f4dee4f-666a-4164-89f3-e05ac5350ff8)

---

**JSON di Riferimento**:  
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
  },
  "OrderNotifications": {
    "OrderID": "order123",
    "Status": "Delivered",
    "Timestamp": "2023-10-01T12:30:00Z",
    "Message": "Your order has been delivered successfully."
  },
  "SupportPage": {
    "FAQ": [
      {
        "Question": "How can I track my order?",
        "Answer": "You can track your order by clicking on the 'Track Order' link in your order confirmation email."
      }
    ],
    "LiveChat": {
      "Status": "Online",
      "AgentName": "John Doe"
    },
    "EmailSupport": "support@example.com",
    "PhoneSupport": "+12 345 678 9"
  },
  "RegistrationLogin": {
    "Registration": {
      "Email": "user@example.com",
      "Password": "password123",
      "PhoneNumber": "+12 345 678 9",
      "SocialMedia": ["Facebook", "Google"]
    },
    "Login": {
      "Email": "user@example.com",
      "Password": "password123"
    }
  },
  "LoyaltyProgram": {
    "UserID": "zio",
    "Points": 150,
    "Rewards": [
      {
        "RewardID": "reward001",
        "Description": "10% off on your next order"
      }
    ]
  }
}
```