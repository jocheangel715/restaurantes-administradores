import React, { useEffect, useState } from 'react';
import { doc, updateDoc, deleteDoc, getFirestore, collection, getDocs, getDoc, onSnapshot } from 'firebase/firestore';
import { FaEdit, FaTrash, FaPrint, FaCheck, FaCheckCircle } from 'react-icons/fa';
import { app } from '../firebase';
import './Clientes.css';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Carga from '../Loada/Carga';

const Clientes = ({ modalVisible, closeModal }) => {
  const [clientes, setClientes] = useState([]);
  const [barrios, setBarrios] = useState([]);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({ id: '', name: '', phone: '', barrio: '', address: '' });
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [search, setSearch] = useState('');
  const [clientesConCuenta, setClientesConCuenta] = useState({});
  const [cuentasModalVisible, setCuentasModalVisible] = useState(false);
  const [pedidosCliente, setPedidosCliente] = useState([]);
  const [clienteActual, setClienteActual] = useState(null);
  const [selectedPedidos, setSelectedPedidos] = useState([]);
  const [recomendaciones, setRecomendaciones] = useState({});
  const [showRecomendacionModal, setShowRecomendacionModal] = useState(false);
  const [recomendacionActual, setRecomendacionActual] = useState(null);
  const [clienteRecomendado, setClienteRecomendado] = useState(null);
  const [loadingRecomendacion, setLoadingRecomendacion] = useState(false);

  useEffect(() => {
    if (!modalVisible) return;
    fetchClientes();
    fetchBarrios();
    // Consultar cuentas de clientes y si tienen pedidos pendientes en tiempo real
    const db = getFirestore(app);
    const cuentasCol = collection(db, 'CUENTAS');
    const unsubscribeCuentas = onSnapshot(cuentasCol, (cuentasSnapshot) => {
      const cuentasMap = {};
      for (const docu of cuentasSnapshot.docs) {
        const data = docu.data();
        let tienePendientes = false;
        Object.values(data).forEach(pedidosMap => {
          Object.values(pedidosMap).forEach(pedido => {
            if (!pedido.pagado) tienePendientes = true;
          });
        });
        cuentasMap[docu.id] = tienePendientes;
      }
      setClientesConCuenta(cuentasMap);
    });
    // Consultar recomendaciones en tiempo real
    const recCol = collection(db, 'RECOMENDACIONES');
    const unsubscribeRec = onSnapshot(recCol, (recSnapshot) => {
      const recMap = {};
      recSnapshot.docs.forEach(docu => {
        recMap[docu.id] = { id: docu.id, ...docu.data() };
      });
      setRecomendaciones(recMap);
    });
    return () => {
      unsubscribeCuentas();
      unsubscribeRec();
    };
    // eslint-disable-next-line
  }, [modalVisible]);

  const fetchClientes = async () => {
    const db = getFirestore(app);
    const clientesCol = collection(db, 'CLIENTES');
    const clientesSnapshot = await getDocs(clientesCol);
    const clientesList = clientesSnapshot.docs.map(doc => ({ idDoc: doc.id, ...doc.data() }));
    setClientes(clientesList);
  };

  const fetchBarrios = async () => {
    const db = getFirestore(app);
    const barriosCol = collection(db, 'BARRIOS');
    const barriosSnapshot = await getDocs(barriosCol);
    const barriosList = barriosSnapshot.docs.map(doc => doc.data().name);
    setBarrios(barriosList);
  };

  const handleEdit = (cliente) => {
    setEditando(cliente.idDoc);
    setForm({ id: cliente.id, name: cliente.name, phone: cliente.phone, barrio: cliente.barrio, address: cliente.address });
  };

  const handleFormChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    const db = getFirestore(app);
    const ref = doc(db, 'CLIENTES', editando);
    await updateDoc(ref, { ...form });
    setEditando(null);
    setForm({ id: '', name: '', phone: '', barrio: '', address: '' });
    fetchClientes();
  };

  const handleDelete = (idDoc) => {
    setDeleteId(idDoc);
    setShowConfirm(true);
  };

  const confirmDelete = async () => {
    const db = getFirestore(app);
    await deleteDoc(doc(db, 'CLIENTES', deleteId));
    setShowConfirm(false);
    setDeleteId(null);
    fetchClientes();
  };

  const cancelDelete = () => {
    setShowConfirm(false);
    setDeleteId(null);
  };

  const handleSearch = (e) => {
    setSearch(e.target.value);
  };

  const filteredClientes = clientes.filter(cliente => {
    const val = search.toLowerCase();
    return (
      cliente.id?.toString().toLowerCase().includes(val) ||
      cliente.name?.toLowerCase().includes(val) ||
      cliente.phone?.toLowerCase().includes(val) ||
      cliente.barrio?.toLowerCase().includes(val) ||
      cliente.address?.toLowerCase().includes(val)
    );
  });

  // Función para obtener la cuenta de un cliente
  const getCuentaCliente = async (clienteId) => {
    const db = getFirestore(app);
    const docRef = doc(db, 'CUENTAS', clienteId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    return docSnap.data();
  };

  // Formato de miles
  const formatPrice = (value) => {
    if (!value) return '$0';
    return '$' + Number(value).toLocaleString('es-CO');
  };

  // Función para imprimir la cuenta en PDF
  const imprimirCuenta = async (cliente) => {
    const cuenta = await getCuentaCliente(cliente.id);
    if (!cuenta) return toast.error('El cliente no tiene cuenta.');

    const pedidos = [];

    Object.entries(cuenta).forEach(([fecha, pedidosMap]) => {
      Object.entries(pedidosMap).forEach(([idPedido, pedido]) => {
        if (!pedido.pagado) {
          pedidos.push({
            idPedido,
            cantidad: pedido.cart.length,
            pedido: pedido.cart.map(p => p.name).join(', '),
            hora: pedido.timestamp && pedido.timestamp.seconds
              ? new Date(pedido.timestamp.seconds * 1000).toLocaleTimeString()
              : '',
            total: pedido.total,
            pagado: 'NO PAGADO',
            isPagado: false,
          });
        }
      });
    });

    if (pedidos.length === 0) {
      return toast.error('No hay pedidos pendientes de pago para este cliente.');
    }

    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Cuenta de Cobro', 14, 18);

    doc.setFontSize(12);
    doc.text(`Cliente: ${cliente.name} (${cliente.id})`, 14, 28);

    autoTable(doc, {
      startY: 35,
      head: [['ID Pedido', 'Pedido', 'Hora', 'Total', 'Estado']],
      body: pedidos.map(p => [
        p.idPedido,
        p.pedido,
        p.hora,
        formatPrice(p.total),
        p.pagado,
      ]),
      styles: { fontSize: 10 },
      headStyles: { fillColor: [41, 128, 185] },
      columnStyles: {
        3: { halign: 'right' },
        4: { halign: 'center' },
      },
    });

    const parseTotal = (val) => {
      if (typeof val === 'number') return val;
      if (!val) return 0;
      return Number(String(val).replace(/[$.,]/g, ''));
    };

    const totalPendiente = pedidos.reduce((sum, p) => {
      return !p.isPagado ? sum + parseTotal(p.total) : sum;
    }, 0);

    doc.setFontSize(22);
    doc.text(`Total Pendiente: ${formatPrice(totalPendiente)}`, 200, doc.lastAutoTable.finalY + 20, {
      align: 'right',
    });

    doc.save(`Cuenta_${cliente.name}_${cliente.id}.pdf`);
  };


  if (!modalVisible) return null;

  // Abre el modal de cuentas y carga los pedidos pendientes
  const abrirCuentasModal = async (cliente) => {
    setClienteActual(cliente);
    const cuenta = await getCuentaCliente(cliente.id);
    if (!cuenta) {
      alert('El cliente no tiene cuenta.');
      return;
    }
    const pedidos = [];
    Object.entries(cuenta).forEach(([fecha, pedidosMap]) => {
      Object.entries(pedidosMap).forEach(([idPedido, pedido]) => {
        if (!pedido.pagado) {
          pedidos.push({
            idPedido,
            pedido,
            fecha,
          });
        }
      });
    });
    setPedidosCliente(pedidos);
    setSelectedPedidos([]);
    setCuentasModalVisible(true);
  };

  const cerrarCuentasModal = () => {
    setCuentasModalVisible(false);
    setPedidosCliente([]);
    setClienteActual(null);
    setSelectedPedidos([]);
  };

  const togglePedidoSeleccionado = (idPedido) => {
    setSelectedPedidos(prev =>
      prev.includes(idPedido)
        ? prev.filter(id => id !== idPedido)
        : [...prev, idPedido]
    );
  };

  // Imprimir todos los pedidos pendientes
  const imprimirPedidosSeleccionados = () => {
    if (!clienteActual || pedidosCliente.length === 0) {
      toast.error('No hay pedidos pendientes para imprimir.');
      return;
    }
    const pedidos = pedidosCliente.map(p => {
      const pedido = p.pedido;
      return {
        idPedido: p.idPedido,
        pedido: pedido.cart.map(item => item.name).join(', '),
        hora: pedido.timestamp && pedido.timestamp.seconds
          ? new Date(pedido.timestamp.seconds * 1000).toLocaleTimeString()
          : '',
        total: pedido.total,
        pagado: 'NO PAGADO',
        isPagado: false,
      };
    });
    if (pedidos.length === 0) return;
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Cuenta de Cobro', 14, 18);
    doc.setFontSize(12);
    doc.text(`Cliente: ${clienteActual.name} (${clienteActual.id})`, 14, 28);
    autoTable(doc, {
      startY: 35,
      head: [['ID Pedido', 'Pedido', 'Hora', 'Total', 'Estado']],
      body: pedidos.map(p => [
        p.idPedido,
        p.pedido,
        p.hora,
        formatPrice(p.total),
        p.pagado,
      ]),
      styles: { fontSize: 10 },
      headStyles: { fillColor: [41, 128, 185] },
      columnStyles: {
        3: { halign: 'right' },
        4: { halign: 'center' },
      },
    });
    const parseTotal = (val) => {
      if (typeof val === 'number') return val;
      if (!val) return 0;
      return Number(String(val).replace(/[$.,]/g, ''));
    };
    const totalPendiente = pedidos.reduce((sum, p) => {
      return !p.isPagado ? sum + parseTotal(p.total) : sum;
    }, 0);
    doc.setFontSize(22);
    doc.text(`Total Pendiente: ${formatPrice(totalPendiente)}`,
      200, doc.lastAutoTable.finalY + 20, { align: 'right' });
    doc.save(`Cuenta_${clienteActual.name}_${clienteActual.id}.pdf`);
  };

  // Pagar pedidos seleccionados
  const pagarPedidosSeleccionados = async () => {
    if (!clienteActual || selectedPedidos.length === 0) {
      toast.error('Selecciona al menos un pedido para pagar.');
      return;
    }
    const db = getFirestore(app);
    const docRef = doc(db, 'CUENTAS', clienteActual.id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return;
    const cuenta = docSnap.data();
    let actualizado = false;
    Object.entries(cuenta).forEach(([fecha, pedidosMap]) => {
      Object.entries(pedidosMap).forEach(([idPedido, pedido]) => {
        if (selectedPedidos.includes(idPedido) && !pedido.pagado) {
          pedido.pagado = true;
          actualizado = true;
        }
      });
    });
    if (actualizado) {
      await updateDoc(docRef, cuenta);
      toast.success('Pedidos pagados correctamente.');
      cerrarCuentasModal();
    } else {
      toast.error('No se pudo pagar los pedidos seleccionados.');
    }
  };

  // Mostrar modal de recomendacion
  const handleRecomendacion = (cliente) => {
    setClienteRecomendado(cliente);
    setRecomendacionActual(recomendaciones[cliente.id]);
    setShowRecomendacionModal(true);
  };

  // Confirmar recomendacion: actualiza datos y borra la recomendacion
  // Confirmar recomendacion: actualiza datos y borra la recomendacion
const confirmarRecomendacion = async () => {
  if (!clienteRecomendado || !recomendacionActual || !clienteRecomendado.idDoc) return;
  setLoadingRecomendacion(true);
  const db = getFirestore(app);
  const nuevosDatos = {};
  if (typeof recomendacionActual.clientName === 'string') nuevosDatos.name = recomendacionActual.clientName;
  if (typeof recomendacionActual.clientPhone === 'string') nuevosDatos.phone = recomendacionActual.clientPhone;
  if (typeof recomendacionActual.clientBarrio === 'string') nuevosDatos.barrio = recomendacionActual.clientBarrio;
  if (typeof recomendacionActual.clientAddress === 'string') nuevosDatos.address = recomendacionActual.clientAddress;

  const ref = doc(db, 'CLIENTES', clienteRecomendado.idDoc);
  await updateDoc(ref, nuevosDatos);
  setClientes(prev => prev.map(c => c.idDoc === clienteRecomendado.idDoc ? { ...c, ...nuevosDatos } : c));
  await deleteDoc(doc(db, 'RECOMENDACIONES', recomendacionActual.id));

  setLoadingRecomendacion(false);
  toast.success('Datos del cliente actualizados correctamente');

  // ✅ Cerrar modal y limpiar estados
  setShowRecomendacionModal(false);
  setRecomendacionActual(null);
  setClienteRecomendado(null);
};


  // Borrar solo la recomendacion
  const borrarRecomendacion = async () => {
    if (!recomendacionActual) return;
    const db = getFirestore(app);
    await deleteDoc(doc(db, 'RECOMENDACIONES', recomendacionActual.id));
    setShowRecomendacionModal(false);
    setRecomendacionActual(null);
    setClienteRecomendado(null);
    // Volver a cargar recomendaciones
    const recCol = collection(db, 'RECOMENDACIONES');
    const recSnapshot = await getDocs(recCol);
    const recMap = {};
    recSnapshot.docs.forEach(docu => {
      recMap[docu.id] = { id: docu.id, ...docu.data() };
    });
    setRecomendaciones(recMap);
  };

  // Modal de confirmación interno (reemplazo de ConfirmationDelete)
  const ConfirmacionModal = ({ title, message, onConfirm, onCancel, loading, onCloseOverlay }) => {
  const handleOverlayClick = (e) => {
    e.stopPropagation(); // 👈 DETIENE el clic hacia padres
    if (e.target.classList.contains('confirmation-overlay')) {
      onCloseOverlay?.(); // Solo cierra sin borrar
    }
  };
    return (
      <div className="confirmation-overlay" style={{zIndex: 3000}} onClick={handleOverlayClick}>
      <div className="confirmation-modal" style={{zIndex: 3001}} onClick={e => e.stopPropagation()}>
        <h2 style={{ color: 'white' }}>{title}</h2>

        <p>{message}</p>
        <button className="confirmation-button" onClick={onCancel} disabled={loading}>No deseo actualizarlos</button>
        <button className="confirmation-button" onClick={onConfirm} disabled={loading}>Sí, actualizar datos</button>
      </div>
    </div>
    );
  };

  return (
    <div className="clientes-modal-overlay" onClick={closeModal}>
      <ToastContainer position="top-right" autoClose={2500} />
      <div className="clientes-modal" onClick={e => e.stopPropagation()}>
        <button className="close-clientes-modal" onClick={closeModal}>X</button>
        <h2>Clientes</h2>
        <input
          className="clientes-search"
          type="text"
          placeholder="Buscar por cualquier campo..."
          value={search}
          onChange={handleSearch}
        />
        {editando ? (
          <form onSubmit={handleUpdate} style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <input name="id" value={form.id} readOnly placeholder="ID" required className="clientes-input" />
              <input name="name" value={form.name} onChange={handleFormChange} placeholder="Nombre" required className="clientes-input" />
              <input name="phone" value={form.phone} onChange={handleFormChange} placeholder="Teléfono" required className="clientes-input" />
              <select name="barrio" value={form.barrio} onChange={handleFormChange} className="clientes-input" required>
                <option value="">Selecciona un barrio</option>
                {barrios.map(barrio => (
                  <option key={barrio} value={barrio}>{barrio}</option>
                ))}
              </select>
              <input name="address" value={form.address} onChange={handleFormChange} placeholder="Dirección" className="clientes-input" />
            </div>
            <div style={{ marginTop: 16 }}>
              <button type="submit" className="clientes-button" title="Guardar" style={{width:'auto', borderRadius: '6px', fontSize: '15px', padding: '10px 18px'}}>
                Guardar
              </button>
              <button type="button" className="clientes-button" title="Cancelar" style={{width:'auto', borderRadius: '6px', fontSize: '15px', padding: '10px 18px'}} onClick={() => setEditando(null)}>
                Cancelar
              </button>
            </div>
          </form>
        ) : null}
        <table className="clientes-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nombre</th>
              <th>Teléfono</th>
              <th>Barrio</th>
              <th>Dirección</th>
              <th style={{minWidth: 180}}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredClientes.map(cliente => (
              <tr key={cliente.idDoc}>
                <td>{cliente.id}</td>
                <td>{cliente.name}</td>
                <td>{cliente.phone}</td>
                <td>{cliente.barrio}</td>
                <td>{cliente.address}</td>
                <td style={{display: 'flex', flexWrap: 'wrap', gap: 6}}>
                  <button className="clientes-button" title="Editar" onClick={() => handleEdit(cliente)}><FaEdit /></button>
                  <button className="clientes-button" title="Borrar" style={{background: '#e74c3c', color: '#fff'}} onClick={() => handleDelete(cliente.idDoc)}><FaTrash /></button>
                  {clientesConCuenta[cliente.id] && (
                    <button className="clientes-button" title="Cuentas" style={{background: '#27ae60', color: '#fff'}} onClick={() => abrirCuentasModal(cliente)}>
                      <FaPrint />
                    </button>
                  )}
                  {recomendaciones[cliente.id] && (
                    <button className="clientes-button" title="Recomendación" style={{background: '#f1c40f', color: '#fff'}} onClick={() => handleRecomendacion(cliente)}>
                      <FaCheckCircle />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {showConfirm && (
          <div style={{marginTop: 16, textAlign: 'center'}}>
            <p>¿Estás seguro de que deseas eliminar este cliente?</p>
            <button className="clientes-button" style={{background: '#e74c3c', color: '#fff'}} onClick={confirmDelete}>Eliminar</button>
            <button className="clientes-button" onClick={cancelDelete}>Cancelar</button>
          </div>
        )}
      </div>
      {cuentasModalVisible && (
  <div className="clientes-modal-overlay" style={{zIndex: 2000}}>
    <div className="clientes-modal" style={{maxWidth: 600}} onClick={e => e.stopPropagation()}>
      <button className="close-clientes-modal" onClick={cerrarCuentasModal}>X</button>
      <h3>Pedidos pendientes de {clienteActual?.name}</h3>
      <table className="clientes-table">
        <thead>
          <tr>
            <th></th>
            <th>ID Pedido</th>
            <th>Pedido</th>
            <th>Hora</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {pedidosCliente.map(p => (
            <tr key={p.idPedido}>
              <td>
                <input type="checkbox" checked={selectedPedidos.includes(p.idPedido)} onChange={() => togglePedidoSeleccionado(p.idPedido)} />
              </td>
              <td>{p.idPedido}</td>
              <td>{p.pedido.cart.map(item => item.name).join(', ')}</td>
              <td>{p.pedido.timestamp && p.pedido.timestamp.seconds ? new Date(p.pedido.timestamp.seconds * 1000).toLocaleTimeString() : ''}</td>
              <td>{formatPrice(p.pedido.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{marginTop: 16, display: 'flex', gap: 12, justifyContent: 'center'}}>
        <button className="clientes-button clientes-button-square" style={{background: '#2980b9', color: '#fff'}} onClick={imprimirPedidosSeleccionados} title="Imprimir cuenta">
          <FaPrint />
        </button>
        <button className="clientes-button clientes-button-square" style={{background: '#27ae60', color: '#fff'}} onClick={pagarPedidosSeleccionados} title="Pagar">
          <FaCheck />
        </button>
      </div>
    </div>
  </div>
)}
      {showRecomendacionModal && recomendacionActual && (
  <>
    <ConfirmacionModal
      title="Recomendación de actualización"
      message={
        <span>
          ¿Deseas confirmar la recomendación para actualizar los datos del cliente <b>{clienteRecomendado?.name}</b>?<br />
          Si confirmas, los datos del cliente serán actualizados y la recomendación se eliminará.<br />
          Si no, solo se eliminará la recomendación.
        </span>
      }
      onConfirm={confirmarRecomendacion}
      onCancel={borrarRecomendacion}
      loading={loadingRecomendacion}
      onCloseOverlay={() => {
        // Solo cerrar sin eliminar
        setShowRecomendacionModal(false);
        setRecomendacionActual(null);
        setClienteRecomendado(null);
      }}
    />
    {loadingRecomendacion && (
      <div
        className="confirmation-overlay"
        style={{ zIndex: 3100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <Carga />
      </div>
    )}
  </>
)}

    </div>
  );
};

export default Clientes;
