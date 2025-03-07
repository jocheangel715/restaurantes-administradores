import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom'; // Import Router components
import './index.css';
import Login from './LOGIN/login'; // Import Login component
import Homepage from './HOMEPAGE/homepage'; // Import Homepage component
import reportWebVitals from './reportWebVitals';
import { getAuth, onAuthStateChanged } from "firebase/auth"; // Import Firebase auth functions
import { app, auth } from './firebase'; // Import the initialized Firebase app and auth

const root = ReactDOM.createRoot(document.getElementById('root'));

onAuthStateChanged(auth, (user) => {
  root.render(
    <React.StrictMode>
      <Router>
        <Routes>
          {user ? (
            <>
              <Route path="/homepage" element={<Homepage />} />
              <Route path="/" element={<Homepage />} /> {/* Default route */}
            </>
          ) : (
            <>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<Login />} /> {/* Default route */}
            </>
          )}
        </Routes>
      </Router>
    </React.StrictMode>
  );
});

reportWebVitals();
