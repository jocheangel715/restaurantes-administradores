import React, { useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { FaSignOutAlt, FaPlus } from 'react-icons/fa'; // Import React Icons
import './homepageMesero.css';
import PedidoMesero from '../MESERO/PedidoMesero'; // Import PedidoMesero component
import VerPedidos from '../MESERO/VerPedidos'; // Import VerPedidos component

const HomepageMesero = () => {
  const [email, setEmail] = useState('');
  const [pedidoModalVisible, setPedidoModalVisible] = useState(false);

  useEffect(() => {
    const auth = getAuth();
    onAuthStateChanged(auth, (user) => {
      if (user) {
        const emailWithoutAt = user.email.split('@')[0];
        setEmail(emailWithoutAt);
      }
    });
  }, []);

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

  return (
    <div className="parent">
      <div className="div1">
        <button className="logout-button-mesero" onClick={handleLogout}>
          <FaSignOutAlt />
        </button>
        <h1 className="welcome-message-mesero">Bienvenido {email}</h1>
      </div>
      <div className="div2">
        <button className="create-order-button-mesero" onClick={handleCreateOrder}>
          <FaPlus /> Crear Pedido
        </button>
      </div>
      <div className="div3">
        <div className="verpedidos-container-unique">
          <VerPedidos /> {/* Ensure VerPedidos component is rendered inside the container */}
        </div>
      </div>
      {pedidoModalVisible && <PedidoMesero modalVisible={pedidoModalVisible} closeModal={closePedidoModal} />}
    </div>
  );
};

export default HomepageMesero;