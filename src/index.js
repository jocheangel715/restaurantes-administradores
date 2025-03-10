import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom'; // Import Router components
import './index.css';
import Login from './LOGIN/login'; // Import Login component
import Homepage from './HOMEPAGE/homepage'; // Import Homepage component
import reportWebVitals from './reportWebVitals';
import {  onAuthStateChanged } from "firebase/auth"; // Import Firebase auth functions
import { auth } from './firebase'; // Import the initialized Firebase app and auth

const root = ReactDOM.createRoot(document.getElementById('root'));

onAuthStateChanged(auth, (user) => {
  root.render(
    <React.StrictMode>
      <Router>
        <Routes>
          {user ? (
            <>
              <Route path="/restaurantes-administradores" element={<Homepage />} />
              <Route path="/restaurantes-administradores" element={<Homepage />} /> {/* Default route */}
            </>
          ) : (
            <>
              <Route path="/restaurantes-administradores" element={<Login />} />
              <Route path="/restaurantes-administradores" element={<Login />} /> {/* Default route */}
            </>
          )}
        </Routes>
      </Router>
    </React.StrictMode>
  );
});

reportWebVitals();
