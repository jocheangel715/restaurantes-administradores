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
  const [producto, setProducto] = useState({ id: '', category: '', name: '', price: '', ingredients: '', url: '', turno: '' });
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
      setCategories(['Todas las Categorías', ...Array.from(categoriesSet)]);
      
      // Mantener los productos filtrados según la categoría seleccionada
      if (selectedCategory === 'Todas las Categorías') {
        setFilteredProductos(items);
      } else {
        setFilteredProductos(items.filter(product => product.category === selectedCategory));
      }
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

  const isValidUrl = (url) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
  
    // Validar campos obligatorios
    if (!producto.name.trim()) {
      toast.error("Por favor, completa el campo 'Nombre del Producto'.");
      return;
    }
    if (!producto.price) {
      toast.error("Por favor, completa el campo 'Precio'.");
      return;
    }
    if (!producto.category) {
      toast.error("Por favor, selecciona una 'Categoría'.");
      return;
    }
    if (!producto.ingredients.trim()) {
      toast.error("Por favor, completa el campo 'Ingredientes'.");
      return;
    }
    if (!producto.status) {
      toast.error("Por favor, selecciona un 'Estado'.");
      return;
    }
  
    try {
      const formattedProducto = {
        ...producto,
        price: producto.price.toString().replace(/[^0-9.]/g, ''), // Asegurar que el precio sea un string
        ingredients: producto.ingredients.toUpperCase(), // Guardar ingredientes en mayúsculas
        url: producto.url, // Incluir URL
        turno: producto.turno, // Incluir Turno
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
      await fetchProductos(); // Asegurarse de actualizar los productos
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
    setProducto({ id: '', category: '', name: '', price: '', ingredients: '', url: '', turno: '' });
  };

  const handleAdd = () => {
    fetchLastProductoId();
    setIsAdding(true);
    setProducto({ id: '', category: '', name: '', price: '', ingredients: '', url: '', turno: '' });
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

          // Validate JSON structure
          if (!json.menu || !Array.isArray(json.menu)) {
            throw new Error("El archivo JSON no tiene el formato esperado.");
          }

          await saveProductsFromJson(json);
          toast.success("Productos importados correctamente");
          fetchProductos();
        } catch (error) {
          console.error("Error al importar productos:", error);
          toast.error("Error al importar productos. Asegúrate de que el archivo tenga el formato correcto.");
        }
      };
      reader.readAsText(file);
    }
  };

  const saveProductsFromJson = async (json) => {
    for (const product of json.menu) {
      try {
        const newId = await generateNewId();
        const formattedProduct = {
          id: newId,
          category: product.category || "Sin Categoría",
          name: product.name || "Sin Nombre",
          price: product.price ? product.price.toString() : "0",
          ingredients: product.ingredients || "",
          status: product.status || "ENABLE",
          url: product.url || "", // Include URL field
          turno: product.turno || "", // Include Turno field
        };
        await setDoc(doc(db, "MENU", newId), formattedProduct);
      } catch (error) {
        console.error("Error al guardar un producto del JSON:", error);
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

  const handleDownloadMenu = async () => {
    try {
      const q = query(collection(db, 'MENU'), orderBy('id', 'asc'));
      const querySnapshot = await getDocs(q);
      const menu = [];

      querySnapshot.forEach((doc) => {
        menu.push(doc.data());
      });

      const json = JSON.stringify({ menu }, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = 'menu.json';
      link.click();

      URL.revokeObjectURL(url);
      toast.success("Menú descargado correctamente");
    } catch (error) {
      console.error("Error al descargar el menú:", error);
      toast.error("Error al descargar el menú");
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
              <button className="hidden" onClick={handleDownloadMenu}>Descargar Menú</button>
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
                    <option value="ENABLE">DISPONIBLE</option>
                    <option value="DISABLE">NO DISPONIBLE</option>
                  </select>
                </div>
                <div className="productos-form-group">
                  <label className="productos-label">URL:</label>
                  <input
                    className="productos-input"
                    type="text"
                    name="url"
                    value={producto.url}
                    onChange={handleInputChange}
                  />
                  {producto.url && isValidUrl(producto.url) && (
                    <div className="url-preview">
                      <img
                        src={producto.url}
                        alt="Vista previa"
                        style={{ maxWidth: '100%', maxHeight: '200px', marginTop: '10px' }}
                        onError={(e) => {
                          e.target.style.display = 'none';
                          toast.error("La URL proporcionada no es válida para una imagen.");
                        }}
                      />
                    </div>
                  )}
                </div>
                <div className="productos-form-group">
                  <label className="productos-label">Turno:</label>
                  <input
                    className="productos-input"
                    type="text"
                    name="turno"
                    value={producto.turno}
                    onChange={handleInputChange}
                  />
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
