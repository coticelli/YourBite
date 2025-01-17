const express = require('express');
const axios = require('axios');
const router = express.Router();

const APP_ID = '1162998261881771';
const APP_SECRET = '1e01ad5f540721968c5c17c7789c5446';
const REDIRECT_URI = '<http://localhost:3000/auth/facebook/callback>';

// Initiates the Facebook Login flow
router.get('/auth/facebook', (req, res) => {
  const url = `https://www.facebook.com/v13.0/dialog/oauth?client_id=${APP_ID}&redirect_uri=${REDIRECT_URI}&scope=email`;
  res.redirect(url);
});

// Callback URL for handling the Facebook Login response
router.get('/auth/facebook/callback', async (req, res) => {
    const { code } = req.query;
  
    try {
      // Exchange authorization code for an access token
      const { data } = await axios.get(`https://graph.facebook.com/v13.0/oauth/access_token?client_id=${APP_ID}&client_secret=${APP_SECRET}&code=${code}&redirect_uri=${REDIRECT_URI}`);
      const { access_token } = data;
  
      // Fetch user profile data from Facebook
      const { data: profile } = await axios.get(`https://graph.facebook.com/v13.0/me?fields=name,email&access_token=${access_token}`);
  
      // Check if user exists in the database by email
      db.get('SELECT * FROM utenti WHERE email = ?', [profile.email], (err, row) => {
        if (err) {
          console.error('Error during DB query:', err.message);
          return res.status(500).json({ error: 'Server error' });
        }
  
        if (row) {
          // User exists, create a session
          req.session.user = { id: row.id, username: row.username, email: row.email };
          res.redirect('/homepage_cliente.html'); // Redirect after successful login
        } else {
          // User doesn't exist, create new user and session
          db.run(`INSERT INTO utenti (username, email, password, tipo) VALUES (?, ?, ?, ?)`,
            [profile.name, profile.email, '', 'cliente'], function (err) {
              if (err) {
                console.error('Error inserting new user:', err.message);
                return res.status(500).json({ error: 'Error during registration' });
              }
  
              req.session.user = { id: this.lastID, username: profile.name, email: profile.email };
              res.redirect('/homepage_cliente.html'); // Redirect to homepage after registration
            });
        }
      });
    } catch (error) {
      console.error('Error during Facebook login:', error);
      res.redirect('/login');
    }
  });
  
// Logout route
router.get('/logout', (req, res) => {
    req.session.destroy(err => {
      if (err) {
        return res.status(500).json({ error: 'Could not log out.' });
      }
      res.redirect('/login');
    });
  });
  
module.exports = router;