import express from 'express';
import swaggerJsDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const router = express.Router();

// Swagger definition
const swaggerOptions = {
    swaggerDefinition: {
        openapi: '3.0.0',
        info: {
            title: 'My Fullstack App API',
            version: '1.0.0',
            description: 'API documentation for My Fullstack App',
        },
        servers: [
            {
                url: 'http://localhost:3000',
            },
        ],
    },
    apis: ['./src/api/*.ts'], // Path to the API docs
};

// Initialize swagger-jsdoc
const swaggerDocs = swaggerJsDoc(swaggerOptions);

// Setup Swagger UI
router.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

export default router;