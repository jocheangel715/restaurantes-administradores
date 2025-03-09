import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { doc, updateDoc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './Detalles.css';

const Detalles = ({ order, closeModal }) => {
  const [domiciliarios, setDomiciliarios] = useState([]);
  const [selectedDomiciliario, setSelectedDomiciliario] = useState('');
  const [isDomicilio, setIsDomicilio] = useState(false);

  useEffect(() => {
    if (isDomicilio) {
      fetchDomiciliarios();
    }
  }, [isDomicilio]);

  const fetchDomiciliarios = async () => {
    try {
      const q = query(collection(db, 'CLIENTES'), where('role', '==', 'DOMICILIARIO'));
      const querySnapshot = await getDocs(q);
      const items = [];
      querySnapshot.forEach((doc) => {
        items.push(doc.data());
      });
      setDomiciliarios(items);
    } catch (error) {
      console.error('Error fetching domiciliarios:', error);
    }
  };

  const handleLlamadoEnCocina = async () => {
    try {
      const orderDoc = doc(db, 'PEDIDOS', order.id);
      const orderSnapshot = await getDoc(orderDoc);
      if (orderSnapshot.exists()) {
        await updateDoc(orderDoc, { status: 'ENCOCINA' });
        toast.success('Pedido enviado a cocina');
        closeModal();
      } else {
        toast.error('Pedido no encontrado');
      }
    } catch (error) {
      console.error('Error updating order status:', error);
      toast.error('Error al actualizar el estado del pedido');
    }
  };

  const handleEnDomicilio = async () => {
    try {
      const orderDoc = doc(db, 'PEDIDOS', order.id);
      const orderSnapshot = await getDoc(orderDoc);
      if (orderSnapshot.exists()) {
        await updateDoc(orderDoc, { status: 'ENDOMICILIO', domiciliario: selectedDomiciliario });
        toast.success('Pedido asignado a domiciliario');
        closeModal();
      } else {
        toast.error('Pedido no encontrado');
      }
    } catch (error) {
      console.error('Error updating order status:', error);
      toast.error('Error al actualizar el estado del pedido');
    }
  };

  return (
    <div className="detalles-container">
      <ToastContainer />
      <div className="detalles-overlay" onClick={closeModal}></div>
      <div className="detalles-modal">
        <div className="detalles-modal-content">
          <span className="detalles-close" onClick={closeModal}>&times;</span>
          <h2>Detalles del Pedido</h2>
          <div className="detalles-content">
            <h3>Productos:</h3>
            {order.cart.map((product, index) => (
              <div key={index}>
                <span>{product.name}</span>
                <ul>
                  {product.ingredients.map((ingredient) => (
                    <li key={ingredient}>Sin {ingredient}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <button className="detalles-button" onClick={handleLlamadoEnCocina}>LLAMADO EN COCINA</button>
          <div className="domicilio-section">
            <label>
              <input
                type="checkbox"
                checked={isDomicilio}
                onChange={() => setIsDomicilio(!isDomicilio)}
              />
              En domicilio
            </label>
            {isDomicilio && (
              <select
                value={selectedDomiciliario}
                onChange={(e) => setSelectedDomiciliario(e.target.value)}
              >
                <option value="">Seleccionar domiciliario</option>
                {domiciliarios.map((domiciliario) => (
                  <option key={domiciliario.id} value={domiciliario.id}>{domiciliario.name}</option>
                ))}
              </select>
            )}
            {isDomicilio && (
              <button className="detalles-button" onClick={handleEnDomicilio}>ENDOMICILIO</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Detalles;
