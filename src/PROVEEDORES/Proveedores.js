import React, { useState, useEffect } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './Proveedores.css';
import { db } from '../firebase';
import { doc, setDoc, collection, getDocs, query, orderBy, limit, deleteDoc } from 'firebase/firestore';
import ConfirmationDelete from '../RESOURCES/THEMES/CONFIRMATIONDELETE/ConfirmationDelete';
import { FaEdit, FaTrash } from 'react-icons/fa'; // Import icons

const Proveedores = ({ modalVisible, closeModal }) => {
  const [proveedor, setProveedor] = useState({ id: '', name: '', phoneCountryCode: '+1', phone: '' });
  const [proveedores, setProveedores] = useState([]);
  const [isAdding, setIsAdding] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => {
    if (modalVisible) {
      fetchLastProveedorId();
      fetchProveedores();
    }
  }, [modalVisible]);

  const fetchLastProveedorId = async () => {
    try {
      const q = query(collection(db, 'PROVEEDORES'), orderBy('id', 'desc'), limit(1));
      const querySnapshot = await getDocs(q);
      let lastId = 0;
      querySnapshot.forEach((doc) => {
        lastId = parseInt(doc.data().id, 10);
      });
      setProveedor((prevProveedor) => ({ ...prevProveedor, id: (lastId + 1).toString().padStart(8, '0') }));
    } catch (error) {
      console.error('Error fetching last proveedor ID:', error);
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

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProveedor({ ...proveedor, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const { phoneCountryCode, ...proveedorData } = proveedor;
      const formattedProveedor = {
        ...proveedorData,
        phone: `${proveedor.phoneCountryCode}${proveedor.phone}`,
      };
      await setDoc(doc(db, "PROVEEDORES", proveedor.id), formattedProveedor);
      toast.success("Proveedor registrado correctamente");
      fetchProveedores();
      handleBack();
    } catch (error) {
      console.error("Error al registrar el proveedor:", error);
      toast.error("Error al registrar el proveedor");
    }
  };

  const handleEdit = (item) => {
    const phoneCountryCode = item.phone.slice(0, item.phone.indexOf(item.phone.match(/\d/)));
    const phone = item.phone.slice(item.phone.indexOf(item.phone.match(/\d/)));
    setProveedor({ ...item, phoneCountryCode, phone });
    setIsAdding(true);
  };

  const handleDelete = (id) => {
    setDeleteId(id);
    setShowConfirmation(true);
  };

  const confirmDelete = async () => {
    try {
      await deleteDoc(doc(db, 'PROVEEDORES', deleteId));
      toast.success('Proveedor eliminado correctamente');
      fetchProveedores();
    } catch (error) {
      console.error('Error al eliminar el proveedor:', error);
      toast.error('Error al eliminar el proveedor');
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
    setProveedor({ id: '', name: '', phoneCountryCode: '+1', phone: '' });
  };

  const handleAdd = () => {
    fetchLastProveedorId();
    setIsAdding(true);
    setProveedor({ id: '', name: '', phoneCountryCode: '+1', phone: '' });
  };

  const handleCloseModal = () => {
    closeModal();
    handleBack();
  };

  return (
    <div className="proveedores-container">
      <ToastContainer />
      {modalVisible && (
        <>
          <div className="proveedores-overlay" onClick={handleCloseModal}></div>
          <div className="proveedores-modal">
            <div className="proveedores-modal-content">
              <span className="proveedores-close" onClick={handleCloseModal}>&times;</span>
              <h2 className="modal-header">Administrar Proveedores</h2>
              {isAdding ? (
                <>
                  <form className="proveedores-form" onSubmit={handleSubmit}>
                    <div className="proveedores-form-group">
                      <label className="proveedores-label">ID:</label>
                      <input
                        className="proveedores-input"
                        type="text"
                        name="id"
                        value={proveedor.id}
                        onChange={handleInputChange}
                        readOnly
                      />
                    </div>
                    <div className="proveedores-form-group">
                      <label className="proveedores-label">Nombre del Proveedor:</label>
                      <input
                        className="proveedores-input"
                        type="text"
                        name="name"
                        value={proveedor.name}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="proveedores-form-group">
                      <label className="proveedores-label">Teléfono:</label>
                      <div className="phone-container">
                        <select
                          className="phone-country-code"
                          name="phoneCountryCode"
                          value={proveedor.phoneCountryCode}
                          onChange={handleInputChange}
                          required
                        >
                          <option value="+1">🇺🇸 +1</option>
                          <option value="+52">🇲🇽 +52</option>
                          <option value="+57">🇨🇴 +57</option>
                          <option value="+58">🇻🇪 +58</option>
                          {/* Add more country codes as needed */}
                        </select>
                        <input
                          className="proveedores-input phone-number"
                          type="text"
                          name="phone"
                          value={proveedor.phone}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                    </div>
                    <button className="proveedores-button" type="submit">Guardar</button>
                    <button className="proveedores-button" type="button" onClick={handleBack}>Atrás</button>
                  </form>
                </>
              ) : (
                <>
                  <button className="proveedores-button" onClick={handleAdd}>Agregar</button>
                  <div className="proveedores-list">
                    {proveedores.map((item) => (
                      <div key={item.id} className="proveedores-item">
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
          message="¿Estás seguro de que deseas eliminar este proveedor?"
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
        />
      )}
    </div>
  );
};

export default Proveedores;
