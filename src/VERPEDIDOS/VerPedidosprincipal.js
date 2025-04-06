import React, { useEffect, useState, useRef } from 'react';
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
  const [statusCounts, setStatusCounts] = useState({}); // State for order status counts
  const ordersListRef = useRef(null); // Ref for orders list
  const [selectedStatuses, setSelectedStatuses] = useState([]); // State for selected statuses

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

  useEffect(() => {
    if (!userId) return;

    const fetchOrders = () => {
      const { date, period } = determineDateAndShift();
      const docId = date;

      const docRef = doc(db, 'PEDIDOS', docId);
      const unsubscribe = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const userOrders = data[period] || {};
          const items = Object.keys(userOrders)
            .filter(key => key !== 'balance')
            .map(key => ({ id: key, ...userOrders[key] }));
          const filteredItems = items.filter(item => item.status !== 'ENTREGADOs'); // Include all orders
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
          ordersList.scrollLeft += event.deltaY;
        }
      };
      ordersList.addEventListener('wheel', handleWheel);
      return () => ordersList.removeEventListener('wheel', handleWheel);
    }
  }, []);

  useEffect(() => {
    // Automatically select all statuses if "TOTAL PEDIDOS" is selected
    const allStatuses = [...new Set(orders.map((order) => order.status))];
    if (
      selectedStatuses.length > 0 &&
      selectedStatuses.length === allStatuses.length
    ) {
      setSelectedStatuses(allStatuses);
    }
  }, [orders]);

  const handleOrderClick = (order) => {
    setSelectedOrder(order);
    console.log('Order ID:', order.id); // Log the order ID
  };

  const handlePeriodChange = (e) => {
    setPeriod(e.target.value);
  };

  const handleStatusChange = (status) => {
    setSelectedStatuses((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status]
    );
  };

  const handleTotalCheckboxChange = () => {
    const allStatuses = [...new Set(orders.map((order) => order.status))];
    if (selectedStatuses.length === allStatuses.length) {
      setSelectedStatuses([]); // Deselect all
    } else {
      setSelectedStatuses(allStatuses); // Select all unique statuses
    }
  };

  const filteredOrders = orders.filter((order) =>
    selectedStatuses.length > 0 && selectedStatuses.includes(order.status)
  );

  const formatPrice = (value) => {
    if (value === null || value === undefined || value === '') return '0';
  
    const numberValue = parseFloat(value.toString().replace(/[$,]/g, ''));
  
    if (isNaN(numberValue)) return '0';
  
    return `$${numberValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="verpedidos-container">
      <ToastContainer />
      <h2>Pedidos Recientes</h2>
      <div className="status-summary">
        <span onClick={handleTotalCheckboxChange} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={
              selectedStatuses.length > 0 &&
              selectedStatuses.length === [...new Set(orders.map((order) => order.status))].length
            }
            onChange={handleTotalCheckboxChange}
          />
          <span style={{ marginLeft: '5px' }}>{orders.length} TOTAL PEDIDOS</span>
        </span>
        {Object.entries(statusCounts).map(([status, count]) => (
          <span
            key={status}
            onClick={() => handleStatusChange(status)}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          >
            <input
              type="checkbox"
              checked={selectedStatuses.includes(status)}
              onChange={() => handleStatusChange(status)}
            />
            <span style={{ marginLeft: '5px' }}>
              {count} {status.replace(/([A-Z])/g, ' $1').toUpperCase()}
            </span>
          </span>
        ))}
      </div>
      <div className="period-select">
        <label htmlFor="period">Seleccionar Periodo:</label>
        <select id="period" className="period-select-dropdown" value={period} onChange={handlePeriodChange}>
          <option value="MORNING">MORNING</option>
          <option value="NIGHT">NIGHT</option>
        </select>
      </div>
      <div className="verpedidos-orders-list" ref={ordersListRef}>
        {filteredOrders.map((order) => {
          let statusClass = '';
          switch (order.status) {
            case 'PEDIDOTOMADO':
              statusClass = 'pedido-tomado';
              break;
            case 'ENCOCINA':
              statusClass = 'en-cocina';
              break;
            case 'EMPACADO':
              statusClass = 'EMPACADO';
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
              {order.tableNumber && <p><strong>Mesa:</strong> {order.tableNumber}</p>} {/* Display table number if available */}
              <p><strong>Cliente:</strong> {order.clientName}</p>
              <p><strong>Teléfono:</strong> {order.clientPhone}</p>
              <p><strong>Dirección:</strong> {order.clientAddress} - {order.clientBarrio}</p>
              <p><strong>Total:</strong> {formatPrice(order.total)}</p>
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