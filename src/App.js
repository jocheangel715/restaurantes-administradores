import React, { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase'; 
import { getFirestore, doc, getDoc } from 'firebase/firestore'; // Import Firestore functions
import Login from './LOGIN/login';
import Homepage from './HOMEPAGE/homepage'; // Corrected import
import HomepageMesero from './HOMEPAGE/homepageMesero'; // Corrected import
import Carga from './Loada/Carga.js';
import './App.css'; // Assuming you have a CSS file for styling 

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false); // State to check if user is admin

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        const db = getFirestore();
        const adminDocRef = doc(db, 'ADMINISTRADORES', user.email);
        const adminDoc = await getDoc(adminDocRef);
        setIsAdmin(adminDoc.exists());
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return <Carga />;
  }

  return (
    <div className="App">
      {user ? (isAdmin ? <Homepage /> : <HomepageMesero />) : <Login />}
    </div>
  );
}

export default App;