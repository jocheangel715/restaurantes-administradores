import React, { useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { FaSignOutAlt, FaPlus } from 'react-icons/fa'; // Import React Icons
import './homepageMesero.css';
import PedidoMesero from '../MESERO/PedidoMesero'; // Import PedidoMesero component
import VerPedidos from '../MESERO/VerPedidos'; // Import VerPedidos component
import { getFirestore, collection, query, where, getDocs, doc, onSnapshot } from 'firebase/firestore';

const HomepageMesero = () => {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [userId, setUserId] = useState('');
  const [balance, setBalance] = useState({ EFECTIVO: 0, NEQUI: 0, total: 0 });
  const [pedidoModalVisible, setPedidoModalVisible] = useState(false);
  const [period, setPeriod] = useState('MORNING'); // Add state for selected period

  const determineDateAndShift = () => {
    const now = new Date();
    let date = `${now.getDate()}-${now.getMonth() + 1}-${now.getFullYear()}`;
    let period = 'MORNING';

    const hours = now.getHours();
    if (hours >= 17 || hours < 3) {
      period = 'NIGHT';
      if (hours < 3) {
        const previousDay = new Date(now);
        previousDay.setDate(now.getDate() - 1);
        date = `${previousDay.getDate()}-${previousDay.getMonth() + 1}-${previousDay.getFullYear()}`;
      }
    } else if (hours >= 3 && hours < 6) {
      period = 'NIGHT';
      const previousDay = new Date(now);
      previousDay.setDate(now.getDate() - 1);
      date = `${previousDay.getDate()}-${previousDay.getMonth() + 1}-${previousDay.getFullYear()}`;
    }

    return { date, period };
  };

  const fetchUserData = async (user) => {
    try {
      const db = getFirestore();
      const q = query(collection(db, 'EMPLEADOS'), where('email', '==', user.email));
      const querySnapshot = await getDocs(q);
      querySnapshot.forEach(async (docSnapshot) => {
        const data = docSnapshot.data();
        setName(data.name);
        setUserId(data.id);
        console.log('User ID:', data.id);

        const { date } = determineDateAndShift(); // Use selected period
        const balanceDocRef = doc(db, 'DOMICILIOS', date);

        onSnapshot(balanceDocRef, (balanceDoc) => {
          if (balanceDoc.exists()) {
            const periodData = balanceDoc.data()[data.id] ? balanceDoc.data()[data.id][period] : null; // Fetch balance for selected period
            const balanceData = periodData && periodData.balance ? periodData.balance : { EFECTIVO: 0, NEQUI: 0 };
            const EFECTIVO = balanceData.EFECTIVO || 0;
            const NEQUI = balanceData.NEQUI || 0;
            const total = EFECTIVO + NEQUI;
            setBalance({ EFECTIVO, NEQUI, total });
          } else {
            console.error('No balance document found');
          }
        });
      });
    } catch (error) {
      console.error('Error fetching user data: ', error);
    }
  };

  useEffect(() => {
    const auth = getAuth();
    onAuthStateChanged(auth, (user) => {
      if (user) {
        const emailWithoutAt = user.email.split('@')[0];
        setEmail(emailWithoutAt);
        fetchUserData(user); // Fetch user data when authenticated
      }
    });

    const { date } = determineDateAndShift();
    console.log(`Current date: ${date}, Current period: ${period}`);
  }, [period]); // Add period to dependency array

  const handleLogout = () => {
    const auth = getAuth();
    signOut(auth).then(() => {
      localStorage.removeItem('email');
      localStorage.removeItem('password');
      window.location.href = '/restaurantes-administradores';
    }).catch((error) => {
      console.error('Error signing out: ', error);
    });
  };

  const handleCreateOrder = () => {
    setPedidoModalVisible(true);
  };

  const closePedidoModal = () => {
    setPedidoModalVisible(false);
  };

  const handlePeriodChange = (e) => {
    setPeriod(e.target.value); // Update selected period
  };

  const formatPrice = (value) => {
    if (value === null || value === undefined || value === '') return '0';
    const stringValue = value.toString();
    const numberValue = parseFloat(stringValue.replace(/[$,]/g, ''));
    return `$${numberValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="home-container">
      <div className="header-container">
        <button className="logout-button" onClick={handleLogout}>
          <FaSignOutAlt />
        </button>
        <h1 className="welcome-message">Bienvenido {email}</h1>
      </div>
      <div className="balance">
        <p className="balance">EFECTIVO: {formatPrice(balance.EFECTIVO)}</p>
        <p className="balance">NEQUI: {formatPrice(balance.NEQUI)}</p>
        <p className="balance">Total: {formatPrice(balance.total)}</p>
        <button className="crear-button" onClick={handleCreateOrder}>
          <FaPlus /> Crear Pedido
        </button>
      </div>
    
      <div className="orders">
        <div>
          <VerPedidos setParentPeriod={setPeriod} /> {/* Pass setPeriod to VerPedidos */}
        </div>
      </div>
      {pedidoModalVisible && <PedidoMesero modalVisible={pedidoModalVisible} closeModal={closePedidoModal} />}
    </div>
  );
};

export default HomepageMesero;