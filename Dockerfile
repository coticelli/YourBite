FROM node:18-alpine

WORKDIR /usr/src/app

# Copia i file di configurazione del progetto
COPY package*.json ./

# Installa le dipendenze
RUN npm install

# Copia il codice sorgente
COPY . .

# Esponi la porta su cui l'app ascolterà
EXPOSE 3000

# Comando per avviare l'applicazione
CMD ["node", "server.js"]