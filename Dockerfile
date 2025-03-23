FROM node:18

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm install

# Bundle app source
COPY . .
COPY .env /usr/src/app/.

# Expose the port your app runs on
EXPOSE 3000

# Command to run your app
CMD [ "node", "server.js" ]