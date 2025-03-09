import React, { useState, useEffect } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './Clientes.css';
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

const Clientes = ({ modalVisible, closeModal }) => {
  const [client, setClient] = useState({ id: '', name: '', role: '', phone: '', phoneCountryCode: '+1', address: '', barrio: '', deliveryPrice: '', salary: '', scheduleStart: '', scheduleEnd: '' });
  const [clients, setClients] = useState([]);
  const [barrios, setBarrios] = useState([]); // State for barrios
  const [isAdding, setIsAdding] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => {
    if (modalVisible) {
      fetchLastClientId();
      fetchClients();
      fetchBarrios(); // Fetch barrios when modal is visible
    }
  }, [modalVisible]);

  const fetchLastClientId = async () => {
    try {
      const q = query(collection(db, 'CLIENTES'), orderBy('id', 'desc'), limit(1));
      const querySnapshot = await getDocs(q);
      let lastId = 0;
      querySnapshot.forEach((doc) => {
        lastId = parseInt(doc.data().id, 10);
      });
      setClient((prevClient) => ({ ...prevClient, id: (lastId + 1).toString().padStart(8, '0') }));
    } catch (error) {
      console.error('Error fetching last client ID:', error);
    }
  };

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

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setClient({ ...client, [name]: value });

    if (name === 'barrio') {
      const selectedBarrio = barrios.find(barrio => barrio.name === value);
      setClient({ ...client, barrio: value, deliveryPrice: selectedBarrio ? selectedBarrio.deliveryPrice : '' });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { role, name, phone, address, barrio, deliveryPrice, salary, scheduleStart, scheduleEnd } = client;

    if (role === 'CLIENTE') {
      if (!name || !phone || !address || !barrio) {
        toast.error("Por favor complete todos los campos obligatorios para el cliente.");
        return;
      }
    } else {
      if (!name || !phone || !salary || !scheduleStart || !scheduleEnd) {
        toast.error("Por favor complete todos los campos obligatorios para el rol seleccionado.");
        return;
      }
    }

    try {
      const { phoneCountryCode, ...clientData } = client;
      const formattedClient = {
        ...clientData,
        phone: `${client.phoneCountryCode}${client.phone}`,
        salary: client.salary.replace(/[^0-9.]/g, ''),
        schedule: `${client.scheduleStart}-${client.scheduleEnd}`
      };
      await setDoc(doc(db, "CLIENTES", client.id), formattedClient);
      toast.success("Cliente registrado correctamente");
      fetchClients();
      handleBack();
    } catch (error) {
      console.error("Error al registrar el cliente:", error);
      toast.error("Error al registrar el cliente");
    }
  };

  const handleEdit = (item) => {
    const [scheduleStart, scheduleEnd] = item.schedule.split('-');
    const phoneCountryCode = item.phone.slice(0, item.phone.indexOf(item.phone.match(/\d/)));
    const phone = item.phone.slice(item.phone.indexOf(item.phone.match(/\d/)));
    setClient({ ...item, scheduleStart, scheduleEnd, phoneCountryCode, phone });
    setIsAdding(true);
  };

  const handleDelete = (id) => {
    setDeleteId(id);
    setShowConfirmation(true);
  };

  const confirmDelete = async () => {
    try {
      await deleteDoc(doc(db, 'CLIENTES', deleteId));
      toast.success('Cliente eliminado correctamente');
      fetchClients();
    } catch (error) {
      console.error('Error al eliminar el cliente:', error);
      toast.error('Error al eliminar el cliente');
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
    setClient({ id: '', name: '', role: '', phone: '', phoneCountryCode: '+1', address: '', barrio: '', deliveryPrice: '', salary: '', scheduleStart: '', scheduleEnd: '' });
  };

  const handleAdd = () => {
    fetchLastClientId();
    setIsAdding(true);
    setClient({ id: '', name: '', role: '', phone: '', phoneCountryCode: '+1', address: '', barrio: '', deliveryPrice: '', salary: '', scheduleStart: '', scheduleEnd: '' });
  };

  const handleCloseModal = () => {
    closeModal();
    handleBack();
  };

  const generateTimeOptions = () => {
    const times = [];
    for (let hour = 5; hour <= 23; hour++) {
      const ampm = hour < 12 ? 'AM' : 'PM';
      const displayHour = hour % 12 === 0 ? 12 : hour % 12;
      times.push(`${displayHour}:00 ${ampm}`);
    }
    times.push('12:00 AM');
    return times;
  };

  return (
    <div className="clients-container">
      <ToastContainer />
      {modalVisible && (
        <>
          <div className="clients-overlay" onClick={handleCloseModal}></div>
          <div className="clients-modal">
            <div className="clients-modal-content">
              <span className="clients-close" onClick={handleCloseModal}>&times;</span>
              <h2 className="modal-header">Administrar Clientes</h2>
              {isAdding ? (
                <>
                  <form className="clients-form" onSubmit={handleSubmit}>
                    <div className="clients-form-group">
                      <label className="clients-label">ID:</label>
                      <input
                        className="clients-input"
                        type="text"
                        name="id"
                        value={client.id}
                        onChange={handleInputChange}
                        readOnly
                      />
                    </div>
                    <div className="clients-form-group">
                      <label className="clients-label">Nombre:</label>
                      <input
                        className="clients-input"
                        type="text"
                        name="name"
                        value={client.name}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div className="clients-form-group">
                      <label className="clients-label">Rol:</label>
                      <select
                        className="clients-input"
                        name="role"
                        value={client.role}
                        onChange={handleInputChange}
                        required
                      >
                        <option value="">Seleccionar Rol</option>
                        <option value="ADMINISTRADOR">ADMINISTRADOR</option>
                        <option value="DOMICILIARIO">DOMICILIARIO</option>
                        <option value="COCINERO">COCINERO</option>
                      </select>
                    </div>
                    <div className="clients-form-group">
                      <label className="clients-label">Teléfono:</label>
                      <div className="phone-container">
                        <select
                          className="phone-country-code"
                          name="phoneCountryCode"
                          value={client.phoneCountryCode}
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
                          className="clients-input phone-number"
                          type="text"
                          name="phone"
                          value={client.phone}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                    </div>
                    {client.role === 'CLIENTE' && (
                      <>
                        <div className="clients-form-group">
                          <label className="clients-label">Dirección:</label>
                          <input
                            className="clients-input"
                            type="text"
                            name="address"
                            value={client.address}
                            onChange={handleInputChange}
                            required
                          />
                        </div>
                        <div className="clients-form-group">
                          <label className="clients-label">Barrio:</label>
                          <select
                            className="clients-input"
                            name="barrio"
                            value={client.barrio}
                            onChange={handleInputChange}
                            required
                          >
                            <option value="">Seleccionar barrio</option>
                            {barrios.map((barrio) => (
                              <option key={barrio.id} value={barrio.name}>{barrio.name} - {formatPrice(barrio.deliveryPrice)}</option>
                            ))}
                          </select>
                        </div>
                      </>
                    )}
                    {client.role !== 'CLIENTE' && (
                      <>
                        <div className="clients-form-group">
                          <label className="clients-label">Sueldo:</label>
                          <input
                            className="clients-input"
                            type="text"
                            name="salary"
                            value={formatPrice(client.salary)}
                            onChange={handleInputChange}
                            required
                          />
                        </div>
                        <div className="clients-form-group">
                          <label className="clients-label">Horario:</label>
                          <div className="schedule-container">
                            <select
                              className="clients-input schedule-select"
                              name="scheduleStart"
                              value={client.scheduleStart}
                              onChange={handleInputChange}
                              required
                            >
                              <option value="">ENTRADA</option>
                              {generateTimeOptions().map((time) => (
                                <option key={time} value={time}>{time}</option>
                              ))}
                            </select>
                            <select
                              className="clients-input schedule-select"
                              name="scheduleEnd"
                              value={client.scheduleEnd}
                              onChange={handleInputChange}
                              required
                            >
                              <option value="">SALIDA</option>
                              {generateTimeOptions().map((time) => (
                                <option key={time} value={time}>{time}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </>
                    )}
                    <button className="clients-button" type="submit">Guardar</button>
                    <button className="clients-button" type="button" onClick={handleBack}>Atrás</button>
                  </form>
                </>
              ) : (
                <>
                  <button className="clients-button" onClick={handleAdd}>Agregar</button>
                  <div className="clients-list">
                    {clients.map((item) => (
                      <div key={item.id} className="clients-item">
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
          message="¿Estás seguro de que deseas eliminar este cliente?"
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
        />
      )}
    </div>
  );
};

export default Clientes;
