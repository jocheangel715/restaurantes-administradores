import React, { useState, useEffect } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './PedidoMesero.css';
import { db } from '../firebase';
import { doc, setDoc, collection, getDocs, query, orderBy, Timestamp, getDoc } from 'firebase/firestore'; // Import necessary Firestore functions
import { FaSave, FaArrowLeft, FaCartPlus, FaCopy } from 'react-icons/fa'; // Import icons
import { getAuth } from 'firebase/auth'; // Import getAuth from firebase/auth

const formatPrice = (value) => {
  if (value === null || value === undefined || value === '') return '0';
  const stringValue = value.toString();
  const numberValue = parseFloat(stringValue.replace(/[$,]/g, ''));
  return `$${numberValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};
const PedidoMesero = ({ modalVisible, closeModal }) => {
  const [tableNumber, setTableNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [cart, setCart] = useState([]);
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('Todas las Categorías');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedIngredients, setSelectedIngredients] = useState([]);

  const auth = getAuth();
  const user = auth.currentUser;
  const userEmail = user ? user.email : '';
  const userName = userEmail.split('@')[0];

  useEffect(() => {
    if (modalVisible) {
      fetchProducts();
    }
  }, [modalVisible]);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true); // Set loading state
    try {
      const newOrderId = await generateNewOrderId();
      const orderData = {
        idPedido: newOrderId,
        tableNumber: tableNumber,
        status: "PEDIDOTOMADO",
        cart: cart,
        total: calculateTotal(), // Add total to order data
        timestamp: Timestamp.now(),
        pedidotomado: userName, // Add the authenticated user's name
      };

      const now = new Date();
      const date = `${now.getDate()}-${now.getMonth() + 1}-${now.getFullYear()}`;
      const period = now.getHours() < 17 ? 'MORNING' : 'NIGHT';
      const docId = date;

      // Generate a unique ID for the order map field
      const uniqueOrderId = `${newOrderId}_${Date.now()}`;

      await setDoc(doc(db, "PEDIDOS", docId), {
        [period]: {
          [uniqueOrderId]: orderData
        }
      }, { merge: true });

      toast.success("Pedido registrado correctamente");
      closeModal();
    } catch (error) {
      console.error("Error al registrar:", error);
      toast.error("Error al registrar");
    } finally {
      setIsSubmitting(false); // Reset loading state
    }
  };

  const generateNewOrderId = async () => {
    const now = new Date();
    const date = `${now.getDate()}-${now.getMonth() + 1}-${now.getFullYear()}`;
    const docId = date;

    const docRef = doc(db, 'PEDIDOS', docId);
    const docSnap = await getDoc(docRef);

    let lastId = 0;
    if (docSnap.exists()) {
      const data = docSnap.data();
      const period = now.getHours() < 17 ? 'MORNING' : 'NIGHT';
      const orders = data[period] ? Object.keys(data[period]) : [];
      if (orders.length > 0) {
        lastId = Math.max(...orders.map(orderId => parseInt(orderId.split('_')[0], 10)));
      }
    }
    return (lastId + 1).toString().padStart(8, '0');
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

  const addProductToCart = () => {
    const productWithRestrictions = {
      ...selectedProduct,
      ingredients: selectedIngredients.length === 0 ? [] : selectedProduct.ingredients.split(', ').filter(ingredient => !selectedIngredients.includes(ingredient)),
    };
    setCart([...cart, productWithRestrictions]);
    setSelectedProduct(null);
    toast.success(`${selectedProduct.name} añadido a la cesta con restricciones`);
  };

  const calculateTotal = () => {
    return cart.reduce((total, product) => total + parseFloat(product.price), 0);
  };

  const confirmarPedido = () => {
    const pedido = cart.map(product => 
        `${product.name} - ${product.ingredients.map(ingredient => `Sin ${ingredient}`).join(', ')}`)
        .join('\n');

    const total = parseFloat(calculateTotal()) || 0;

    const mensaje = `✅ ¡Pedido confirmado! Esto es lo que nos pediste:

🛒 *Pedido:* 
${pedido}

💰 Total a pagar: ${total}

📢 Si hay algún error o quieres modificar algo, avísanos lo más pronto posible.  

✅ Si tu pedido está correcto en su totalidad, por favor confírmanos para enviarlo a cocina.  


🙌 Gracias por elegirnos, ¡nos encanta llevarte el mejor sabor! 🍔🔥`;

    navigator.clipboard.writeText(mensaje)
      .then(() => toast.success('Pedido copiado al portapapeles'))
      .catch(() => toast.error('Error al copiar el pedido'));
  };

  return (
    <div className="pedido-container">
      <ToastContainer />
      {modalVisible && (
        <>
          <div className="pedido-overlay" onClick={closeModal}></div>
          <div className="pedido-modal">
            <div className="pedido-modal-content">
              <button className="back-button" onClick={closeModal}><FaArrowLeft /></button>
              <span className="pedido-close" onClick={closeModal}>&times;</span>
              <h2 className="modal-header">Crear Pedido</h2>
              <form className="pedido-form" onSubmit={handleSubmit}>
                <div className="pedido-form-group">
                <label>Número de Mesa:</label>
<input
  type="text"
  name="tableNumber"
  className="inputpedidomesero"
  value={tableNumber}
  onChange={(e) => setTableNumber(e.target.value.toUpperCase())}
  required
/>


                </div>
                <div className="pedido-summary-container">
                  <h3>Resumen del Pedido</h3>
                  <div>
                    <strong>Pedido:</strong>
                    {cart.map((product, index) => (
                      <div key={index} className="pedido-summary-item">
                        <span>{product.name} - {product.price}</span>
                        <ul>
                          {product.ingredients.map((ingredient) => (
                            <li key={ingredient}>Sin {ingredient}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                  <div>
                    <strong>Total a Pagar:</strong> {calculateTotal()}
                  </div>
                </div>
                <div className="form-buttons">
                  <button type="button" className="add-products-button" onClick={() => setIsAdding(true)}><FaCartPlus /> Añadir Productos</button>
                  <button type="button" className="confirmar-pedido-button" onClick={confirmarPedido}><FaCopy /> Confirmar Pedido</button>
                  <button type="submit" className="realizar-pedido-button" disabled={isSubmitting}>
                    {isSubmitting ? 'Procesando...' : <><FaSave /> Realizar Pedido</>}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}

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
                {cart.map((product, index) => (
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
  className="inputpedidomesero"
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

export default PedidoMesero;
