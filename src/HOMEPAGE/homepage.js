import React, { useEffect, useState } from 'react';
import { getAuth, signOut } from "firebase/auth";
import { app } from '../firebase';
import './homepage.css';
import { FaSignOutAlt, FaBoxOpen, FaUsers, FaMapMarkerAlt, FaTruck, FaUtensils, FaClipboardList, FaClock } from 'react-icons/fa'; // Import FaClock icon
import Inventory from '../INVENTARIO/Inventory';
import Clientes from '../CLIENTES/Clientes';
import Barrios from '../BARRIOS/Barrios';
import Proveedores from '../PROVEEDORES/Proveedores';
import Productos from '../PRODUCTOS/Productos';
import Pedido from '../PEDIDO/Pedido';
import VerPedidos from '../VERPEDIDOS/VerPedidosprincipal'; // Import VerPedidos component
import Turno from '../TURNO/Turno'; // Import Turno component
import PedidoMesero from '../MESERO/PedidoMesero'; // Import PedidoMesero component
import ExpensesForm from '../EGRESOS/ExpensesForm'; // Import ExpensesForm component

const Homepage = () => {
  const [inventoryModalVisible, setInventoryModalVisible] = useState(false);
  const [clientsModalVisible, setClientsModalVisible] = useState(false);
  const [barriosModalVisible, setBarriosModalVisible] = useState(false);
  const [proveedoresModalVisible, setProveedoresModalVisible] = useState(false);
  const [productosModalVisible, setProductosModalVisible] = useState(false);
  const [pedidoModalVisible, setPedidoModalVisible] = useState(false);
  const [turnoModalVisible, setTurnoModalVisible] = useState(false); // Add state for Turno modal visibility
  const [pedidoMeseroModalVisible, setPedidoMeseroModalVisible] = useState(false); // Add state for PedidoMesero modal visibility
  const [expensesModalVisible, setExpensesModalVisible] = useState(false); // State for expenses modal
  const [userEmail, setUserEmail] = useState('');

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
  const handlePedidoMeseroClick = () => {
    setPedidoMeseroModalVisible(true);
  };

  const handleExpensesClick = () => {
    setExpensesModalVisible(true);
  };

  useEffect(() => {
    const logoutButton = document.getElementById('logout-button');
    const inventoryButton = document.getElementById('inventory-button');
    const clientsButton = document.getElementById('clients-button');
    const barriosButton = document.getElementById('barrios-button');
    const proveedoresButton = document.getElementById('proveedores-button');
    const productosButton = document.getElementById('productos-button');
    const pedidoButton = document.getElementById('pedido-button');
    const turnoButton = document.getElementById('turno-button'); // Get Turno button element
    const mesasButton = document.getElementById('mesas-button'); // Get Mesas button element
    const expensesButton = document.getElementById('expenses-button'); // Get Expenses button element
    const auth = getAuth(app);

    const handleLogout = () => {
      signOut(auth).then(() => {
        window.location.href = '/restaurantes-administradores';
      }).catch((error) => {
        console.error('Error signing out: ', error);
      });
    };

    const handleInventoryClick = () => {
      setInventoryModalVisible(true);
    };

    const handleClientsClick = () => {
      setClientsModalVisible(true);
    };

    const handleBarriosClick = () => {
      setBarriosModalVisible(true);
    };

    const handleProveedoresClick = () => {
      setProveedoresModalVisible(true);
    };

    const handleProductosClick = () => {
      setProductosModalVisible(true);
    };

    const handlePedidoClick = () => {
      setPedidoModalVisible(true);
    };

    const handleTurnoClick = () => {
      setTurnoModalVisible(true);
    };
    

    logoutButton.addEventListener('click', handleLogout);
    inventoryButton.addEventListener('click', handleInventoryClick);
    clientsButton.addEventListener('click', handleClientsClick);
    barriosButton.addEventListener('click', handleBarriosClick);
    proveedoresButton.addEventListener('click', handleProveedoresClick);
    productosButton.addEventListener('click', handleProductosClick);
    pedidoButton.addEventListener('click', handlePedidoClick);
    turnoButton.addEventListener('click', handleTurnoClick);
    mesasButton.addEventListener('click', handlePedidoMeseroClick);
    expensesButton.addEventListener('click', handleExpensesClick);

    // Get the authenticated user's email
    const user = auth.currentUser;
    if (user) {
      const email = user.email.split('@')[0];
      setUserEmail(email);
    }

    return () => {
      logoutButton.removeEventListener('click', handleLogout);
      inventoryButton.removeEventListener('click', handleInventoryClick);
      clientsButton.removeEventListener('click', handleClientsClick);
      barriosButton.removeEventListener('click', handleBarriosClick);
      proveedoresButton.removeEventListener('click', handleProveedoresClick);
      productosButton.removeEventListener('click', handleProductosClick);
      pedidoButton.removeEventListener('click', handlePedidoClick);
      turnoButton.removeEventListener('click', handleTurnoClick);
      mesasButton.removeEventListener('click', handlePedidoMeseroClick);
      expensesButton.removeEventListener('click', handleExpensesClick);
    };
  }, []);

  useEffect(() => {
    const updateTitle = () => {
      if (inventoryModalVisible) {
        document.title = 'Inventario';
      } else if (clientsModalVisible) {
        document.title = 'Empleados';
      } else if (barriosModalVisible) {
        document.title = 'Barrios';
      } else if (proveedoresModalVisible) {
        document.title = 'Proveedores';
      } else if (productosModalVisible) {
        document.title = 'Productos';
      } else if (pedidoModalVisible) {
        document.title = 'Pedido';
      } else if (turnoModalVisible) {
        document.title = 'Turno';
      } else if (pedidoMeseroModalVisible) {
        document.title = 'Mesas';
      } else if (expensesModalVisible) {
        document.title = 'Egresos';
      } else {
        document.title = 'Homepage';
      }
    };

    updateTitle();
  }, [inventoryModalVisible, clientsModalVisible, barriosModalVisible, proveedoresModalVisible, productosModalVisible, pedidoModalVisible, turnoModalVisible, pedidoMeseroModalVisible, expensesModalVisible]);

  useEffect(() => {
    const { date, period } = determineDateAndShift();
    console.log(`Current date: ${date}, Current period: ${period}`);
  }, []);

  const closeInventoryModal = () => setInventoryModalVisible(false);
  const closeClientsModal = () => setClientsModalVisible(false);
  const closeBarriosModal = () => setBarriosModalVisible(false);
  const closeProveedoresModal = () => setProveedoresModalVisible(false);
  const closeProductosModal = () => setProductosModalVisible(false);
  const closePedidoModal = () => setPedidoModalVisible(false);
  const closeTurnoModal = () => setTurnoModalVisible(false);
  const closePedidoMeseroModal = () => setPedidoMeseroModalVisible(false);
  const closeExpensesModal = () => setExpensesModalVisible(false);

  return (
    <div className="dashboard">
      <button id="logout-button" className="classname-logout-button">
        <FaSignOutAlt />
      </button>
      <div className="welcome-container">
        <h1 className="classname-welcome-message">Welcome, {userEmail}</h1>
      </div>
      {inventoryModalVisible && <Inventory modalVisible={inventoryModalVisible} closeModal={closeInventoryModal} />}
      {clientsModalVisible && <Clientes modalVisible={clientsModalVisible} closeModal={closeClientsModal} />}
      {barriosModalVisible && <Barrios modalVisible={barriosModalVisible} closeModal={closeBarriosModal} />}
      {proveedoresModalVisible && <Proveedores modalVisible={proveedoresModalVisible} closeModal={closeProveedoresModal} />}
      {productosModalVisible && <Productos modalVisible={productosModalVisible} closeModal={closeProductosModal} />}
      {pedidoModalVisible && <Pedido modalVisible={pedidoModalVisible} closeModal={closePedidoModal} />}
      {turnoModalVisible && <Turno modalVisible={turnoModalVisible} closeModal={closeTurnoModal} />}
      {pedidoMeseroModalVisible && <PedidoMesero modalVisible={pedidoMeseroModalVisible} closeModal={closePedidoMeseroModal} />}
      {expensesModalVisible && <ExpensesForm modalVisible={expensesModalVisible} closeModal={closeExpensesModal} />}
      <div className="buttons-container">
        <button id="inventory-button" className="classname-inventory-button">
          <FaBoxOpen />
          <span>Inventario</span>
        </button>
        <button id="clients-button" className="classname-clients-button">
          <FaUsers />
          <span>Empleados</span>
        </button>
        <button id="barrios-button" className="classname-barrios-button">
          <FaMapMarkerAlt />
          <span>Barrios</span>
        </button>
        <button id="proveedores-button" className="classname-proveedores-button">
          <FaTruck />
          <span>Proveedores</span>
        </button>
        <button id="productos-button" className="classname-productos-button">
          <FaUtensils />
          <span>Productos</span>
        </button>
        <button id="pedido-button" className="classname-pedido-button">
          <FaClipboardList />
          <span>Pedido</span>
        </button>
        <button id="turno-button" className="classname-turno-button">
          <FaClock />
          <span>Turno</span>
        </button>
        <button id="mesas-button" className="classname-mesas-button" onClick={handlePedidoMeseroClick}>
          <FaClipboardList />
          <span>Mesas</span>
        </button>
        <button id="expenses-button" className="classname-expenses-button" onClick={handleExpensesClick}>
          <FaClipboardList />
          <span>Egresos</span>
        </button>
      </div>
      <div className="verpedidos-container-wrapper">
        <VerPedidos /> {/* Display VerPedidos component */}
      </div>
    </div>
  );
};

export default Homepage;
