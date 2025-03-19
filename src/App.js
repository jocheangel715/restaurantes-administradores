import React, { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase'; 
import Login from './LOGIN/login';
import Homepage from './HOMEPAGE/homepage'; // Corrected import
import Carga from './Loada/Carga.js';
import './App.css'; // Assuming you have a CSS file for styling 

function App() {
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
    return <Carga />;
  }

  return (
    <div className="App">
      {user ? <Homepage /> : <Login />}
    </div>
  );
}

export default App;