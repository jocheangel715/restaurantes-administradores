import React, { useState, useEffect } from 'react'; // Import React and hooks
import { getAuth, signInWithEmailAndPassword, setPersistence, browserLocalPersistence } from "firebase/auth"; // Import Firebase authentication methods
import { useNavigate } from 'react-router-dom'; // Import useNavigate for redirection
import './login.css'; // Import CSS for styling

const Login = () => {
  const [email, setEmail] = useState(''); // State for email input
  const [password, setPassword] = useState(''); // State for password input
  const [error, setError] = useState(''); // State for error messages
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light'); // Load theme from local storage or default to 'light'
  const navigate = useNavigate(); // Initialize useNavigate for redirection
  const [dark, setDark] = useState(theme === 'dark'); // State for dark theme based on current theme

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme); // Set the theme attribute on the document element
    localStorage.setItem('theme', theme); // Save the current theme to local storage
  }, [theme]); // Run this effect whenever the theme changes

  const handleLogin = async (e) => {
    e.preventDefault(); // Prevent the default form submission behavior
    const auth = getAuth(); // Get the Firebase auth instance
    try {
      await setPersistence(auth, browserLocalPersistence); // Set persistence to 30 days
      await signInWithEmailAndPassword(auth, email, password); // Sign in with email and password
      navigate('/'); // Redirect to homepage after successful login
    } catch (err) {
      setError(err.message); // Set error message if login fails
    }
  };

  const toggleTheme = () => {
    const newTheme = dark ? 'light' : 'dark'; // Toggle between light and dark themes
    setTheme(newTheme); // Update the theme state
    setDark(!dark); // Update the dark state
  };

  return (
    <div className="login-container"> {/* Container for the login form */}
      <button className={dark ? 'dark' : 'light'} onClick={toggleTheme}> {/* Button to toggle theme */}
        Switch to {dark ? 'dark' : 'light'} Theme {/* Button text */}
      </button>
      <form onSubmit={handleLogin}> {/* Form submission handler */}
        <h2>Login</h2> {/* Form title */}
        {error && <p className="error">{error}</p>} {/* Display error message if any */}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        /> {/* Email input field */}
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        /> {/* Password input field */}
        <button type="submit">Login</button> {/* Submit button */}
      </form>
    </div>
  );
};

export default Login; // Export the Login component
