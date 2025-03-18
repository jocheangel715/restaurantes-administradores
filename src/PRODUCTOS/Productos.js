import React, { useState, useEffect } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './Productos.css';
import { db } from '../firebase';
import { doc, setDoc, collection, getDocs, query, orderBy, limit, deleteDoc } from 'firebase/firestore';
import ConfirmationDelete from '../RESOURCES/THEMES/CONFIRMATIONDELETE/ConfirmationDelete';
import { FaEdit, FaTrash } from 'react-icons/fa'; // Import icons

const formatPrice = (value) => {
  if (value === null || value === undefined || value === '') return '0';
  const stringValue = value.toString();
  const numberValue = parseFloat(stringValue.replace(/[$,]/g, ''));

  if (isNaN(numberValue)) return '0';

  return `$${numberValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};

const categoryOptions = [
  'Seleccionar Categoria','Papas Locas', 'Patacones', 'Choripapas', 'Salchipapas', 'Desgranados', 
  'Especiales', 'Promociones', 'Hamburguesas', 'Perros', 'Adicionales', 'Bebidas'
];

const Productos = ({ modalVisible, closeModal }) => {
  const [producto, setProducto] = useState({ id: '', category: '', name: '', price: '', ingredients: '' });
  const [productos, setProductos] = useState([]);
  const [filteredProductos, setFilteredProductos] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('Todas las Categorías');
  const [isAdding, setIsAdding] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => {
    if (modalVisible) {
      fetchLastProductoId();
      fetchProductos();
    }
  }, [modalVisible]);

  const fetchLastProductoId = async () => {
    try {
      const q = query(collection(db, 'MENU'), orderBy('id', 'desc'), limit(1));
      const querySnapshot = await getDocs(q);
      let lastId = 0;
      querySnapshot.forEach((doc) => {
        lastId = parseInt(doc.data().id, 10);
      });
      setProducto((prevProducto) => ({ ...prevProducto, id: (lastId + 1).toString().padStart(8, '0') }));
    } catch (error) {
      console.error('Error fetching last producto ID:', error);
    }
  };

  const fetchProductos = async () => {
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
      setProductos(items);
      setFilteredProductos(items);
      setCategories(['Todas las Categorías', ...Array.from(categoriesSet)]);
    } catch (error) {
      console.error('Error fetching productos:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
  
    if (name === "price") {
      const rawValue = value.replace(/[$,]/g, ''); // Eliminar símbolos para convertir
      const numberValue = parseFloat(rawValue);
  
      // Si es un número válido, lo guarda con formato; si no, guarda "0"
      setProducto({ ...producto, [name]: isNaN(numberValue) ? 0 : numberValue });
  
      // Actualiza el campo de entrada con formato mientras se escribe
      e.target.value = formatPrice(numberValue);
    } else {
      setProducto({ ...producto, [name]: value });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const formattedProducto = {
        ...producto,
        price: producto.price.replace(/[^0-9.]/g, ''),
      };
      await setDoc(doc(db, "MENU", producto.id), formattedProducto);
      toast.success("Producto registrado correctamente");
      fetchProductos();
      handleBack();
    } catch (error) {
      console.error("Error al registrar el producto:", error);
      toast.error("Error al registrar el producto");
    }
  };

  const handleEdit = (item) => {
    setProducto(item);
    setIsAdding(true);
  };

  const handleDelete = (id) => {
    setDeleteId(id);
    setShowConfirmation(true);
  };

  const confirmDelete = async () => {
    try {
      await deleteDoc(doc(db, 'MENU', deleteId));
      toast.success('Producto eliminado correctamente');
      fetchProductos();
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
    setProducto({ id: '', category: '', name: '', price: '', ingredients: '' });
  };

  const handleAdd = () => {
    fetchLastProductoId();
    setIsAdding(true);
    setProducto({ id: '', category: '', name: '', price: '', ingredients: '' });
  };

  const handleCloseModal = () => {
    closeModal();
    handleBack();
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const json = JSON.parse(event.target.result);
          await saveProductsFromJson(json);
          toast.success("Productos importados correctamente");
          fetchProductos();
        } catch (error) {
          console.error("Error al importar productos:", error);
          toast.error("Error al importar productos");
        }
      };
      reader.readAsText(file);
    }
  };

  const saveProductsFromJson = async (json) => {
    for (const category of json.menu) {
      for (const product of category.productos) {
        const newId = await generateNewId();
        const formattedProduct = {
          id: newId,
          category: category.categoria,
          name: product.nombre,
          price: product.precio.toString(),
          ingredients: product.ingredientes.join(', '),
        };
        await setDoc(doc(db, "MENU", newId), formattedProduct);
      }
    }
  };

  const generateNewId = async () => {
    const q = query(collection(db, 'MENU'), orderBy('id', 'desc'), limit(1));
    const querySnapshot = await getDocs(q);
    let lastId = 0;
    querySnapshot.forEach((doc) => {
      lastId = parseInt(doc.data().id, 10);
    });
    return (lastId + 1).toString().padStart(8, '0');
  };

  const handleCategoryChange = (e) => {
    const category = e.target.value;
    setSelectedCategory(category);
    if (category === 'Todas las Categorías') {
      setFilteredProductos(productos);
    } else {
      setFilteredProductos(productos.filter(product => product.category === category));
    }
  };

  return (
    <div className="productos-container">
      <ToastContainer />
      {modalVisible && (
        <>
          <div className="productos-overlay" onClick={handleCloseModal}></div>
          <div className="productos-modal">
            <div className="productos-modal-content">
              <span className="productos-close" onClick={handleCloseModal}>&times;</span>
              <h2 className="modal-header">Administrar Productos</h2>
              <button className="productos-button" onClick={handleAdd}>Agregar</button>
              <input className="hidden" type="file" accept=".json" onChange={handleFileUpload} />
              <select className="category-select" value={selectedCategory} onChange={handleCategoryChange}>
                {categories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
              <div className="productos-list">
                {filteredProductos.map((item) => (
                  <div key={item.id} className={`productos-item ${item.status === 'DISABLE' ? 'disable' : ''}`}>
                    <span>{item.name} - {formatPrice(item.price)}</span>
                    <div className="button-container">
                      <button onClick={() => handleEdit(item)}><FaEdit /></button>
                      <button onClick={() => handleDelete(item.id)}><FaTrash /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
      {isAdding && (
        <>
          <div className="edit-productos-overlay" onClick={handleBack}></div>
          <div className="edit-productos-modal">
            <div className="edit-productos-modal-content">
              <span className="productos-close" onClick={handleBack}>&times;</span>
              <h2 className="modal-header">Editar Producto</h2>
              <form className="productos-form" onSubmit={handleSubmit}>
                <div className="productos-form-group">
                  <label className="productos-label">ID:</label>
                  <input
                    className="productos-input"
                    type="text"
                    name="id"
                    value={producto.id}
                    onChange={handleInputChange}
                    readOnly
                  />
                </div>
                <div className="productos-form-group">
                  <label className="productos-label">Categoría:</label>
                  <select
                    className="productos-input"
                    name="category"
                    value={producto.category}
                    onChange={handleInputChange}
                  >
                    {categoryOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
                <div className="productos-form-group">
                  <label className="productos-label">Nombre del Producto:</label>
                  <input
                    className="productos-input"
                    type="text"
                    name="name"
                    value={producto.name}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="productos-form-group">
                  <label className="productos-label">Precio:</label>
                  <input
                    className="productos-input"
                    type="text"
                    name="price"
                    value={formatPrice(producto.price)}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="productos-form-group">
                  <label className="productos-label">Ingredientes:</label>
                  <textarea
                    className="productos-input"
                    name="ingredients"
                    value={producto.ingredients}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="productos-form-group">
                  <label className="productos-label">Estado:</label>
                  <select
                    className="productos-input"
                    name="status"
                    value={producto.status}
                    onChange={handleInputChange}
                  >
                    <option value="ENABLE">ENABLE</option>
                    <option value="DISABLE">DISABLE</option>
                  </select>
                </div>
                <button className="productos-button" type="submit">Guardar</button>
                <button className="productos-button" type="button" onClick={handleBack}>Atrás</button>
              </form>
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

export default Productos;
