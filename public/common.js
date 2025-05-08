// This file contains shared JavaScript functions for both login and signup pages
document.addEventListener('DOMContentLoaded', function() {
    // Check for localStorage preference for sound
    const soundPreference = localStorage.getItem('soundEnabled');
    const soundControl = document.getElementById('soundControl');
    const soundStatus = document.getElementById('soundStatus');
    
    // Maintain sound preference across pages
    if (soundPreference === 'true') {
      initAudio();
      soundEnabled = true;
      soundControl.style.backgroundColor = 'rgba(255, 0, 0, 0.7)';
      soundStatus.textContent = 'Sound On';
      setTimeout(() => {
        startBackgroundSound();
      }, 500);
    }
    
    // Store sound preference in localStorage when toggled
    soundControl.addEventListener('click', function() {
      localStorage.setItem('soundEnabled', soundEnabled);
    });
    
    // Check for page transition from previous page
    if (performance.navigation.type === 1) {
      // This is a reload, no transition
      document.querySelector('.page-transition').style.display = 'none';
    } else {
      // This might be a navigation from another page
      document.querySelector('.page-transition').style.opacity = '1';
      setTimeout(() => {
        document.querySelector('.page-transition').style.opacity = '0';
      }, 100);
    }
  });