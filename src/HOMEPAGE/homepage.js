import React, { useEffect } from 'react';
import { getAuth, signOut } from "firebase/auth"; // Import Firebase auth functions
import { app } from '../firebase'; // Import the initialized Firebase app
import './homepage.css'; // Import CSS for homepage

const Homepage = () => {
  useEffect(() => {
    const logoutButton = document.getElementById('logout-button');
    const auth = getAuth(app); // Use the initialized app to get the auth instance

    const handleLogout = () => {
      signOut(auth).then(() => {
        window.location.href = '/restaurantes-administradores'; 
      }).catch((error) => {
        console.error('Error signing out: ', error);
      });
    };

    logoutButton.addEventListener('click', handleLogout);

    return () => {
      logoutButton.removeEventListener('click', handleLogout);
    };
  }, []);

  // Function to toggle between light and dark themes
  const toggleTheme = (theme) => {
    const themeLink = document.getElementById('theme-link');
    if (themeLink) { // Ensure themeLink exists
      if (theme === 'dark') {
        themeLink.href = '../RESOURCES/THEMES/dark.css';
      } else {
        themeLink.href = '../RESOURCES/THEMES/light.css';
      }
    } else {
      console.error('Theme link element not found');
    }
  };

  useEffect(() => {
    // Ensure the theme link element exists
    let themeLink = document.getElementById('theme-link');
    if (!themeLink) {
      themeLink = document.createElement('link');
      themeLink.id = 'theme-link';
      themeLink.rel = 'stylesheet';
      document.head.appendChild(themeLink);
    }

    // Example usage: toggle to dark theme
    toggleTheme('dark');
  }, []);

  const handleThemeToggle = () => {
    const currentTheme = document.getElementById('theme-link').href.includes('dark.css') ? 'dark' : 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    toggleTheme(newTheme);
  };

  return (
    <div className="homepage-container">
      <h1>Welcome, Admin</h1>
      <button id="logout-button">Logout</button>
      <button onClick={handleThemeToggle}>Toggle Theme</button> {/* Add theme toggle button */}
    </div>
  );
};

export default Homepage;
