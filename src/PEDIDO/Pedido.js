import React, { useState, useEffect } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './Pedido.css';
import { db } from '../firebase';
import { doc, setDoc, collection, getDocs, query, where, orderBy, limit, deleteDoc, Timestamp, getDoc } from 'firebase/firestore';
import ConfirmationDelete from '../RESOURCES/THEMES/CONFIRMATIONDELETE/ConfirmationDelete';
import { FaEdit, FaTrash, FaSave, FaArrowLeft, FaCartPlus, FaCopy, FaPlus, FaMinus, FaSearch } from 'react-icons/fa'; // Import icons
import { getAuth } from 'firebase/auth'; // Import getAuth from firebase/auth

const Pedido = ({ modalVisible, closeModal }) => {
  const [userType, setUserType] = useState('');
  const [phone, setPhone] = useState('');
  const [client, setClient] = useState({ id: '', name: '', phone: '', address: '', barrio: '' });
  const [proveedor, setProveedor] = useState({ id: '', name: '', phone: '' });
  const [clients, setClients] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('Todas las Categorías');
  const [cart, setCart] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedIngredients, setSelectedIngredients] = useState([]);
  const [barrios, setBarrios] = useState([]);
  const [isAdding, setIsAdding] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formatPrice = (value) => {
    if (value === null || value === undefined || value === '') return '0';
    const stringValue = value.toString();
    const numberValue = parseFloat(stringValue.replace(/[$,]/g, ''));
    return `$${numberValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  };

  const auth = getAuth();
  const user = auth.currentUser;
  const userEmail = user ? user.email : '';
  const userName = userEmail.split('@')[0];

  useEffect(() => {
    if (modalVisible) {
      fetchClients();
      fetchProveedores();
      fetchProducts();
      fetchBarrios();
    }
  }, [modalVisible]);

  const fetchClients = async () => {
    try {
      const q = query(collection(db, 'CLIENTES'), orderBy('id', 'asc'));
      const querySnapshot = await getDocs(q);
      const items = [];
      querySnapshot.forEach((doc) => {
        items.push(doc.data());
      });
      setClients(items);
    } catch (error) {
      console.error('Error fetching clients:', error);
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

  const fetchProveedores = async () => {
    try {
      const q = query(collection(db, 'PROVEEDORES'), orderBy('id', 'asc'));
      const querySnapshot = await getDocs(q);
      const items = [];
      querySnapshot.forEach((doc) => {
        items.push(doc.data());
      });
      setProveedores(items);
    } catch (error) {
      console.error('Error fetching proveedores:', error);
    }
  };

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

  const fetchBarrios = async () => {
    try {
      const q = query(collection(db, 'BARRIOS'), orderBy('name', 'asc'));
      const querySnapshot = await getDocs(q);
      const items = [];
      querySnapshot.forEach((doc) => {
        items.push(doc.data());
      });
      setBarrios(items);
    } catch (error) {
      console.error('Error fetching barrios:', error);
    }
  };

  const handleUserTypeChange = (type) => {
    setUserType(type);
    setIsAdding(false);
    setClient({ id: '', name: '', phone: '', address: '', barrio: '' });
    setPhone('');
    setError('');
  };

  const handlePhoneChange = (e) => {
    setPhone(e.target.value);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearchClient();
    }
  };

  const handleSearchClient = async () => {
    setLoading(true);
    try {
        // Normalizar el número ingresado en los tres formatos posibles
        let rawPhone = phone.replace(/\s+/g, ''); // Eliminar espacios
        if (rawPhone.startsWith('+57')) {
            rawPhone = rawPhone.replace('+57', ''); // Remover prefijo si ya está
        }

        const normalizedPhones = [
            rawPhone, // Formato 1: 3054715845
            `+57${rawPhone}`, // Formato 2: +573054715845
            `+57 ${rawPhone}` // Formato 3: +57 3054715845
        ];

        // Consultar la base de datos con los tres formatos
        const q = query(collection(db, 'CLIENTES'), where('phone', 'in', normalizedPhones));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const clientData = querySnapshot.docs[0].data();
            setClient(clientData);
            setCart([]); // Clear the cart
            setPaymentMethod(''); // Reset payment method
            setBillAmount(''); // Reset bill amount
            setError('');
        } else {
            setClient({ id: '', name: '', phone, address: '', barrio: '' });
            setError('Cliente no encontrado. Por favor, complete los datos para registrar un nuevo cliente.');
        }
    } catch (error) {
        console.error('Error buscando cliente:', error);
        setError('Error buscando cliente');
    } finally {
        setLoading(false);
    }
};


  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setClient({ 
      ...client, 
      [name]: name === 'name' ? value.toUpperCase() : value 
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true); // Set loading state
    try {
      if (userType === 'cliente') {
        if (!client.id) {
          const newId = await generateNewClientId();
          await setDoc(doc(db, "CLIENTES", newId), { ...client, id: newId });
          toast.success("Cliente registrado correctamente");
        } else {
          await setDoc(doc(db, "CLIENTES", client.id), client, { merge: true });
          toast.success("Cliente actualizado correctamente");
        }
        // Handle order creation logic here
        const newOrderId = await generateNewOrderId();
        const subtotal = parseFloat(calculateTotal().replace(/[$,]/g, '')); // Ensure subtotal is a number
        const valorDomicilio = parseFloat(barrios.find(barrio => barrio.name === client.barrio)?.deliveryPrice) || 0;
        const total = subtotal + valorDomicilio; // Sum subtotal and delivery cost
  
        const orderData = {
          idPedido: newOrderId,
          clientId: client.id,
          clientName: client.name,
          clientPhone: client.phone,
          clientAddress: client.address,
          clientBarrio: client.barrio,
          paymentMethod: paymentMethod,
          status: "PEDIDOTOMADO",
          cart: cart,
          subtotal: subtotal, // Save subtotal as a number
          valorDomicilio: valorDomicilio,
          total: total, // Save the calculated total
          timestamp: Timestamp.now(),
          pedidotomado: userName, // Add the authenticated user's name
        };
  
        const { date, period } = determineDateAndShift();
        const docId = date;
  
        // Generate a unique ID for the order map field
        const uniqueOrderId = `${newOrderId}_${Date.now()}`;
  
        await setDoc(doc(db, "PEDIDOS", docId), {
          [period]: {
            [uniqueOrderId]: orderData
          }
        }, { merge: true });
  
        toast.success("Pedido registrado correctamente");
      } else {
        // Handle proveedor order logic here
      }
      handleBack();
    } catch (error) {
      console.error("Error al registrar:", error);
      if (toast) {
        toast.error("Error al registrar");
      }
    } finally {
      setIsSubmitting(false); // Reset loading state
    }
  };

  const generateNewClientId = async () => {
    const q = query(collection(db, 'CLIENTES'), orderBy('id', 'desc'), limit(1));
    const querySnapshot = await getDocs(q);
    let lastId = 0;
    querySnapshot.forEach((doc) => {
      lastId = parseInt(doc.data().id, 10);
    });
    return (lastId + 1).toString().padStart(8, '0');
  };

  const generateNewOrderId = async () => {
    const { date, period } = determineDateAndShift();
    const docId = date;
  
    const docRef = doc(db, 'PEDIDOS', docId);
    const docSnap = await getDoc(docRef);
  
    let lastId = 0;
    if (docSnap.exists()) {
      const data = docSnap.data();
      const orders = data[period]
        ? Object.keys(data[period]).filter(orderId => !data[period][orderId].tableNumber) // Filter only non-table orders
        : [];
      if (orders.length > 0) {
        lastId = Math.max(...orders.map(orderId => parseInt(orderId.split('_')[0], 10)));
      }
    }
    return (lastId + 1).toString().padStart(8, '0');
  };

  const handleEdit = (item) => {
    if (userType === 'cliente') {
      setClient(item);
    } else {
      setProveedor(item);
    }
    setIsAdding(true);
  };

  const handleDelete = (id) => {
    setDeleteId(id);
    setShowConfirmation(true);
  };

  const confirmDelete = async () => {
    try {
      if (userType === 'cliente') {
        await deleteDoc(doc(db, 'CLIENTES', deleteId));
        toast.success('Cliente eliminado correctamente');
        fetchClients();
      } else {
        await deleteDoc(doc(db, 'PROVEEDORES', deleteId));
        toast.success('Proveedor eliminado correctamente');
        fetchProveedores();
      }
    } catch (error) {
      console.error('Error al eliminar:', error);
      toast.error('Error al eliminar');
    } finally {
      setShowConfirmation(false);
      setDeleteId(null);
    }
  };

  const cancelDelete = () => {
    setShowConfirmation(false);
    setDeleteId(null);
  };

  const handleBack = () => {
    setIsAdding(false);
    setClient({ id: '', name: '', phone: '', address: '', barrio: '' });
    setProveedor({ id: '', name: '', phone: '' });
    setPhone('');
    setError('');
  };

  const handleAdd = () => {
    setIsAdding(true);
  };

  const handleCloseModal = () => {
    closeModal();
    handleBack();
  };

  const addToCart = (product) => {
    if (product.status === 'DISABLE') {
      toast.error('Este producto está deshabilitado y no se puede agregar al carrito.');
      return;
    }
    setSelectedProduct({ ...product, isEditing: false }); // Set isEditing to false for adding
    setSelectedIngredients([]); // Start with no ingredients selected
  };
  const EditToCart = async (product, index) => {
    if (product.status === 'DISABLE') {
      toast.error('Este producto está deshabilitado y no se puede editar.');
      return;
    }
  
    try {
      const productRef = doc(db, 'MENU', product.id);
      const productSnap = await getDoc(productRef);
  
      if (productSnap.exists()) {
        const productData = productSnap.data();
        setSelectedProduct({
          ...product,
          ingredients: productData.ingredients || [],
          isEditing: true, // Set isEditing to true for editing
          cartIndex: index, // Track the specific instance in the cart
        });
        setSelectedIngredients(product.ingredients); // Select only the ingredients of the product
      } else {
        toast.error('No se encontraron datos del producto.');
      }
    } catch (error) {
      console.error('Error al obtener los ingredientes del producto:', error);
      toast.error('Error al obtener los ingredientes del producto.');
    }
  };
  
  const saveProductChanges = () => {
    setCart((prevCart) =>
      prevCart.map((item, idx) =>
        idx === selectedProduct.cartIndex // Update only the specific instance in the cart
          ? {
              ...item,
              ingredients: selectedIngredients, // Update the ingredients with the new restrictions
            }
          : item
      )
    );
    setSelectedProduct(null);
    toast.success('Producto actualizado correctamente.');
  };
  

const handleIngredientChange = (ingredient) => {
  setSelectedIngredients((prevIngredients) =>
    prevIngredients.includes(ingredient)
      ? prevIngredients.filter((item) => item !== ingredient) // Deselect ingredient
      : [...prevIngredients, ingredient] // Select ingredient
  );
};

const handleSelectAllIngredients = () => {
  if (selectedProduct && typeof selectedProduct.ingredients === 'string') {
    setSelectedIngredients(
      selectedIngredients.length === selectedProduct.ingredients.split(', ').length
        ? [] // Deselect all if all are selected
        : selectedProduct.ingredients.split(', ') // Select all
    );
  }
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
    return formatPrice(cart.reduce((total, product) => total + parseFloat(product.price), 0));
  };

  const calculateChange = () => {
    const subtotal = parseFloat(calculateTotal().replace(/[$,]/g, ''));
    const deliveryCost = parseFloat(barrios.find(barrio => barrio.name === client.barrio)?.deliveryPrice) || 0;
    const total = subtotal + deliveryCost;
    const bill = billAmount ? parseFloat(billAmount) : 0;
    return formatPrice(bill - total);
  };

  const addProductToCart = () => {
    const productWithRestrictions = {
      ...selectedProduct,
      ingredients: typeof selectedProduct.ingredients === 'string'
        ? selectedProduct.ingredients.split(', ').filter((ingredient) => selectedIngredients.includes(ingredient)) // Save only selected ingredients
        : [],
    };
    setCart([...cart, productWithRestrictions]);
    setSelectedProduct(null);
    toast.success(`${selectedProduct.name} añadido a la cesta con restricciones`);
  };

  const handlePaymentMethodChange = (e) => {
    setPaymentMethod(e.target.value);
    if (e.target.value !== 'EFECTIVO') {
      setBillAmount('');
    }
  };

  const confirmarPedido = () => {
    const pedido = cart.map(product => 
        `${product.name} - ${product.ingredients.map(ingredient => `SIN ${ingredient}`).join(', ')}`)
        .join('\n');

    const direccion = `${client.address} - ${client.barrio}`;
    const subtotal = parseFloat(calculateTotal().replace(/[$,]/g, '')) || 0;
    const costoDomicilio = parseFloat(barrios.find(barrio => barrio.name === client.barrio)?.deliveryPrice) || 0;
    const metodoPago = paymentMethod;
    const billete = billAmount ? parseFloat(billAmount) : 0;
    const total = subtotal + costoDomicilio;
    const vueltos = billete - total;

    const mensaje = `✅ ¡Pedido confirmado! Esto es lo que nos pediste:

🛒 *Pedido:* 
${pedido}

📍 *Dirección:* ${direccion}
💰 *Subtotal a pagar:* ${formatPrice(subtotal)}
🛵 *Costo del domicilio:* ${formatPrice(costoDomicilio)}
💵 *Método de pago:* ${metodoPago}
${metodoPago === 'EFECTIVO' ? `🔸 Si pagas en efectivo, nos diste un billete de: ${formatPrice(billete)}
🔸 Llevamos tus vueltos de: ${formatPrice(vueltos)}` : ''}
💰 Total a pagar: ${formatPrice(total)}

📢 Si hay algún error o quieres modificar algo, avísanos lo más pronto posible.  

✅ Si tu pedido está correcto en su totalidad, por favor confírmanos para enviarlo a cocina.  

🙌 Gracias por elegirnos, ¡nos encanta llevarte el mejor sabor! 🍔🔥`;

    navigator.clipboard.writeText(mensaje)
      .then(() => toast.success('Pedido copiado al portapapeles'))
      .catch(() => toast.error('Error al copiar el pedido'));
};

const handleBillAmountChange = (e) => {
  let value = e.target.value.replace(/[$,]/g, ''); // Elimina símbolos de moneda y comas
  if (!isNaN(value) && value !== '') {
    setBillAmount(parseFloat(value)); // Guarda el número sin formato
  } else {
    setBillAmount(0); // Si está vacío, pone 0
  }
};

const handleIncreaseQuantity = (index) => {
  setCart((prevCart) => {
    const updatedCart = [...prevCart];
    const productToAdd = { ...updatedCart[index] }; // Clone the product
    updatedCart.push(productToAdd); // Add the same product
    return updatedCart;
  });
};

const handleDecreaseQuantity = (index) => {
  setCart((prevCart) => {
    const updatedCart = [...prevCart];
    updatedCart.splice(index, 1); // Remove the product at the given index
    return updatedCart;
  });
};

const handleSearchProduct = (product) => {
  // Busca el producto en el carrito
  const productInCart = cart.find((item) => item.id === product.id);

  if (productInCart) {
    // Establece el producto seleccionado y sus ingredientes para editar
    setSelectedProduct(productInCart);
    setSelectedIngredients(
      typeof productInCart.ingredients === 'string'
        ? productInCart.ingredients.split(', ')
        : []
    );
  } else {
    toast.error('El producto no está en el carrito.');
  }
};

  return (
    <div className="pedido-container">
      <ToastContainer />
      
      {/* Modal principal de pedidos */}
      {modalVisible && (
        <>
          <div className="pedido-overlay" onClick={handleCloseModal}></div>
          <div className="pedido-modal">
            <div className="pedido-modal-content">
              <button className="back-button" onClick={handleBack}><FaArrowLeft /></button>
              <span className="pedido-close" onClick={handleCloseModal}>&times;</span>
              <h2 className="modal-header">Realizar Pedido</h2>
              
              <div className="user-type-selection">
                <button onClick={() => handleUserTypeChange('cliente')}>Cliente</button>
                <button 
  className="hidden" 
  onClick={() => handleUserTypeChange('proveedor')}
>
  Proveedor
</button>
              </div>
  
              {userType === 'cliente' && (
                <div className="client-search">
                  <label>
                    Número de Teléfono:
                    <input
                      type="text"
                      value={phone}
                      onChange={handlePhoneChange}
                      onKeyPress={handleKeyPress}
                    />
                  </label>
                  {loading && <p className="loading-message">Buscando cliente...</p>}
                  {error && <p className="error-message">{error}</p>}
                  {client.phone && (
                    <form className="pedido-form" onSubmit={handleSubmit}>
                      <div className="pedido-form-group">
                        <label>Nombre:</label>
                        <input
                          type="text"
                          name="name"
                          value={client.name}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                      <div className="pedido-form-group">
                        <label>Dirección:</label>
                        <input
                          type="text"
                          name="address"
                          value={client.address}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                      <div className="pedido-form-group">
                        <label>Barrio:</label>
                        <select
                          className="pedido-input"
                          name="barrio"
                          value={client.barrio}
                          onChange={handleInputChange}
                          required
                        >
                          <option value="">Seleccionar barrio</option>
                          {barrios.map((barrio) => (
                            <option key={barrio.id} value={barrio.name}>{barrio.name} - {barrio.deliveryPrice}</option>
                          ))}
                        </select>
                      </div>
                      <div className="pedido-form-group">
                        <label>Método de Pago:</label>
                        <select
                          className="pedido-input"
                          name="paymentMethod"
                          value={paymentMethod}
                          onChange={handlePaymentMethodChange}
                          required
                        >
                          <option value="">Seleccionar método de pago</option>
                          <option value="NEQUI">NEQUI</option>
                          <option value="EFECTIVO">EFECTIVO</option>
                        </select>
                      </div>
                      {paymentMethod === 'EFECTIVO' && (
                        <div className="pedido-form-group">
                        <label>Billete recibido:</label>
                        <input
                          type="text"
                          name="billAmount"
                          value={billAmount ? formatPrice(billAmount) : '$0'}
                          onChange={handleBillAmountChange}
                          required
                        />
                      </div>
                      
                      
                      )}
                      <div className="pedido-summary-container">
                        <h3>Resumen del Pedido</h3>
                        <div>
                          <strong>Pedido:</strong>
                          {cart.map((product, index) => (
                            <div key={index} className="pedido-summary-item">
                              <span>{product.name} - {formatPrice(product.price)}</span>
                              <ul>
                                {product.ingredients.map((ingredient) => (
                                  <li key={ingredient}>SIN {ingredient}</li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                        <div>
                          <strong>Dirección:</strong> {client.address} - {client.barrio}
                        </div>
                        <div>
                          <strong>Subtotal:</strong> {calculateTotal()}
                        </div>
                        <div>
                          <strong>Costo del Domicilio:</strong> {formatPrice(parseFloat(barrios.find(barrio => barrio.name === client.barrio)?.deliveryPrice) || 0)}
                        </div>
                        <div>
                          <strong>Método de Pago:</strong> {paymentMethod}
                        </div>
                        {paymentMethod === 'EFECTIVO' && (
                          <div>
                            <strong>Vueltos:</strong> {formatPrice(calculateChange())}
                          </div>
                        )}
                        <div>
                          <strong>Total a Pagar:</strong> {formatPrice(
    parseFloat(calculateTotal().replace(/[$,]/g, '')) + 
    (parseFloat(barrios.find(barrio => barrio.name === client.barrio)?.deliveryPrice) || 0)
  )}
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
                  )}
                </div>
              )}
  
              {userType === 'proveedor' && (
                <div className="pedido-list">
                  {proveedores.map((item) => (
                    <div key={item.id} className="pedido-item">
                      <span>{item.name}</span>
                      <div className="button-container">
                        <button onClick={() => handleEdit(item)}><FaEdit /></button>
                        <button onClick={() => handleDelete(item.id)}><FaTrash /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
  <div key={index} className="product-container">
    <div className="product-info">
      <span>{product.name} - {formatPrice(product.price)}</span>
      <ul>
        {product.ingredients.map((ingredient) => (
          <li key={ingredient}>SIN {ingredient}</li>
        ))}
      </ul>
    </div>
    <div className="product-buttons">
      <button onClick={() => handleIncreaseQuantity(index)}><FaPlus /></button>
      <button onClick={() => handleDecreaseQuantity(index)}><FaMinus /></button>
      <button onClick={() => EditToCart(product, index)}><FaSearch /></button> {/* Pass index */}
    </div>
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
  
      {/* Modal de selección de ingredientes para primera vez */}
{selectedProduct && (
  <>
    <div className="ingredientes-overlay" onClick={() => setSelectedProduct(null)}></div>
    <div className="ingredientes-modal">
      <div className="ingredientes-modal-content">
        <span className="ingredientes-close" onClick={() => setSelectedProduct(null)}>&times;</span>
        <h2>
          {selectedProduct.isEditing
            ? '¿Qué ingredientes deseas retirar del producto a editar?'
            : '¿Qué ingredientes deseas retirar?'}
        </h2>
        <div className="ingredientes-buttons-container">
          <button onClick={handleSelectAllIngredients}>Eliminar todo</button>
          <button onClick={selectedProduct.isEditing ? saveProductChanges : addProductToCart}>
            <FaCartPlus /> {selectedProduct.isEditing ? 'Guardar cambios' : 'Agregar a la cesta'}
          </button>
        </div>
        {typeof selectedProduct.ingredients === 'string' &&
          selectedProduct.ingredients.split(', ').map((ingredient) => (
            <div key={ingredient}>
              <label>
                <input
                  type="checkbox"
                  checked={selectedIngredients.includes(ingredient)} // Show only selected ingredients
                  onChange={() => handleIngredientChange(ingredient)}
                />
                SIN {ingredient}
              </label>
            </div>
          ))}
      </div>
    </div>
  </>
)}
  
      {/* Modal de confirmación de eliminación */}
      {showConfirmation && (
        <ConfirmationDelete
          title="Confirmar eliminación"
          message={`¿Estás seguro de que deseas eliminar este ${userType}?`}
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
        />
      )}
    </div>
  );
};

export default Pedido;
