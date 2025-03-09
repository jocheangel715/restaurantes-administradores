import React, { useState, useEffect } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './inventory.css'; // Import CSS for homepage
import '../RESOURCES/THEMES/dark.css'; // Import dark theme CSS
import { db } from '../firebase'; // Import Firebase configuration
import { doc, setDoc, collection, getDocs, query, orderBy, limit, deleteDoc } from 'firebase/firestore';
import ConfirmationDelete from '../RESOURCES/THEMES/CONFIRMATIONDELETE/ConfirmationDelete'; // Import ConfirmationDelete
import { FaEdit, FaTrash } from 'react-icons/fa'; // Import icons

const formatPrice = (value) => {
  if (value === null || value === undefined || value === '') return '0';
  const stringValue = value.toString(); // Ensure value is a string
  const numberValue = parseFloat(stringValue.replace(/[$,]/g, ''));
  return `$${numberValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};

const Inventory = ({ modalVisible, closeModal }) => {
  const [product, setProduct] = useState({ id: '', name: '', quantity: '', purchasePrice: '' });
  const [inventory, setInventory] = useState([]);
  const [isAdding, setIsAdding] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => {
    if (modalVisible) {
      fetchLastProductId();
      fetchInventory();
    }
  }, [modalVisible]);

  const fetchLastProductId = async () => {
    try {
      const q = query(collection(db, 'INVENTARIO'), orderBy('id', 'desc'), limit(1));
      const querySnapshot = await getDocs(q);
      let lastId = 0;
      querySnapshot.forEach((doc) => {
        lastId = parseInt(doc.data().id, 10);
      });
      setProduct((prevProduct) => ({ ...prevProduct, id: (lastId + 1).toString().padStart(8, '0') }));
    } catch (error) {
      console.error('Error fetching last product ID:', error);
    }
  };

  const fetchInventory = async () => {
    try {
      const q = query(collection(db, 'INVENTARIO'), orderBy('id', 'asc'));
      const querySnapshot = await getDocs(q);
      const items = [];
      querySnapshot.forEach((doc) => {
        items.push(doc.data());
      });
      setInventory(items);
    } catch (error) {
      console.error('Error fetching inventory:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
  
    if (name === "purchasePrice") {
      // Permitir solo números y un solo punto decimal
      let numericValue = value.replace(/[^0-9.]/g, "");
      
      // Asegurar que solo haya un punto decimal
      const parts = numericValue.split(".");
      if (parts.length > 2) {
        numericValue = parts[0] + "." + parts.slice(1).join("");
      }
  
      setProduct({ ...product, [name]: numericValue });
    } else {
      setProduct({ ...product, [name]: value.toUpperCase() });
    }
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const formattedProduct = {
        ...product,
        // Guardar solo números sin formato en la base de datos
        purchasePrice: product.purchasePrice.replace(/[^0-9.]/g, ""),
      };
  
      await setDoc(doc(db, "INVENTARIO", product.id), formattedProduct);
      toast.success("Producto registrado correctamente");
      fetchInventory();
      handleBack(); // Show the "Agregar" button and the product list
    } catch (error) {
      console.error("Error al registrar el producto:", error);
      toast.error("Error al registrar el producto");
    }
  };
  
  const handleEdit = (item) => {
    setProduct(item);
    setIsAdding(true);
  };

  const handleDelete = (id) => {
    setDeleteId(id);
    setShowConfirmation(true);
  };

  const confirmDelete = async () => {
    try {
      await deleteDoc(doc(db, 'INVENTARIO', deleteId));
      toast.success('Producto eliminado correctamente');
      fetchInventory();
    } catch (error) {
      console.error('Error al eliminar el producto:', error);
      toast.error('Error al eliminar el producto');
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
    setProduct({ id: '', name: '', quantity: '', purchasePrice: '' });
  };

  const handleAdd = () => {
    fetchLastProductId();
    setIsAdding(true);
    setProduct({ id: '', name: '', quantity: '', purchasePrice: '' }); // Clear inputs
  };

  const handleCloseModal = () => {
    closeModal();
    handleBack(); // Reset to show the list and "Agregar" button
  };

  return (
    <div className="inventory-container">
      <ToastContainer />
      {modalVisible && (
        <>
          <div className="inventory-overlay" onClick={handleCloseModal}></div>
          <div className="inventory-modal">
            <div className="inventory-modal-content">
              <span className="inventory-close" onClick={handleCloseModal}>&times;</span>
              <h2 className="modal-header">Administrar Inventario</h2>
              {isAdding ? (
                <>
                  <form className="inventory-form" onSubmit={handleSubmit}>
                    <div className="inventory-form-group">
                      <label className="inventory-label">ID:</label>
                      <input
                        className="inventory-input"
                        type="text"
                        name="id"
                        value={product.id}
                        onChange={handleInputChange}
                        readOnly
                      />
                    </div>
                    <div className="inventory-form-group">
                      <label className="inventory-label">Nombre del Producto:</label>
                      <input
                        className="inventory-input"
                        type="text"
                        name="name"
                        value={product.name}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="inventory-form-group">
                      <label className="inventory-label">Cantidad:</label>
                      <input
                        className="inventory-input"
                        type="text"
                        name="quantity"
                        value={product.quantity}
                        onChange={(e) => {
                          const { name, value } = e.target;
                          if (/^\d*$/.test(value)) {
                            setProduct({ ...product, [name]: value });
                          }
                        }}
                      />
                    </div>
                    <div className="inventory-form-group">
                      <label className="inventory-label">Precio de Compra:</label>
                      <input
                        className="inventory-input"
                        type="text"
                        name="purchasePrice"
                        value={formatPrice(product.purchasePrice)}
                        onChange={handleInputChange}
                      />
                    </div>
                    <button className="inventory-button" type="submit">Guardar</button>
                    <button className="inventory-button" type="button" onClick={handleBack}>Atrás</button>
                  </form>
                </>
              ) : (
                <>
                  <button className="inventory-button" onClick={handleAdd}>Agregar</button>
                  <div className="inventory-list">
                    {inventory.map((item) => (
                      <div key={item.id} className="inventory-item">
                        <span>{item.name}</span>
                        <div className="button-container">
                          <button onClick={() => handleEdit(item)}><FaEdit /></button>
                          <button onClick={() => handleDelete(item.id)}><FaTrash /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
      {showConfirmation && (
        <ConfirmationDelete
          title="Confirmar eliminación"
          message="¿Estás seguro de que deseas eliminar este producto?"
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
        />
      )}
    </div>
  );
};

export default Inventory;
