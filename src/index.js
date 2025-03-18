import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import './index.css';
import Login from './LOGIN/login';
import Homepage from './HOMEPAGE/homepage';
import reportWebVitals from './reportWebVitals';
import { onAuthStateChanged } from "firebase/auth";
import { auth } from './firebase';

const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return <p>Cargando...</p>; // Puedes reemplazarlo con un spinner
  }

  return (
    <Router>
      <Routes>
        <Route
          path="/restaurantes-administradores"
          element={user ? <Homepage /> : <Login />}
        />
        <Route path="*" element={<Navigate to="/restaurantes-administradores" />} />
      </Routes>
    </Router>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

reportWebVitals();
