import express from 'express';
import { json } from 'body-parser';
import { config } from './config/env';
import { setupRoutes } from './api/ajax';
import { setupSwagger } from './integrations/swagger';
import { setupWebSocket } from './integrations/websocket';
import { sessionMiddleware } from './auth/session';

const app = express();
const PORT = config.PORT || 3000;

// Middleware
app.use(json());
app.use(sessionMiddleware);

// Setup routes
setupRoutes(app);

// Setup Swagger for API documentation
setupSwagger(app);

// Setup WebSocket for real-time features
setupWebSocket(app);

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});