import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, collection, getDocs, query, orderBy, setDoc, where } from 'firebase/firestore'; // Add 'where' to the imports
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './Detalles.css';
import { FaCartPlus, FaSave } from 'react-icons/fa'; // Import icons
import { getAuth, onAuthStateChanged } from 'firebase/auth';

const Detalles = ({ order, closeModal }) => {
  const [loading, setLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('Todas las Categorías');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedIngredients, setSelectedIngredients] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [incorrectPayment, setIncorrectPayment] = useState(false);
  const [partialPayment, setPartialPayment] = useState(false);
  const [partialAmount, setPartialAmount] = useState('');
  const [userId, setUserId] = useState('');

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    const auth = getAuth();
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const q = query(collection(db, 'EMPLEADOS'), where('email', '==', user.email));
          const querySnapshot = await getDocs(q);
          querySnapshot.forEach((docSnapshot) => {
            const data = docSnapshot.data();
            setUserId(data.id);
          });
        } catch (error) {
          console.error('Error obteniendo datos del usuario:', error);
        }
      }
    });
  }, []);

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

  const updateOrderStatus = async (status) => {
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
          data[period][order.id].status = status;
          if (incorrectPayment) {
            data[period][order.id].paymentMethod = paymentMethod;
          }
          orderFound = true;
        }

        if (orderFound) {
          const paymentMethodToUse = incorrectPayment ? paymentMethod : order.paymentMethod;
          const balance = data[period].balance || { EFECTIVO: 0, NEQUI: 0 };

          if (partialPayment && partialAmount) {
            const partialValue = parseFloat(partialAmount.replace(/[$,]/g, '')) || 0;
            const remainingValue = order.total - partialValue;

            balance[paymentMethodToUse] = (Number(balance[paymentMethodToUse]) || 0) + partialValue;
            const otherMethod = paymentMethodToUse === 'EFECTIVO' ? 'NEQUI' : 'EFECTIVO';
            balance[otherMethod] = (Number(balance[otherMethod]) || 0) + remainingValue;
          } else {
            balance[paymentMethodToUse] = (Number(balance[paymentMethodToUse]) || 0) + order.total;
          }

          await setDoc(orderDoc, { [period]: { ...data[period], balance } }, { merge: true });

          // Update balance in DOMICILIOS collection
          const domiciliosDoc = doc(db, 'DOMICILIOS', docId);
          const domiciliosSnapshot = await getDoc(domiciliosDoc);
          const domiciliosData = domiciliosSnapshot.exists() ? domiciliosSnapshot.data() : {};

          if (!domiciliosData[userId]) {
            domiciliosData[userId] = {};
          }
          if (!domiciliosData[userId][period]) {
            domiciliosData[userId][period] = { balance: { EFECTIVO: 0, NEQUI: 0 } };
          }

          const meseroBalance = domiciliosData[userId][period].balance;
          if (partialPayment && partialAmount) {
            const partialValue = parseFloat(partialAmount.replace(/[$,]/g, '')) || 0;
            const remainingValue = order.total - partialValue;

            meseroBalance[paymentMethodToUse] = (Number(meseroBalance[paymentMethodToUse]) || 0) + partialValue;
            const otherMethod = paymentMethodToUse === 'EFECTIVO' ? 'NEQUI' : 'EFECTIVO';
            meseroBalance[otherMethod] = (Number(meseroBalance[otherMethod]) || 0) + remainingValue;
          } else {
            meseroBalance[paymentMethodToUse] = (Number(meseroBalance[paymentMethodToUse]) || 0) + order.total;
          }

          await setDoc(domiciliosDoc, { [userId]: { [period]: { balance: meseroBalance } } }, { merge: true });

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

  const handleLlamadoEnCocina = () => {
    if (!loading) {
      updateOrderStatus('ENCOCINA');
    }
  };

  const handleEmpacado = () => {
    if (!loading) {
      updateOrderStatus('ENTREGADO');
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
          data[period][order.id].cart = order.cart;
          data[period][order.id].total = calculateTotal(); // Update total
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

  const formatPrice = (value) => {
    if (value === null || value === undefined || value === '') return '0';
    const numberValue = parseFloat(value.toString().replace(/[$,]/g, ''));
    if (isNaN(numberValue)) return '0';
    return `$${numberValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
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
        <h3>Total: {formatPrice(order.total)}</h3>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={incorrectPayment}
            onChange={() => setIncorrectPayment(!incorrectPayment)}
          />
          ¿El pago no fue por el método correcto?
        </label>
        {incorrectPayment && (
          <select
            className="period-select-dropdown"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
          >
            <option value="">Seleccionar método de pago</option>
            <option value="NEQUI">NEQUI</option>
            <option value="EFECTIVO">EFECTIVO</option>
          </select>
        )}
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={partialPayment}
            onChange={() => setPartialPayment(!partialPayment)}
          />
          ¿El pago fue parcial?
        </label>
        {partialPayment && (
          <input
            type="text"
            className="partial-payment-input"
            placeholder="Ingrese el monto recibido"
            value={partialAmount}
            onChange={(e) => setPartialAmount(formatPrice(e.target.value))}
          />
        )}
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
          {loading ? 'Procesando...' : 'ENTREGADO'}
        </button>
        <button className="detalles-button" onClick={handleAgregarProductos} disabled={loading}>
          {loading ? 'Procesando...' : <><FaCartPlus /> Agregar más productos</>}
        </button>
        <button className="detalles-button" onClick={handleSaveOrder} disabled={loading}>
          {loading ? 'Procesando...' : <><FaSave /> Guardar Pedido</>}
        </button>
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
            <select className="category-select inputdetalles" value={selectedCategory} onChange={handleCategoryChange}>
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
                  className="inputdetalles"
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