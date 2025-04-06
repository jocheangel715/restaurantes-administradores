import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { doc, getDoc, collection, getDocs, query, orderBy, setDoc, where } from 'firebase/firestore'; // Add where
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './Detalles.css';
import { FaCartPlus, FaSave } from 'react-icons/fa'; // Import icons
import jsPDF from 'jspdf'; // Add this import for PDF generation

const Detalles = ({ order, closeModal }) => {
  const [loading, setLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('Todas las Categorías');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedIngredients, setSelectedIngredients] = useState([]);
  const [domiciliarios, setDomiciliarios] = useState([]);
  const [selectedDomiciliario, setSelectedDomiciliario] = useState('');
  const [isDomicilio, setIsDomicilio] = useState(false);
  const [domiciliarioName, setDomiciliarioName] = useState('');
  const [expandedProducts, setExpandedProducts] = useState({});

  useEffect(() => {
    fetchProducts();
    if (isDomicilio) {
      fetchDomiciliarios();
    }
  }, [isDomicilio]);

  // Fetch domiciliario name when order.domiciliario changes
  useEffect(() => {
    const fetchDomiciliarioName = async () => {
      if (order.domiciliario) {
        try {
          const docRef = doc(db, 'EMPLEADOS', order.domiciliario);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setDomiciliarioName(docSnap.data().name || 'N/A');
          } else {
            setDomiciliarioName('N/A');
          }
        } catch (error) {
          console.error('Error fetching domiciliario name:', error);
          setDomiciliarioName('N/A');
        }
      }
    };

    fetchDomiciliarioName();
  }, [order.domiciliario]);

  const fetchProducts = async () => {
    try {
      const q = query(collection(db, 'MENU'), orderBy('id', 'asc'));
      const querySnapshot = await getDocs(q);
      const items = [];
      const categoriesSet = new Set();
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        items.push(data);
        categoriesSet.add(data.category);
      });
      setProducts(items);
      setFilteredProducts(items);
      setCategories(['Todas las Categorías', ...Array.from(categoriesSet)]);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const fetchDomiciliarios = async () => {
    try {
      const q = query(collection(db, 'EMPLEADOS'), where('role', '==', 'DOMICILIARIO'));
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

  const updateOrderStatus = async (status, domiciliario = null) => {
    setLoading(true);
    try {
      const { date, period } = determineDateAndShift();
      const docId = date;

      const orderDoc = doc(db, 'PEDIDOS', docId);
      const orderSnapshot = await getDoc(orderDoc);

      if (orderSnapshot.exists()) {
        const data = orderSnapshot.data();
        console.log('Order data:', data); // Log order data
        let orderFound = false;

        if (data[period] && data[period][order.id]) {
          data[period][order.id].status = status;
          if (domiciliario) {
            data[period][order.id].domiciliario = domiciliario;
          }
          await setDoc(orderDoc, { [period]: data[period] }, { merge: true });
          orderFound = true;
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
      const { period } = determineDateAndShift();
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

  const formatPrice = (value) => {
    if (value === null || value === undefined || value === '') return '0';
    
    const numberValue = parseFloat(value.toString().replace(/[$,]/g, ''));
    
    if (isNaN(numberValue)) return '0';
  
    return `$${numberValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  };

  const crearMensajeComanda = (order) => {
    const timestamp = order.timestamp.toDate();
    const fecha = `${timestamp.getFullYear()}-${String(timestamp.getMonth() + 1).padStart(2, '0')}-${String(timestamp.getDate()).padStart(2, '0')}`;
    const hora = `${String(timestamp.getHours()).padStart(2, '0')}:${String(timestamp.getMinutes()).padStart(2, '0')}`;
  
    const resumenProductos = order.cart.reduce((acc, product) => {
      // Incluir observaciones en la clave de agrupación
      const key = `${product.name}-${JSON.stringify(product.ingredients)}-${product.observation || ''}`;
      if (!acc[key]) {
        acc[key] = { ...product, quantity: 0 };
      }
      acc[key].quantity += 1;
      return acc;
    }, {});
  
    // Función para centrar texto en 32 caracteres
    const centrarTexto = (texto, ancho = 32) => {
      const espacios = Math.floor((ancho - texto.length) / 2);
      return ' '.repeat(espacios) + texto;
    };
  
    let subtotal = 0;
    let mensaje = '';
    mensaje += '================================\n';
    mensaje += '           El Sazón\n';
    mensaje += '         Cl. 64 # 15W-2\n';
    mensaje += '       Tel: 318 3838977\n';
    mensaje += '================================\n';
    mensaje += `Fecha: ${fecha}\n`;
    mensaje += `Hora: ${hora}\n`;
    mensaje += `Factura N°: ${order.idPedido || ''}\n`;
    mensaje += '================================\n';
    mensaje += 'Cant Producto          Valor\n';
    mensaje += '--------------------------------\n';
  
    const wordWrap = (text, maxLen) => {
      const words = text.split(' ');
      const lines = [];
      let line = '';
  
      for (let word of words) {
        if ((line + word).length <= maxLen) {
          line += (line ? ' ' : '') + word;
        } else {
          if (line) lines.push(line);
          line = word;
        }
      }
  
      if (line) lines.push(line);
      return lines;
    };
  
    Object.values(resumenProductos).forEach(producto => {
      const cantidad = String(producto.quantity).padEnd(5, ' ');
      const total = producto.price * producto.quantity;
      subtotal += total;
  
      const nombreProducto = producto.name.slice(0, 17).padEnd(17, ' ');
      const valor = `$${total.toLocaleString('es-CO')}`.padStart(9, ' ');
  
      mensaje += `${cantidad}${nombreProducto}${valor}\n`;
  
      if (producto.ingredients && producto.ingredients.length > 0) {
        producto.ingredients.forEach(ingrediente => {
          const texto = `SIN ${ingrediente}`;
          const lineas = wordWrap(texto, 17);
          lineas.forEach(linea => {
            mensaje += `     ${linea}\n`;
          });
        });
      }
  
      if (producto.observation) {
        const texto = `OBS: ${producto.observation}`;
        const lineas = wordWrap(texto, 17);
        lineas.forEach(linea => {
          mensaje += `     ${linea}\n`;
        });
      }
  
      mensaje += '--------------------------------\n';
    });
  
    const valorDomicilio = order.valorDomicilio || 0; // Obtener el valor del domicilio
    const totalFinal = subtotal + valorDomicilio; // Calcular el total final
  
    mensaje += `SUBTOTAL:           $${subtotal.toLocaleString('es-CO')}\n`;
    mensaje += `DOMICILIO:          $${valorDomicilio.toLocaleString('es-CO')}\n`;
    mensaje += `TOTAL:              $${totalFinal.toLocaleString('es-CO')}\n`;
    mensaje += '================================\n';
    mensaje += `MÉTODO DE PAGO: ${order.paymentMethod}\n`;
    mensaje += `Cliente: ${order.clientName?.toUpperCase() || 'N/A'}\n`;
    mensaje += `Dirección: ${order.clientAddress || 'N/A'}\n`;
    mensaje += `${order.clientBarrio || 'N/A'}\n`;
    mensaje += '================================\n';
    mensaje += centrarTexto('¡GRACIAS POR SU VISITA!') + '\n';
    mensaje += centrarTexto('Vuelva pronto a El Sazón') + '\n';
    mensaje += '================================';
  
    return mensaje;
  };
  
  
  
  const handleLlamadoEnCocina = async () => {
    if (!loading) {
      try {
        const mensajeComanda = crearMensajeComanda(order);
        await fetch('http://127.0.0.1:8080', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: mensajeComanda }), // Send the formatted message
        });
        updateOrderStatus('ENCOCINA');
      } catch (error) {
        console.error('Error sending message to server:', error);
      }
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

  const addToCart = (product) => {
    if (product.status === 'DISABLE') {
      toast.error('Este producto está deshabilitado y no se puede agregar al carrito.');
      return;
    }
    setSelectedProduct(product);
    setSelectedIngredients(product.ingredients ? product.ingredients.split(', ') : []);
  };

  const handleIngredientChange = (ingredient) => {
    setSelectedIngredients((prevIngredients) =>
      prevIngredients.includes(ingredient)
        ? prevIngredients.filter((item) => item !== ingredient)
        : [...prevIngredients, ingredient]
    );
  };

  const handleCategoryChange = (e) => {
    const category = e.target.value;
    setSelectedCategory(category);
    if (category === 'Todas las Categorías') {
      setFilteredProducts(products);
    } else {
      setFilteredProducts(products.filter(product => product.category === category));
    }
  };

  const calculateTotal = () => {
    return order.cart.reduce((total, product) => total + parseFloat(product.price), 0);
  };

  const addProductToCart = () => {
    const productWithRestrictions = {
      ...selectedProduct,
      ingredients: selectedIngredients.length === 0 ? [] : selectedProduct.ingredients.split(', ').filter(ingredient => !selectedIngredients.includes(ingredient)),
    };
    order.cart.push(productWithRestrictions);
    setSelectedProduct(null);
    toast.success(`${selectedProduct.name} añadido a la cesta con restricciones`);
  };

  const handleAgregarProductos = () => {
    setIsAdding(true);
  };

  const handleSaveOrder = async () => {
    setLoading(true);
    try {
      const { date, period } = determineDateAndShift();
      const docId = date;
  
      const orderDoc = doc(db, 'PEDIDOS', docId);
      const orderSnapshot = await getDoc(orderDoc);
  
      if (orderSnapshot.exists()) {
        const data = orderSnapshot.data();
        let orderFound = false;
  
        if (data[period] && data[period][order.id]) {
          const subtotal = calculateTotal();
          const valorDomicilio = data[period][order.id].valorDomicilio || 0;
          const total = subtotal + valorDomicilio;
  
          data[period][order.id].cart = order.cart;
          data[period][order.id].subtotal = subtotal;
          data[period][order.id].total = total;
  
          await setDoc(orderDoc, { [period]: data[period] }, { merge: true });
          orderFound = true;
        }
  
        if (orderFound) {
          toast.success('Productos añadidos al pedido');
          closeModal();
        } else {
          toast.error('Pedido no encontrado');
        }
      } else {
        toast.error('Documento de pedidos no encontrado');
      }
    } catch (error) {
      console.error('Error saving order:', error);
      toast.error('Error al guardar el pedido');
    } finally {
      setLoading(false);
    }
  };
  
  const toggleProductDetails = (index) => {
    setExpandedProducts((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
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
            {Object.values(order.cart.reduce((acc, product) => {
              // Incluir observaciones en la clave de agrupación
              const key = `${product.name}-${JSON.stringify(product.ingredients)}-${product.observation || ''}`;
              if (!acc[key]) {
                acc[key] = { ...product, quantity: 0 };
              }
              acc[key].quantity += 1;
              return acc;
            }, {})).map((product, index) => (
              <div key={index} className={`product-item ${product.ingredients.length > 0 || product.observation ? 'highlight' : ''}`}>
                <span
                  className="product-name"
                  onClick={() => toggleProductDetails(index)}
                  style={{ cursor: 'pointer', textDecoration: 'underline' }}
                >
                  {product.quantity} X {product.name}
                </span>
                {expandedProducts[index] && (
                  <ul className="ingredient-list">
                    {product.ingredients.map((ingredient) => (
                      <li key={ingredient} className="ingredient-item">{ingredient}</li>
                    ))}
                    {product.observation && (
                      <li className="ingredient-item">OBS: {product.observation}</li>
                    )}
                  </ul>
                )}
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
            <button className="detalles-button" onClick={handleAgregarProductos} disabled={loading}>
              {loading ? 'Procesando...' : <><FaCartPlus /> Agregar más productos</>}
            </button>
            <button className="detalles-button" onClick={handleSaveOrder} disabled={loading}>
              {loading ? 'Procesando...' : <><FaSave /> Guardar Pedido</>}
            </button>
          </div>
          <div className="domicilio-section">
            {order.domiciliario ? (
              <p className="domicilio-texto-blanco">Domicilio asignado a {domiciliarioName}</p>
            ) : (
              <>
                <label className="domicilio-label">
                  <input
                    type="checkbox"
                    checked={isDomicilio}
                    onChange={() => setIsDomicilio(!isDomicilio)}
                  />
                  En domicilio
                </label>
                {isDomicilio && (
                  <>
                    <select
                      className="domiciliario-select"
                      value={selectedDomiciliario}
                      onChange={(e) => setSelectedDomiciliario(e.target.value)}
                    >
                      <option value="">Seleccionar domiciliario</option>
                      {domiciliarios.map((domiciliario) => (
                        <option key={domiciliario.id} value={domiciliario.id}>
                          {domiciliario.name}
                        </option>
                      ))}
                    </select>
                    <button className="detalles-button" onClick={handleEnDomicilio} disabled={loading}>
                      {loading ? 'Procesando...' : 'ENDOMICILIO'}
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modal de selección de productos */}
      {isAdding && (
        <>
          <div className="productos-overlay" onClick={() => setIsAdding(false)}></div>
          <div className="productos-modal">
            <div className="productos-modal-content">
              <span className="productos-close" onClick={() => setIsAdding(false)}>&times;</span>
              <h2>Seleccionar Productos</h2>
              <div className="pedido-summary">
                <h3>Pedido con Restricciones</h3>
                {order.cart.map((product, index) => (
                  <div key={index}>
                    <span>{product.name} - {formatPrice(product.price)}</span>
                    <ul>
                      {product.ingredients.map((ingredient) => (
                        <li key={ingredient}>Sin {ingredient}</li>
                      ))}
                    </ul>
                  </div>
                ))}
                <h3>Total a Pagar: {formatPrice(calculateTotal())}</h3>
              </div>
              <div className="productos-buttons-container">
                <select className="category-select" value={selectedCategory} onChange={handleCategoryChange}>
                  {categories.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
                <button className="close-button" onClick={() => setIsAdding(false)}>Listo</button>
              </div>
              <div className="productos-list">
                {filteredProducts.map((product) => (
                  <div key={product.id} className={`productos-item ${product.status === 'DISABLE' ? 'disable' : ''}`}>
                    <span>{product.name} - {formatPrice(product.price)}</span>
                    <button onClick={() => addToCart(product)}><FaCartPlus /></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Modal de selección de ingredientes */}
      {selectedProduct && (
        <>
          <div className="ingredientes-overlay" onClick={() => setSelectedProduct(null)}></div>
          <div className="ingredientes-modal">
            <div className="ingredientes-modal-content">
              <span className="ingredientes-close" onClick={() => setSelectedProduct(null)}>&times;</span>
              <h2>¿Qué ingredientes deseas retirar?</h2>
              <div className="ingredientes-buttons-container">
                <button onClick={addProductToCart}><FaCartPlus /> Añadir a la cesta</button>
              </div>
              {selectedProduct.ingredients.split(', ').map((ingredient) => (
                <div key={ingredient}>
                  <label>
                    <input
                      type="checkbox"
                      checked={!selectedIngredients.includes(ingredient)}
                      onChange={() => handleIngredientChange(ingredient)}
                    />
                    Sin {ingredient}
                  </label>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Detalles;