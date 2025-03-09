import React, { useState, useEffect } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './Barrios.css';
import { db } from '../firebase';
import { doc, setDoc, collection, getDocs, query, orderBy, limit, deleteDoc } from 'firebase/firestore';
import ConfirmationDelete from '../RESOURCES/THEMES/CONFIRMATIONDELETE/ConfirmationDelete';
import { FaEdit, FaTrash } from 'react-icons/fa'; // Import icons

const formatPrice = (value) => {
  if (value === null || value === undefined || value === '') return '0';
  const stringValue = value.toString();
  const numberValue = parseFloat(stringValue.replace(/[$,]/g, ''));
  return `$${numberValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};

const Barrios = ({ modalVisible, closeModal }) => {
  const [barrio, setBarrio] = useState({ id: '', name: '', deliveryPrice: '' });
  const [barrios, setBarrios] = useState([]);
  const [isAdding, setIsAdding] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => {
    if (modalVisible) {
      fetchLastBarrioId();
      fetchBarrios();
    }
  }, [modalVisible]);

  const fetchLastBarrioId = async () => {
    try {
      const q = query(collection(db, 'BARRIOS'), orderBy('id', 'desc'), limit(1));
      const querySnapshot = await getDocs(q);
      let lastId = 0;
      querySnapshot.forEach((doc) => {
        lastId = parseInt(doc.data().id, 10);
      });
      setBarrio((prevBarrio) => ({ ...prevBarrio, id: (lastId + 1).toString().padStart(8, '0') }));
    } catch (error) {
      console.error('Error fetching last barrio ID:', error);
    }
  };

  const fetchBarrios = async () => {
    try {
      const q = query(collection(db, 'BARRIOS'), orderBy('id', 'asc'));
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

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setBarrio({ ...barrio, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const formattedBarrio = {
        ...barrio,
        deliveryPrice: barrio.deliveryPrice.replace(/[^0-9.]/g, ''),
      };
      await setDoc(doc(db, "BARRIOS", barrio.id), formattedBarrio);
      toast.success("Barrio registrado correctamente");
      fetchBarrios();
      handleBack();
    } catch (error) {
      console.error("Error al registrar el barrio:", error);
      toast.error("Error al registrar el barrio");
    }
  };

  const handleEdit = (item) => {
    setBarrio(item);
    setIsAdding(true);
  };

  const handleDelete = (id) => {
    setDeleteId(id);
    setShowConfirmation(true);
  };

  const confirmDelete = async () => {
    try {
      await deleteDoc(doc(db, 'BARRIOS', deleteId));
      toast.success('Barrio eliminado correctamente');
      fetchBarrios();
    } catch (error) {
      console.error('Error al eliminar el barrio:', error);
      toast.error('Error al eliminar el barrio');
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
    setBarrio({ id: '', name: '', deliveryPrice: '' });
  };

  const handleAdd = () => {
    fetchLastBarrioId();
    setIsAdding(true);
    setBarrio({ id: '', name: '', deliveryPrice: '' });
  };

  const handleCloseModal = () => {
    closeModal();
    handleBack();
  };

  return (
    <div className="barrios-container">
      <ToastContainer />
      {modalVisible && (
        <>
          <div className="barrios-overlay" onClick={handleCloseModal}></div>
          <div className="barrios-modal">
            <div className="barrios-modal-content">
              <span className="barrios-close" onClick={handleCloseModal}>&times;</span>
              <h2 className="modal-header">Administrar Barrios</h2>
              {isAdding ? (
                <>
                  <form className="barrios-form" onSubmit={handleSubmit}>
                    <div className="barrios-form-group">
                      <label className="barrios-label">ID:</label>
                      <input
                        className="barrios-input"
                        type="text"
                        name="id"
                        value={barrio.id}
                        onChange={handleInputChange}
                        readOnly
                      />
                    </div>
                    <div className="barrios-form-group">
                      <label className="barrios-label">Nombre del Barrio:</label>
                      <input
                        className="barrios-input"
                        type="text"
                        name="name"
                        value={barrio.name}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="barrios-form-group">
                      <label className="barrios-label">Precio de Domicilio:</label>
                      <input
                        className="barrios-input"
                        type="text"
                        name="deliveryPrice"
                        value={formatPrice(barrio.deliveryPrice)}
                        onChange={handleInputChange}
                      />
                    </div>
                    <button className="barrios-button" type="submit">Guardar</button>
                    <button className="barrios-button" type="button" onClick={handleBack}>Atrás</button>
                  </form>
                </>
              ) : (
                <>
                  <button className="barrios-button" onClick={handleAdd}>Agregar</button>
                  <div className="barrios-list">
                    {barrios.map((item) => (
                      <div key={item.id} className="barrios-item">
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
          message="¿Estás seguro de que deseas eliminar este barrio?"
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
        />
      )}
    </div>
  );
};

export default Barrios;
