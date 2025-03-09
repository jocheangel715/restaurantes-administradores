import React, { useState, useEffect } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './Pedido.css';
import { db } from '../firebase';
import { doc, setDoc, collection, getDocs, query, where, orderBy, limit, deleteDoc, addDoc, Timestamp } from 'firebase/firestore';
import ConfirmationDelete from '../RESOURCES/THEMES/CONFIRMATIONDELETE/ConfirmationDelete';
import { FaEdit, FaTrash, FaSave, FaArrowLeft, FaCartPlus, FaCopy } from 'react-icons/fa'; // Import icons

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
  const formatPrice = (value) => {
    if (value === null || value === undefined || value === '') return '0';
    const stringValue = value.toString();
    const numberValue = parseFloat(stringValue.replace(/[$,]/g, ''));
    return `$${numberValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  };

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
    setClient({ ...client, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (userType === 'cliente') {
        if (!client.id) {
          const newId = await generateNewClientId();
          await setDoc(doc(db, "CLIENTES", newId), { ...client, id: newId });
          toast.success("Cliente registrado correctamente");
        }
        // Handle order creation logic here
        const newOrderId = await generateNewOrderId();
        const subtotal = calculateTotal();
        const valorDomicilio = parseFloat(barrios.find(barrio => barrio.name === client.barrio)?.deliveryPrice) || 0;
        const total = subtotal + valorDomicilio;

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
          subtotal: subtotal,
          valorDomicilio: valorDomicilio,
          total: total,
          timestamp: Timestamp.now()
        };
        await addDoc(collection(db, "PEDIDOS"), orderData);
        toast.success("Pedido registrado correctamente");
      } else {
        // Handle proveedor order logic here
      }
      handleBack();
    } catch (error) {
      console.error("Error al registrar:", error);
      toast.error("Error al registrar");
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
    const q = query(collection(db, 'PEDIDOS'), orderBy('idPedido', 'desc'), limit(1));
    const querySnapshot = await getDocs(q);
    let lastId = 0;
    querySnapshot.forEach((doc) => {
      lastId = parseInt(doc.data().idPedido, 10);
    });
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
    return cart.reduce((total, product) => total + parseFloat(product.price), 0);
  };

  const calculateChange = () => {
    const subtotal = calculateTotal();
    const deliveryCost = parseFloat(barrios.find(barrio => barrio.name === client.barrio)?.deliveryPrice) || 0;
    const total = subtotal + deliveryCost;
    const bill = billAmount ? parseFloat(billAmount) : 0;
    return bill - total;
  };

  const handleSelectAllIngredients = () => {
    if (selectedIngredients.length === 0) {
      setSelectedIngredients(selectedProduct.ingredients.split(', '));
    } else {
      setSelectedIngredients([]);
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

  const handlePaymentMethodChange = (e) => {
    setPaymentMethod(e.target.value);
    if (e.target.value !== 'EFECTIVO') {
      setBillAmount('');
    }
  };

  const confirmarPedido = () => {
    const pedido = cart.map(product => 
        `${product.name} - ${product.ingredients.map(ingredient => `Sin ${ingredient}`).join(', ')}`)
        .join('\n');

    const direccion = `${client.address} - ${client.barrio}`;
    const subtotal = parseFloat(calculateTotal()) || 0;
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
                <button onClick={() => handleUserTypeChange('proveedor')}>Proveedor</button>
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
                          <option value="BANCOLOMBIA">BANCOLOMBIA</option>
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
                                  <li key={ingredient}>Sin {ingredient}</li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                        <div>
                          <strong>Dirección:</strong> {client.address} - {client.barrio}
                        </div>
                        <div>
                          <strong>Subtotal:</strong> {formatPrice(calculateTotal())}
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
                          <strong>Total a Pagar:</strong> {formatPrice(calculateTotal() + (parseFloat(barrios.find(barrio => barrio.name === client.barrio)?.deliveryPrice) || 0))}
                        </div>
                      </div>
                      <div className="form-buttons">
                        <button type="submit" className="realizar-pedido-button"><FaSave /> Realizar Pedido</button>
                        <button type="button" className="confirmar-pedido-button" onClick={confirmarPedido}><FaCopy /> Confirmar Pedido</button>
                        <button type="button" className="add-products-button" onClick={() => setIsAdding(true)}><FaCartPlus /> Añadir Productos</button>
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
              <button className="close-button" onClick={() => setIsAdding(false)}>Listo</button>
              <select className="category-select" value={selectedCategory} onChange={handleCategoryChange}>
                {categories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
              <div className="productos-list">
                {filteredProducts.map((product) => (
                  <div key={product.id} className="productos-item">
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
                <button onClick={handleSelectAllIngredients}>Eliminar todo</button>
                <button onClick={addProductToCart}><FaCartPlus /> Seguir con la Cesta</button>
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
