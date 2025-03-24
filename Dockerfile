FROM node:18-alpine

# Crea la directory dell'applicazione
WORKDIR /usr/src/app

# Copia package.json e package-lock.json
COPY package*.json ./

# Installa le dipendenze
RUN npm install

# Copia il resto dell'applicazione
COPY . .

# Esponi la porta su cui l'app è in ascolto
EXPOSE 3000

# Comando per avviare l'applicazione
CMD ["node", "server.js"]