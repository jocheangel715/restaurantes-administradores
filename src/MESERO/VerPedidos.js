import React, { useEffect, useState, useRef } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import Detalles from './Detalles'; // Import Detalles component
import './VerPedidos.css';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { getAuth, onAuthStateChanged } from 'firebase/auth'; // Import getAuth and onAuthStateChanged

const formatPrice = (value) => {
  if (value === null || value === undefined || value === '') return '0';
  const stringValue = value.toString();
  const numberValue = parseFloat(stringValue.replace(/[$,]/g, ''));
  return `$${numberValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};

const VerPedidos = () => {
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null); // State for selected order
  const [period, setPeriod] = useState('MORNING'); // State for selected period
  const [userId, setUserId] = useState(''); // State for user ID
  const [statusCounts, setStatusCounts] = useState({}); // State for order status counts
  const ordersListRef = useRef(null); // Ref for orders list

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
          const filteredItems = items.filter(item => item.status !== 'ENTREGADOs' && item.tableNumber); // Filter by status and tableNumber
          filteredItems.sort((a, b) => (b.timestamp && b.timestamp.toDate()) - (a.timestamp && a.timestamp.toDate())); // Sort by timestamp
          setOrders(filteredItems);

          // Calculate status counts
          const counts = items.reduce((acc, item) => {
            acc[item.status] = (acc[item.status] || 0) + 1;
            return acc;
          }, {});
          setStatusCounts(counts);
        } else {
          // No such document
        }
      });

      return () => unsubscribe();
    };

    fetchOrders();
  }, [period, userId]);

  useEffect(() => {
    const ordersList = ordersListRef.current;
    if (ordersList) {
      const handleWheel = (event) => {
        if (event.deltaY !== 0) {
          event.preventDefault();
          ordersList.scrollTop += event.deltaY;
        }
      };
      ordersList.addEventListener('wheel', handleWheel);
      return () => ordersList.removeEventListener('wheel', handleWheel);
    }
  }, []);

  const handleOrderClick = (order) => {
    setSelectedOrder(order);
    console.log('Order ID:', order.id); // Log the order ID
  };

  const handlePeriodChange = (e) => {
    setPeriod(e.target.value);
  };

  return (
    <div className="verpedidos-container-unique">
      <ToastContainer />
      <h2>Pedidos Recientes</h2>
      <div className="status-summary-unique">
        {Object.entries(statusCounts).map(([status, count]) => (
          <span key={status}>{count} {status.replace(/([A-Z])/g, ' $1').toUpperCase()}</span>
        ))}
      </div>
      <div className="period-select-unique">
        <label htmlFor="period">Seleccionar Periodo:</label>
        <select id="period" className="period-select-dropdown-unique" value={period} onChange={handlePeriodChange}>
          <option value="MORNING">MORNING</option>
          <option value="NIGHT">NIGHT</option>
        </select>
      </div>
      <div className="verpedidos-orders-list-unique" ref={ordersListRef}>
        {orders.map((order) => {
          let statusClass = '';
          switch (order.status) {
            case 'PEDIDOTOMADO':
              statusClass = 'pedido-tomado-unique';
              break;
            case 'ENCOCINA':
              statusClass = 'en-cocina-unique';
              break;
            case 'EMPACADO':
              statusClass = 'empacado-unique';
              break;
            case 'ENDOMICILIO':
              statusClass = 'domicilio-unique';
              break;
            default:
              break;
          }
          return (
            <div
              key={order.id}
              className={`verpedidos-order-item-unique ${statusClass}`}
              onClick={() => handleOrderClick(order)}
            >
              <h3>Pedido #{order.idPedido}</h3>
              <p><strong>Mesa:</strong> {order.tableNumber}</p>
              <p><strong>Total:</strong> {formatPrice(order.total)}</p> {/* Format total price */}
              <p><strong>Estado:</strong> {order.status}</p>
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
