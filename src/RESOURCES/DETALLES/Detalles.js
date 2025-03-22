import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { doc, getDoc, collection, getDocs, query, orderBy, setDoc, where } from 'firebase/firestore'; // Add where
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './Detalles.css';
import { FaCartPlus, FaSave } from 'react-icons/fa'; // Import icons

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

  useEffect(() => {
    fetchProducts();
    if (isDomicilio) {
      fetchDomiciliarios();
    }
  }, [isDomicilio]);

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
      const now = new Date();
      const date = `${now.getDate()}-${now.getMonth() + 1}-${now.getFullYear()}`;
      const docId = date;

      const orderDoc = doc(db, 'PEDIDOS', docId);
      const orderSnapshot = await getDoc(orderDoc);

      if (orderSnapshot.exists()) {
        const data = orderSnapshot.data();
        const periods = ['MORNING', 'NIGHT'];
        let orderFound = false;

        for (const period of periods) {
          if (data[period] && data[period][order.id]) {
            data[period][order.id].cart = order.cart;
            data[period][order.id].total = calculateTotal(); // Update total
            await setDoc(orderDoc, { [period]: data[period] }, { merge: true });
            orderFound = true;
            break;
          }
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
            <button className="detalles-button" onClick={handleAgregarProductos} disabled={loading}>
              {loading ? 'Procesando...' : <><FaCartPlus /> Agregar más productos</>}
            </button>
            <button className="detalles-button" onClick={handleSaveOrder} disabled={loading}>
              {loading ? 'Procesando...' : <><FaSave /> Guardar Pedido</>}
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
                    <span>{product.name} - {product.price}</span>
                    <ul>
                      {product.ingredients.map((ingredient) => (
                        <li key={ingredient}>Sin {ingredient}</li>
                      ))}
                    </ul>
                  </div>
                ))}
                <h3>Total a Pagar: {calculateTotal()}</h3>
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
                    <span>{product.name} - {product.price}</span>
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