# My Fullstack Application

## Overview
This project is a fullstack application that includes both a backend and a frontend. The backend is built using TypeScript and handles user authentication, session management, and database interactions. The frontend is developed using Vue.js and provides interfaces for both admin and user functionalities.

## Project Structure
```
my-fullstack-app
├── src
│   ├── app.ts                # Entry point of the application
│   ├── config
│   │   └── env.ts           # Environment variable configuration
│   ├── db
│   │   ├── mock
│   │   │   ├── utente.ts    # Mock user data implementation
│   │   │   ├── ruoli.ts     # Mock roles implementation
│   │   │   └── profili.ts   # Mock profiles implementation
│   │   └── real
│   │       ├── utente.ts    # Real user data implementation
│   │       ├── ruoli.ts     # Real roles implementation
│   │       └── profili.ts   # Real profiles implementation
│   ├── auth
│   │   ├── session.ts       # User session management
│   │   ├── login.ts         # User login handling
│   │   ├── logout.ts        # User logout handling
│   │   └── googleAuth.ts    # Google authentication integration
│   ├── frontend
│   │   ├── admin
│   │   │   └── index.vue    # Admin backend interface
│   │   └── user
│   │       └── index.vue    # User frontend interface
│   ├── api
│   │   ├── ajax.ts          # AJAX calls to backend API
│   │   └── query.ts         # SQL query execution
│   └── integrations
│       ├── swagger.ts       # Swagger API documentation integration
│       └── websocket.ts      # WebSocket integration for real-time features
├── package.json              # npm configuration file
├── tsconfig.json             # TypeScript configuration file
├── .env                      # Environment variables
└── README.md                 # Project documentation
```

## Setup Instructions
1. Clone the repository:
   ```
   git clone <repository-url>
   cd my-fullstack-app
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Configure environment variables:
   - Create a `.env` file in the root directory and add the necessary environment variables (e.g., database connection strings, API keys).

4. Run the application:
   ```
   npm start
   ```

## Usage
- Access the admin backend at `/admin` and the user frontend at `/user`.
- The application supports user authentication, session management, and real-time features through WebSocket.

## API Documentation
API endpoints are documented using Swagger. Access the documentation at `/api-docs` after starting the application.

## Real-time Features
The application includes a visitor counter that updates in real-time using WebSocket integration.

## Contributing
Contributions are welcome! Please submit a pull request or open an issue for any enhancements or bug fixes.