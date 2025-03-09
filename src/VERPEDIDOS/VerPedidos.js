import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, limit, startAfter, onSnapshot } from 'firebase/firestore';
import Detalles from '../RESOURCES/DETALLES/Detalles'; // Import Detalles component
import './VerPedidos.css';

const VerPedidos = () => {
  const [orders, setOrders] = useState([]);
  const [lastDoc, setLastDoc] = useState(null);
  const [firstDoc, setFirstDoc] = useState(null);
  const [page, setPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState(null); // State for selected order

  useEffect(() => {
    const q = query(collection(db, 'PEDIDOS'), orderBy('timestamp', 'desc'), limit(5));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const items = [];
      querySnapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() });
      });
      setOrders(items);
      setLastDoc(querySnapshot.docs[querySnapshot.docs.length - 1]);
      setFirstDoc(querySnapshot.docs[0]);
    });

    return () => unsubscribe();
  }, []);

  const fetchOrders = async (direction) => {
    try {
      let q;
      if (direction === 'next') {
        q = query(collection(db, 'PEDIDOS'), orderBy('timestamp', 'desc'), startAfter(lastDoc), limit(5));
      } else if (direction === 'prev') {
        q = query(collection(db, 'PEDIDOS'), orderBy('timestamp', 'desc'), limit(5));
      } else {
        q = query(collection(db, 'PEDIDOS'), orderBy('timestamp', 'desc'), limit(5));
      }

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const items = [];
        querySnapshot.forEach((doc) => {
          items.push({ id: doc.id, ...doc.data() });
        });
        setOrders(items);
        setLastDoc(querySnapshot.docs[querySnapshot.docs.length - 1]);
        setFirstDoc(querySnapshot.docs[0]);
      });

      return () => unsubscribe();
    } catch (error) {
      console.error('Error fetching orders:', error);
    }
  };

  const handleNextPage = () => {
    setPage(page + 1);
    fetchOrders('next');
  };

  const handlePrevPage = () => {
    if (page > 1) {
      setPage(page - 1);
      fetchOrders('prev');
    }
  };

  const handleOrderClick = (order) => {
    setSelectedOrder(order);
  };

  return (
    <div className="verpedidos-container">
      <h2>Pedidos Recientes</h2>
      <div className="verpedidos-orders-list">
        {orders.map((order) => (
          <div key={order.idPedido} className="verpedidos-order-item" onClick={() => handleOrderClick(order)}>
            <h3>Pedido #{order.idPedido}</h3>
            <p><strong>Cliente:</strong> {order.clientName}</p>
            <p><strong>Teléfono:</strong> {order.clientPhone}</p>
            <p><strong>Dirección:</strong> {order.clientAddress} - {order.clientBarrio}</p>
            <p><strong>Total:</strong> {order.total}</p>
            <p><strong>Estado:</strong> {order.status}</p>
            <p><strong>Fecha:</strong> {order.timestamp.toDate().toLocaleString()}</p>
          </div>
        ))}
      </div>
      <div className="pagination-controls">
        <button onClick={handlePrevPage} disabled={page === 1}>Anterior</button>
        <span>Página {page}</span>
        <button onClick={handleNextPage}>Siguiente</button>
      </div>

      {/* Modal de detalles del pedido */}
      {selectedOrder && (
        <Detalles
          order={selectedOrder}
          closeModal={() => setSelectedOrder(null)}
        />
      )}
    </div>
  );
};

export default VerPedidos;
