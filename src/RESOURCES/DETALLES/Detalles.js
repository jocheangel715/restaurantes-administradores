import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { doc, getDoc, collection, getDocs, query, where, setDoc } from 'firebase/firestore';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './Detalles.css';

const Detalles = ({ order, closeModal }) => {
  const [domiciliarios, setDomiciliarios] = useState([]);
  const [selectedDomiciliario, setSelectedDomiciliario] = useState('');
  const [isDomicilio, setIsDomicilio] = useState(false);
  const [loading, setLoading] = useState(false);

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

  const updateOrderStatus = async (status, domiciliario = null) => {
    setLoading(true);
    try {
      const now = new Date();
      const date = `${now.getDate()}-${now.getMonth() + 1}-${now.getFullYear()}`;
      const docId = date;

      const orderDoc = doc(db, 'PEDIDOS', docId);
      const orderSnapshot = await getDoc(orderDoc);

      if (orderSnapshot.exists()) {
        const data = orderSnapshot.data();
        console.log('Order data:', data); // Log order data
        const periods = ['MORNING', 'NIGHT'];
        let orderFound = false;

        for (const period of periods) {
          if (data[period] && data[period][order.id]) {
            data[period][order.id].status = status;
            if (domiciliario) {
              data[period][order.id].domiciliario = domiciliario;
            }
            await setDoc(orderDoc, { [period]: data[period] }, { merge: true });
            orderFound = true;
            break;
          }
        }

        if (orderFound) {
          if (domiciliario) {
            await saveDomicilioOrder(date, domiciliario, order);
          }
          toast.success(`Pedido actualizado a ${status}`);
          closeModal();
        } else {
          toast.error('Pedido no encontrado');
        }
      } else {
        toast.error('Documento de pedidos no encontrado');
      }
    } catch (error) {
      console.error('Error updating order status:', error);
      toast.error('Error al actualizar el estado del pedido');
    } finally {
      setLoading(false);
    }
  };

  const saveDomicilioOrder = async (date, domiciliario, order) => {
    try {
      const now = new Date();
      const period = now.getHours() < 17 ? 'MORNING' : 'NIGHT';
      const domicilioDoc = doc(db, 'DOMICILIOS', date);
      const domicilioSnapshot = await getDoc(domicilioDoc);

      let domicilioData = {};
      if (domicilioSnapshot.exists()) {
        domicilioData = domicilioSnapshot.data();
      }

      if (!domicilioData[domiciliario]) {
        domicilioData[domiciliario] = {};
      }

      if (!domicilioData[domiciliario][period]) {
        domicilioData[domiciliario][period] = {};
      }

      domicilioData[domiciliario][period][order.id] = {
        ...order,
        domiciliario,
        status: 'ENDOMICILIO',
        id: order.idPedido, // Ensure id matches the idPedido field in PEDIDOS
        idPedido: order.idPedido // Ensure idPedido matches the idPedido field in PEDIDOS
      };

      console.log('Domicilio data:', domicilioData); // Log domicilio data

      await setDoc(domicilioDoc, domicilioData, { merge: true });
    } catch (error) {
      console.error('Error saving domicilio order:', error);
      toast.error('Error al guardar el pedido en domicilio');
    }
  };

  const handleLlamadoEnCocina = () => {
    if (!loading) {
      updateOrderStatus('ENCOCINA');
    }
  };

  const handleEmpacado = () => {
    if (!loading) {
      updateOrderStatus('EMPACADO');
    }
  };

  const handleEnDomicilio = () => {
    if (!loading) {
      updateOrderStatus('ENDOMICILIO', selectedDomiciliario);
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
              <div key={index} className="product-item">
                <span className="product-name">{product.name}</span>
                <ul className="ingredient-list">
                  {product.ingredients.map((ingredient) => (
                    <li key={ingredient} className="ingredient-item">Sin {ingredient}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="button-container">
            <button className="detalles-button" onClick={handleLlamadoEnCocina} disabled={loading}>
              {loading ? 'Procesando...' : 'LLAMADO EN COCINA'}
            </button>
            <button className="detalles-button" onClick={handleEmpacado} disabled={loading}>
              {loading ? 'Procesando...' : 'EMPACADO'}
            </button>
          </div>
          <div className="domicilio-section">
            <label className="domicilio-label">
              <input
                type="checkbox"
                checked={isDomicilio}
                onChange={() => setIsDomicilio(!isDomicilio)}
              />
              En domicilio
            </label>
            {isDomicilio && (
              <select
                className="domiciliario-select"
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
              <button className="detalles-button" onClick={handleEnDomicilio} disabled={loading}>
                {loading ? 'Procesando...' : 'ENDOMICILIO'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Detalles;