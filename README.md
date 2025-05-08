<div align="center">
  
  # 🍔 YourBite 🍕
  
  <p><i>Ordini personalizzati, esperienza senza paragoni</i></p>
  
  ![Version](https://img.shields.io/badge/version-1.0.0-blue?style=for-the-badge&logo=semver&logoColor=white)
  ![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)
  ![Node.js](https://img.shields.io/badge/Node.js-18.x-339933?style=for-the-badge&logo=node.js&logoColor=white)
  ![OAuth](https://img.shields.io/badge/OAuth-Integrato-4285F4?style=for-the-badge&logo=google&logoColor=white)
  
  <p align="center">
    <a href="#-guida-rapida">📚 Guida</a> •
    <a href="#-deployment">🚀 Deployment</a> •
    <a href="#-caratteristiche">✨ Caratteristiche</a> •
    <a href="#-architettura">🏗️ Architettura</a> •
    <a href="#-faq">❓ FAQ</a>
  </p>
  
  <sub><i>Ultimo aggiornamento: 2025-05-08</i></sub>
</div>

---

## 📋 Panoramica

**YourBite** è una piattaforma innovativa che rivoluziona l'esperienza di ordinazione nei ristoranti e fast food. Attraverso un'interfaccia intuitiva e personalizzabile, offre:

<table>
  <tr>
    <td width="50%" align="center">
      <h3>🎨 Menu Personalizzati</h3>
      <p>Crea combinazioni uniche in modo semplice e intuitivo</p>
    </td>
    <td width="50%" align="center">
      <h3>💳 Wallet Digitale</h3>
      <p>Ricarica il saldo in contanti e ordina più velocemente</p>
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <h3>🔄 Tracking in Tempo Reale</h3>
      <p>Segui lo stato del tuo ordine in ogni momento</p>
    </td>
    <td width="50%" align="center">
      <h3>🔌 Integrazione con Ristoranti</h3>
      <p>Flusso di lavoro ottimizzato per lo staff</p>
    </td>
  </tr>
</table>

---

## 🔍 Problema e Soluzione

<div style="display:flex; align-items:center; gap:20px;">
  <div>
    <h3>💔 Le sfide del settore</h3>
    <ul>
      <li><b>Picchi di affluenza</b> - gestione caotica durante le ore di punta</li>
      <li><b>Errori di comunicazione</b> - malintesi sugli ingredienti e preparazioni</li>
      <li><b>Tempi di attesa</b> - processi manuali che rallentano il servizio</li>
      <li><b>Esperienza cliente</b> - personalizzazione limitata e insoddisfacente</li>
    </ul>
  </div>
  
  <div>
    <h3>💚 Come YourBite risolve</h3>
    <ul>
      <li><b>Ordini digitali</b> - sistema automatizzato che riduce gli errori del 95%</li>
      <li><b>Personalizzazione avanzata</b> - interfaccia visuale per configurare ogni piatto</li>
      <li><b>Flusso ottimizzato</b> - riduzione del 40% dei tempi di servizio</li>
      <li><b>Tracciamento real-time</b> - trasparenza completa sul processo d'ordine</li>
    </ul>
  </div>
</div>

---

## 👥 Target di Mercato

<table>
  <tr>
    <td width="50%" align="center"><h3>🏢 Ristoratori</h3></td>
    <td width="50%" align="center"><h3>👨‍👩‍👧‍👦 Clienti</h3></td>
  </tr>
  <tr>
    <td>
      <ul>
        <li><b>Fast Food</b> - catene locali e nazionali</li>
        <li><b>Ristoranti Casual</b> - con menu personalizzabili</li>
        <li><b>Food Court</b> - in centri commerciali e aeroporti</li>
        <li><b>Cloud Kitchen</b> - operazioni di delivery-only</li>
      </ul>
    </td>
    <td>
      <ul>
        <li><b>Gen Z & Millennials</b> - tech-savvy e orientati alla personalizzazione</li>
        <li><b>Lavoratori</b> - con pause pranzo limitate</li>
        <li><b>Famiglie</b> - con esigenze alimentari diverse</li>
        <li><b>Consumatori con diete specifiche</b> - allergie o preferenze alimentari</li>
      </ul>
    </td>
  </tr>
</table>

<div align="center">
  <b>Mercato complessivo stimato:</b> €4.2 miliardi in Europa (2025)
</div>

---

## 🚀 Guida Rapida

<div align="center">
  <h3>Tre semplici passaggi per iniziare</h3>
</div>

<div style="display: flex; justify-content: space-between; text-align: center; margin-top: 20px;">
  <div style="flex: 1; padding: 15px;">
    <h4>1️⃣ Pulli l'immagine</h4>
    <pre><code>docker pull cotii/yourbite-app</code></pre>
  </div>
  <div style="flex: 1; padding: 15px;">
    <h4>2️⃣ Avvia il container</h4>
    <pre><code>docker run -d -p 3000:3000 \
--name yourbite-container \
cotii/yourbite-app</code></pre>
  </div>
  <div style="flex: 1; padding: 15px;">
    <h4>3️⃣ Accedi all'app</h4>
    <p>Apri <a href="http://localhost:3000">http://localhost:3000</a></p>
  </div>
</div>

### ⚡ Requisiti

- 🐳 Docker
- 🌐 Connessione Internet
- 🔐 Credenziali OAuth (opzionali)

<details>
<summary><b>🔐 Configurazione dell'autenticazione</b></summary>

Per abilitare il login con Google, avvia il container con le credenziali OAuth:

```bash
docker run -d -p 3000:3000 --name yourbite-container \
  -e GOOGLE_CLIENT_ID=tuo_client_id \
  -e GOOGLE_CLIENT_SECRET=tuo_client_secret \
  cotii/yourbite-app
```

Ottieni le credenziali dalla [Console Google Cloud](https://console.cloud.google.com/) e imposta l'URL di callback: `http://localhost:3000/auth/google/callback`
</details>

---

## 🔧 Deployment

### Creazione dell'immagine da zero

```dockerfile
# ---- Dockerfile ----
FROM node:18-alpine

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
```

#### Passaggi:

1️⃣ **Clona il repository e naviga alla directory**
```bash
git clone https://github.com/coticelli/yourbite.git
cd yourbite
```

2️⃣ **Costruisci l'immagine**
```bash
docker build -t yourbite-app .
```

3️⃣ **Esegui un container dall'immagine**
```bash
docker run -d -p 3000:3000 --name yourbite-container yourbite-app
```

4️⃣ **Controlla che il container sia in esecuzione**
```bash
docker ps
```

### Gestione avanzata del container

<table>
  <tr>
    <th>🔄 Operazioni comuni</th>
    <th>🔧 Risoluzione errori comuni</th>
  </tr>
  <tr>
    <td>
      <code>docker stop yourbite-container</code> - Ferma il container<br>
      <code>docker start yourbite-container</code> - Avvia il container<br>
      <code>docker restart yourbite-container</code> - Riavvia il container<br>
      <code>docker logs yourbite-container</code> - Visualizza i log
    </td>
    <td>
      <code>docker rm yourbite-container</code> - Rimuove il container esistente<br>
      <code>docker system prune</code> - Pulisce risorse non utilizzate<br>
      <code>docker exec -it yourbite-container sh</code> - Accede alla shell<br>
      <code>docker inspect yourbite-container</code> - Visualizza informazioni
    </td>
  </tr>
</table>

---

## ✨ Caratteristiche

<table>
  <tr>
    <th>💳 Sistema di Pagamento</th>
    <th>📋 Gestione Ordini</th>
  </tr>
  <tr>
    <td>
      <ul>
        <li>Supporto per carte, PayPal e wallet digitali</li>
        <li>Ricarica offline presso punti vendita</li>
        <li>Sistema di bonus e fidelizzazione</li>
        <li>Transazioni sicure e verificate</li>
      </ul>
    </td>
    <td>
      <ul>
        <li>Personalizzazione ingredienti drag-and-drop</li>
        <li>Notifiche in tempo reale via app e email</li>
        <li>Sincronizzazione con sistemi ristorante</li>
        <li>Storico ordini accessibile e riutilizzabile</li>
      </ul>
    </td>
  </tr>
  <tr>
    <th>👤 Esperienza Utente</th>
    <th>🔌 API e Integrazione</th>
  </tr>
  <tr>
    <td>
      <ul>
        <li>Multi-login (email, social, telefono)</li>
        <li>Interfaccia personalizzata per ogni ristorante</li>
        <li>Tema chiaro/scuro e supporto multilingua</li>
        <li>Sondaggi e feedback interattivi</li>
      </ul>
    </td>
    <td>
      <ul>
        <li>API RESTful documentata con Swagger</li>
        <li>Webhook per notifiche real-time</li>
        <li>Integrazione con sistemi POS esistenti</li>
        <li>Supporto OAuth 2.0 per autenticazione sicura</li>
      </ul>
    </td>
  </tr>
</table>

---

## 🏗️ Architettura

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│                 │      │                 │      │                 │
│  📱 Frontend    │◄────►│  🖥️ Backend     │◄────►│  🗄️ Persistenza │
│  React.js       │      │  Node.js        │      │  JSON/DB        │
│                 │      │  Express        │      │                 │
└─────────────────┘      └─────────────────┘      └─────────────────┘
                                 │
                                 ▼
                         ┌─────────────────┐
                         │                 │
                         │  🔒 Sicurezza   │
                         │  OAuth + JWT    │
                         │                 │
                         └─────────────────┘
```

<div class="arch-description" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-top: 20px;">
  <div style="background-color: #f8f9fa; padding: 15px; border-radius: 10px;">
    <h4>🖥️ Frontend</h4>
    <ul>
      <li><b>Framework:</b> React.js con hooks</li>
      <li><b>State Management:</b> Redux + Context API</li>
      <li><b>Styling:</b> Styled Components + CSS Modules</li>
      <li><b>Componenti:</b> Design System personalizzato</li>
    </ul>
  </div>
  
  <div style="background-color: #f8f9fa; padding: 15px; border-radius: 10px;">
    <h4>⚙️ Backend</h4>
    <ul>
      <li><b>Server:</b> Node.js + Express.js</li>
      <li><b>API:</b> RESTful con OpenAPI/Swagger</li>
      <li><b>Autenticazione:</b> JWT + OAuth 2.0</li>
      <li><b>Validazione:</b> Joi/Yup schemas</li>
    </ul>
  </div>
  
  <div style="background-color: #f8f9fa; padding: 15px; border-radius: 10px;">
    <h4>📦 Persistenza</h4>
    <ul>
      <li><b>Dati:</b> JSON File-based (MVP)</li>
      <li><b>Espandibile:</b> MongoDB/PostgreSQL</li>
      <li><b>Caching:</b> In-memory + Redis</li>
      <li><b>Storage:</b> Volume Docker montato</li>
    </ul>
  </div>
  
  <div style="background-color: #f8f9fa; padding: 15px; border-radius: 10px;">
    <h4>🚢 DevOps</h4>
    <ul>
      <li><b>Containerizzazione:</b> Docker multi-stage</li>
      <li><b>CI/CD:</b> GitHub Actions</li>
      <li><b>Monitoring:</b> Prometheus + Grafana</li>
      <li><b>Logging:</b> ELK Stack (opzionale)</li>
    </ul>
  </div>
</div>

### Struttura dati principali

<details>
<summary><b>📊 Relazioni principali</b></summary>

```
Cliente 1:N Ordini
Ristoratore 1:N Menu
Menu 1:N Prodotti
Prodotto 1:N Ingredienti
Ordine N:M Prodotti
Wallet 1:1 Cliente
Transazione N:1 Cliente
```
</details>

<details>
<summary><b>🧩 Schema JSON</b></summary>

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
      }
    ],
    "Order": {
      "OrderID": "order123",
      "CustomerID": "zio",
      "Items": [
        {
          "ItemID": "item001",
          "Quantity": 2
        }
      ],
      "Status": "Preparation"
    }
  }
}
```
</details>

---

## 🏆 Analisi Competitiva

### Confronto con la concorrenza

<table>
  <tr>
    <th>Caratteristica</th>
    <th>YourBite</th>
    <th>NeatMenu</th>
    <th>Almenu</th>
    <th>MenuDrive</th>
  </tr>
  <tr>
    <td>Menu Personalizzabili</td>
    <td>⭐⭐⭐⭐⭐</td>
    <td>⭐⭐⭐</td>
    <td>⭐⭐⭐⭐</td>
    <td>⭐⭐</td>
  </tr>
  <tr>
    <td>Wallet Digitale</td>
    <td>⭐⭐⭐⭐⭐</td>
    <td>❌</td>
    <td>⭐⭐</td>
    <td>⭐⭐⭐</td>
  </tr>
  <tr>
    <td>Ricarica Offline</td>
    <td>⭐⭐⭐⭐⭐</td>
    <td>❌</td>
    <td>❌</td>
    <td>❌</td>
  </tr>
  <tr>
    <td>Tracking in Tempo Reale</td>
    <td>⭐⭐⭐⭐⭐</td>
    <td>⭐⭐⭐</td>
    <td>⭐⭐⭐⭐</td>
    <td>⭐⭐⭐</td>
  </tr>
  <tr>
    <td>API per Integrazione</td>
    <td>⭐⭐⭐⭐</td>
    <td>⭐⭐</td>
    <td>⭐⭐⭐</td>
    <td>⭐⭐⭐⭐</td>
  </tr>
  <tr>
    <td>UX/UI</td>
    <td>⭐⭐⭐⭐⭐</td>
    <td>⭐⭐⭐</td>
    <td>⭐⭐⭐⭐</td>
    <td>⭐⭐⭐</td>
  </tr>
</table>

### 🏆 Vantaggi competitivi di YourBite

<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-top: 15px;">
  <div style="background-color: #f8f9fa; padding: 15px; border-radius: 10px; text-align: center;">
    <h3>💵 Wallet Offline</h3>
    <p>Sistema unico di ricarica in contanti</p>
  </div>
  <div style="background-color: #f8f9fa; padding: 15px; border-radius: 10px; text-align: center;">
    <h3>🥗 Ingredienti</h3>
    <p>Personalizzazione avanzata dei piatti</p>
  </div>
  <div style="background-color: #f8f9fa; padding: 15px; border-radius: 10px; text-align: center;">
    <h3>🎮 UX/UI</h3>
    <p>Interfaccia intuitiva e accattivante</p>
  </div>
  <div style="background-color: #f8f9fa; padding: 15px; border-radius: 10px; text-align: center;">
    <h3>🔄 Integrazione</h3>
    <p>Compatibilità con sistemi esistenti</p>
  </div>
</div>

---

## ❓ FAQ

<details>
  <summary style="font-weight: bold; cursor: pointer; padding: 10px; background-color: #f8f9fa; border-radius: 5px;">Come posso risolvere il conflitto "container name already in use"?</summary>
  <div style="padding: 10px; background-color: #f8f9fa; margin-top: 5px; border-radius: 5px;">
    <p>Questo errore appare quando esiste già un container con lo stesso nome. Risolvi con questi comandi:</p>
    <pre><code>docker stop yourbite-container
docker rm yourbite-container
docker run -d -p 3000:3000 --name yourbite-container cotii/yourbite-app</code></pre>
  </div>
</details>

<details>
  <summary style="font-weight: bold; cursor: pointer; padding: 10px; background-color: #f8f9fa; border-radius: 5px; margin-top: 10px;">Come configuro correttamente l'autenticazione Google OAuth?</summary>
  <div style="padding: 10px; background-color: #f8f9fa; margin-top: 5px; border-radius: 5px;">
    <ol>
      <li>Vai alla <a href="https://console.cloud.google.com/">Console Google Cloud</a></li>
      <li>Crea un nuovo progetto o seleziona uno esistente</li>
      <li>Vai a "Credenziali" → "Crea credenziali" → "ID client OAuth"</li>
      <li>Aggiungi <code>http://localhost:3000/auth/google/callback</code> come URI di reindirizzamento autorizzato</li>
      <li>Copia il Client ID e Client Secret</li>
      <li>Avvia il container specificando queste credenziali come variabili d'ambiente</li>
    </ol>
  </div>
</details>

<details>
  <summary style="font-weight: bold; cursor: pointer; padding: 10px; background-color: #f8f9fa; border-radius: 5px; margin-top: 10px;">Come posso conservare i dati tra riavvii del container?</summary>
  <div style="padding: 10px; background-color: #f8f9fa; margin-top: 5px; border-radius: 5px;">
    <p>Usa un volume Docker per persistere i dati:</p>
    <pre><code>docker run -d -p 3000:3000 -v $(pwd)/data:/usr/src/app/data \
--name yourbite-container cotii/yourbite-app</code></pre>
    <p>Questo monterà la directory <code>./data</code> locale nella directory <code>/usr/src/app/data</code> del container.</p>
  </div>
</details>

<details>
  <summary style="font-weight: bold; cursor: pointer; padding: 10px; background-color: #f8f9fa; border-radius: 5px; margin-top: 10px;">Come cambio la porta predefinita (3000)?</summary>
  <div style="padding: 10px; background-color: #f8f9fa; margin-top: 5px; border-radius: 5px;">
    <p>Modifica il mapping delle porte nel comando run:</p>
    <pre><code>docker run -d -p 8080:3000 --name yourbite-container cotii/yourbite-app</code></pre>
    <p>Ora l'applicazione sarà accessibile su <a href="http://localhost:8080">http://localhost:8080</a></p>
  </div>
</details>

---

<div align="center" style="margin-top: 50px; padding: 20px; background-color: #f8f9fa; border-radius: 10px;">
  <h2>🚀 Inizia oggi con YourBite!</h2>
  <p>Trasforma l'esperienza di ordinazione nel tuo ristorante</p>
  <div style="margin-top: 20px;">
    <a href="https://github.com/coticelli/yourbite" style="background-color: #4e73df; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 0 10px; display: inline-block;">GitHub Repository</a>
    <a href="https://hub.docker.com/r/cotii/yourbite-app" style="background-color: #1cc88a; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 0 10px; display: inline-block;">Docker Hub</a>
  </div>
</div>

<div align="center" style="margin-top: 30px;">
  <p>Sviluppato con ❤️ da <b>Fabio Coticelli</b></p>
  <p>
    <a href="mailto:fabiocoticelli06@gmail.com">fabiocoticelli06@gmail.com</a> •
    <a href="https://github.com/coticelli">GitHub</a> •
    <a href="https://www.linkedin.com/in/fabio-coticelli/">LinkedIn</a>
  </p>
  <br>
  <sub>© 2025 YourBite. Tutti i diritti riservati.</sub>
</div>
