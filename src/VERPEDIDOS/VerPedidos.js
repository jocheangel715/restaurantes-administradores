import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import Detalles from '../RESOURCES/DETALLES/Detalles'; // Import Detalles component
import './VerPedidos.css';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { getAuth, onAuthStateChanged } from 'firebase/auth'; // Import getAuth and onAuthStateChanged

const VerPedidos = () => {
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null); // State for selected order
  const [period, setPeriod] = useState('MORNING'); // State for selected period
  const [userId, setUserId] = useState(''); // State for user ID

  useEffect(() => {
    const fetchUserId = async () => {
      const auth = getAuth();
      onAuthStateChanged(auth, (user) => {
        if (user) {
          setUserId(user.uid);
        }
      });
    };

    fetchUserId();
  }, []);

  useEffect(() => {
    if (!userId) return;

    const fetchOrders = () => {
      const now = new Date();
      const date = `${now.getDate()}-${now.getMonth() + 1}-${now.getFullYear()}`;
      const docId = date;

      const docRef = doc(db, 'PEDIDOS', docId);
      const unsubscribe = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const userOrders = data[period] || {};
          const items = Object.keys(userOrders).filter(key => key !== 'balance').map(key => ({ id: key, ...userOrders[key] }));
          const filteredItems = items.filter(item => item.status !== 'ENTREGADO');
          filteredItems.sort((a, b) => (b.timestamp && b.timestamp.toDate()) - (a.timestamp && a.timestamp.toDate())); // Sort by timestamp
          setOrders(filteredItems);
        } else {
          // No such document
        }
      });

      return () => unsubscribe();
    };

    fetchOrders();
  }, [period, userId]);

  const handleOrderClick = (order) => {
    setSelectedOrder(order);
    console.log('Order ID:', order.id); // Log the order ID
  };

  const handlePeriodChange = (e) => {
    setPeriod(e.target.value);
  };

  return (
    <div className="verpedidos-container">
      <ToastContainer />
      <h2>Pedidos Recientes</h2>
      <div className="period-select">
        <label htmlFor="period">Seleccionar Periodo:</label>
        <select id="period" value={period} onChange={handlePeriodChange}>
          <option value="MORNING">MORNING</option>
          <option value="NIGHT">NIGHT</option>
        </select>
      </div>
      <div className="verpedidos-orders-list">
        {orders.map((order) => {
          let statusClass = '';
          switch (order.status) {
            case 'PEDIDOTOMADO':
              statusClass = 'pedido-tomado';
              break;
            case 'ENCOCINA':
              statusClass = 'en-cocina';
              break;
            case 'ENDOMICILIO':
              statusClass = 'domicilio';
              break;
            default:
              break;
          }
          return (
            <div
              key={order.id}
              className={`verpedidos-order-item ${statusClass}`}
              onClick={() => handleOrderClick(order)}
            >
              <h3>Pedido #{order.idPedido}</h3>
              <p><strong>Cliente:</strong> {order.clientName}</p>
              <p><strong>Teléfono:</strong> {order.clientPhone}</p>
              <p><strong>Dirección:</strong> {order.clientAddress} - {order.clientBarrio}</p>
              <p><strong>Total:</strong> {order.total}</p>
              <p><strong>Estado:</strong> {order.status}</p>
              <p><strong>Fecha:</strong> {order.timestamp ? order.timestamp.toDate().toLocaleString() : 'N/A'}</p>
            </div>
          );
        })}
      </div>

      {/* Modal de detalles del pedido */}
      {selectedOrder && (
        <Detalles
          order={selectedOrder}
          closeModal={() => setSelectedOrder(null)}
          orderId={selectedOrder.id} // Pass the order ID to the Detalles component
        />
      )}
    </div>
  );
};

export default VerPedidos;
