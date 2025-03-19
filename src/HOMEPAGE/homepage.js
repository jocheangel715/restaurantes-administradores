import React, { useEffect, useState } from 'react';
import { getAuth, signOut } from "firebase/auth";
import { app } from '../firebase';
import './homepage.css';
import { FaSignOutAlt, FaBoxOpen, FaUsers, FaMapMarkerAlt, FaTruck, FaUtensils, FaClipboardList } from 'react-icons/fa';
import Inventory from '../INVENTARIO/Inventory';
import Clientes from '../CLIENTES/Clientes';
import Barrios from '../BARRIOS/Barrios';
import Proveedores from '../PROVEEDORES/Proveedores';
import Productos from '../PRODUCTOS/Productos';
import Pedido from '../PEDIDO/Pedido';
import VerPedidos from '../VERPEDIDOS/VerPedidos'; // Import VerPedidos component

const Homepage = () => {
  const [inventoryModalVisible, setInventoryModalVisible] = useState(false);
  const [clientsModalVisible, setClientsModalVisible] = useState(false);
  const [barriosModalVisible, setBarriosModalVisible] = useState(false);
  const [proveedoresModalVisible, setProveedoresModalVisible] = useState(false);
  const [productosModalVisible, setProductosModalVisible] = useState(false);
  const [pedidoModalVisible, setPedidoModalVisible] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    const logoutButton = document.getElementById('logout-button');
    const inventoryButton = document.getElementById('inventory-button');
    const clientsButton = document.getElementById('clients-button');
    const barriosButton = document.getElementById('barrios-button');
    const proveedoresButton = document.getElementById('proveedores-button');
    const productosButton = document.getElementById('productos-button');
    const pedidoButton = document.getElementById('pedido-button');
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

    logoutButton.addEventListener('click', handleLogout);
    inventoryButton.addEventListener('click', handleInventoryClick);
    clientsButton.addEventListener('click', handleClientsClick);
    barriosButton.addEventListener('click', handleBarriosClick);
    proveedoresButton.addEventListener('click', handleProveedoresClick);
    productosButton.addEventListener('click', handleProductosClick);
    pedidoButton.addEventListener('click', handlePedidoClick);

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
    };
  }, []);

  const closeInventoryModal = () => setInventoryModalVisible(false);
  const closeClientsModal = () => setClientsModalVisible(false);
  const closeBarriosModal = () => setBarriosModalVisible(false);
  const closeProveedoresModal = () => setProveedoresModalVisible(false);
  const closeProductosModal = () => setProductosModalVisible(false);
  const closePedidoModal = () => setPedidoModalVisible(false);

  return (
    <>
      <button id="logout-button" className="classname-logout-button">
        <FaSignOutAlt />
      </button>
      <div className="dashboard">
        <div className="welcome-container">
          <h1 className="classname-welcome-message">Welcome, {userEmail}</h1>
        </div>
        {inventoryModalVisible && <Inventory modalVisible={inventoryModalVisible} closeModal={closeInventoryModal} />}
        {clientsModalVisible && <Clientes modalVisible={clientsModalVisible} closeModal={closeClientsModal} />}
        {barriosModalVisible && <Barrios modalVisible={barriosModalVisible} closeModal={closeBarriosModal} />}
        {proveedoresModalVisible && <Proveedores modalVisible={proveedoresModalVisible} closeModal={closeProveedoresModal} />}
        {productosModalVisible && <Productos modalVisible={productosModalVisible} closeModal={closeProductosModal} />}
        {pedidoModalVisible && <Pedido modalVisible={pedidoModalVisible} closeModal={closePedidoModal} />}
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
        </div>
        <div className="verpedidos-container-wrapper">
          <VerPedidos /> {/* Display VerPedidos component */}
        </div>
      </div>
    </>
  );
};

export default Homepage;
