import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import './index.css'; // Import your global CSS here

// Render the App component into the root div
ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root') // Ensure this ID matches your HTML
);
