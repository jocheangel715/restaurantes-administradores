import React, { useState, useEffect } from 'react';
import { getFirestore, collection, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';
import './turno.css';
import { toast } from 'react-toastify'; // Assuming you have react-toastify installed
import jsPDF from 'jspdf'; // Assuming you have jspdf installed
import autoTable from 'jspdf-autotable'; // Ensure autoTable is imported correctly

const Turno = ({ modalVisible, closeModal }) => {
  const [turnType, setTurnType] = useState('');
  const [nequiValue, setNequiValue] = useState('');
  const [nequiValueBase, setNequiValueBase] = useState('');
  const [cashValue, setCashValue] = useState('');
  const [cashValueBase, setCashValueBase] = useState('');
  const [nequiValueEnd, setNequiValueEnd] = useState('');
  const [cashValueEnd, setCashValueEnd] = useState('');
  const [deliveryPerson, setDeliveryPerson] = useState('');
  const [deliveryPersons, setDeliveryPersons] = useState([]);
  const [selectedDeliveryPersons, setSelectedDeliveryPersons] = useState([]);
  const [turnTime, setTurnTime] = useState('');
  const [balances, setBalances] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [expenses, setExpenses] = useState([]); // State to store expenses

  useEffect(() => {
    const fetchDeliveryPersons = async () => {
      const db = getFirestore();
      const querySnapshot = await getDocs(collection(db, 'EMPLEADOS'));
      const persons = querySnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(person => person.role === 'DOMICILIARIO' || person.role === 'MESERO'); // Include MESERO role
      setDeliveryPersons(persons);
    };

    fetchDeliveryPersons();
  }, []);

  const getAdjustedDate = () => {
    const now = new Date();
    const hours = now.getHours();
    if (hours === 0 || hours === 1 || hours === 2) {
      now.setDate(now.getDate() - 1);
    }
    return now.toLocaleDateString('es-ES').replace(/\//g, '-');
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

  const fetchTurnData = async (turnTime) => {
    const db = getFirestore();
    const { date } = determineDateAndShift();
    const domiciliosDocRef = doc(db, 'DOMICILIOS', date);
    const domiciliosDocSnap = await getDoc(domiciliosDocRef);
    const baseDocRef = doc(db, 'BASE', date);
    const baseDocSnap = await getDoc(baseDocRef);

    if (baseDocSnap.exists()) {
      const baseData = baseDocSnap.data();
      if (baseData[turnTime]) {
        setNequiValueBase(formatPrice(baseData[turnTime].BASENEQUIINICIO));
        setCashValueBase(formatPrice(baseData[turnTime].BASEEFECTIVOINICIO));
        if (baseData[turnTime].BASENEQUIFIN) {
          setNequiValueEnd(formatPrice(baseData[turnTime].BASENEQUIFIN));
        }
        if (baseData[turnTime].BASEEFECTIVOFIN) {
          setCashValueEnd(formatPrice(baseData[turnTime].BASEEFECTIVOFIN));
        }
      }
    }

    if (domiciliosDocSnap.exists()) {
      const domiciliosData = domiciliosDocSnap.data();
      const newBalances = [];

      Object.keys(domiciliosData).forEach(personId => {
        if (domiciliosData[personId][turnTime] && domiciliosData[personId][turnTime].balance) {
          newBalances.push({
            id: personId,
            name: deliveryPersons.find(p => p.id === personId).name,
            nequi: domiciliosData[personId][turnTime].balance.NEQUI,
            efectivo: domiciliosData[personId][turnTime].balance.EFECTIVO
          });
        }
      });

      setSelectedDeliveryPersons(newBalances);
    }
  };

  const fetchOrderData = async (turnTime) => {
    const db = getFirestore();
    const { date } = determineDateAndShift();
    const pedidosDocRef = doc(db, 'PEDIDOS', date);
    const pedidosDocSnap = await getDoc(pedidosDocRef);

    let totalOrders = 0;
    let domicilioOrders = 0;
    let mesaOrders = 0;
    let llevarOrders = 0; // New variable for takeout orders
    const productCounts = {};

    if (pedidosDocSnap.exists()) {
      const pedidosData = pedidosDocSnap.data();
      if (pedidosData[turnTime]) {
        totalOrders = Object.keys(pedidosData[turnTime]).length;
        Object.values(pedidosData[turnTime]).forEach(order => {
          if (order.tableNumber === 'LLEVAR') {
            llevarOrders++;
          } else if (order.tableNumber) {
            mesaOrders++;
          } else {
            domicilioOrders++;
          }
          order.cart.forEach(product => {
            const productId = product.id;
            const productName = product.name.replace(/[^\w\s]/gi, ''); // Remove emojis and non-alphanumeric characters
            if (productCounts[productId]) {
              productCounts[productId].count++;
            } else {
              productCounts[productId] = { name: productName, count: 1 };
            }
          });
        });
      }
    }

    return { totalOrders, domicilioOrders, mesaOrders, llevarOrders, productCounts };
  };

  const formatPrice = (value) => {
    if (value === null || value === undefined || value === '') return '0';
    
    const numberValue = parseFloat(value.toString().replace(/[$,]/g, ''));
    
    if (isNaN(numberValue)) return '0';

    return `$${numberValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  };

  const handleAddDeliveryPerson = () => {
    if (deliveryPerson) {
      setSelectedDeliveryPersons([...selectedDeliveryPersons, { id: deliveryPerson, nequi: nequiValue, efectivo: cashValue }]);
      setDeliveryPerson('');
      setNequiValue('');
      setCashValue('');
    }
  };

  const handleDeliveryPersonChange = (index, field, value) => {
    const updatedPersons = [...selectedDeliveryPersons];
    if (updatedPersons[index]) {
      updatedPersons[index][field] = value;
      setSelectedDeliveryPersons(updatedPersons);
    }
  };

  const handleTurnTimeChange = async (e) => {
    const selectedTurnTime = e.target.value;
    setTurnTime(selectedTurnTime);
    await fetchTurnData(selectedTurnTime);
    if (turnType === 'FIN') {
      const { totalOrders, domicilioOrders, mesaOrders } = await fetchOrderData(selectedTurnTime);
      setBalances(prevBalances => prevBalances.map(balance => ({
        ...balance,
        totalOrders,
        domicilioOrders,
        mesaOrders
      })));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!turnType || !turnTime) { // Removed nequiValueBase and cashValueBase from validation
      alert('Todos los campos son obligatorios');
      return;
    }

    setIsProcessing(true);

    const db = getFirestore();
    const { date } = determineDateAndShift();

    // Create or update BASE collection document
    const baseDocRef = doc(db, 'BASE', date);
    const baseData = {
      [turnTime]: {
        BASENEQUIINICIO: parseFloat(nequiValueBase.replace(/[$,]/g, '')) || 0,
        BASEEFECTIVOINICIO: parseFloat(cashValueBase.replace(/[$,]/g, '')) || 0,
        BASENEQUIFIN: parseFloat(nequiValueEnd.replace(/[$,]/g, '')) || 0,
        BASEEFECTIVOFIN: parseFloat(cashValueEnd.replace(/[$,]/g, '')) || 0
      }
    };
    await setDoc(baseDocRef, baseData, { merge: true });

    // Create or update DOMICILIOS collection document
    const domiciliosDocRef = doc(db, 'DOMICILIOS', date);
    const domiciliosDocSnap = await getDoc(domiciliosDocRef);

    let domiciliosData = domiciliosDocSnap.exists() ? domiciliosDocSnap.data() : {};

    const newBalances = [];

    selectedDeliveryPersons.forEach(person => {
      if (!domiciliosData[person.id]) {
        domiciliosData[person.id] = {};
      }
      if (!domiciliosData[person.id][turnTime]) {
        domiciliosData[person.id][turnTime] = {};
      }
      if (!domiciliosData[person.id][turnTime].balance) {
        domiciliosData[person.id][turnTime].balance = {};
      }
      domiciliosData[person.id][turnTime].balance.NEQUI = parseFloat(String(person.nequi).replace(/[$,]/g, '')) || 0;
      domiciliosData[person.id][turnTime].balance.EFECTIVO = parseFloat(String(person.efectivo).replace(/[$,]/g, '')) || 0;

      newBalances.push({
        id: person.id,
        name: deliveryPersons.find(p => p.id === person.id).name,
        nequi: domiciliosData[person.id][turnTime].balance.NEQUI,
        efectivo: domiciliosData[person.id][turnTime].balance.EFECTIVO
      });
    });

    await setDoc(domiciliosDocRef, domiciliosData, { merge: true });
    setBalances(newBalances);
    setIsProcessing(false);

    toast.success('Datos guardados correctamente');
    setTimeout(() => {
      closeModal();
    }, 1000);
  };

  const calculateTotals = () => {
    const totalNequi = selectedDeliveryPersons.reduce((sum, person) => sum + parseFloat(person.nequi || 0), 0) + parseFloat(nequiValueBase.replace(/[$,]/g, '') || 0);
    const totalEfectivo = selectedDeliveryPersons.reduce((sum, person) => sum + parseFloat(person.efectivo || 0), 0) + parseFloat(cashValueBase.replace(/[$,]/g, '') || 0);
    return { totalNequi: formatPrice(totalNequi), totalEfectivo: formatPrice(totalEfectivo) };
  };

const pdfContent = (pdfDoc, orderData) => { 
  const date = new Date().toLocaleDateString('es-ES').replace(/\//g, '-');
  pdfDoc.text(`Informe de cierre ${date}`, 14, 16);
  pdfDoc.text('Tabla de pedidos', 14, 24);

  autoTable(pdfDoc, {
    startY: 30,
    head: [['Descripción', 'Cantidad']],
    body: [
      ['Pedidos a domicilio', orderData.domicilioOrders],
      ['Pedidos en mesa', orderData.mesaOrders],
      ['Pedidos para llevar', orderData.llevarOrders], // Updated to include takeout orders
      ['Total de pedidos', orderData.totalOrders]
    ]
  });

  // Verificar si autoTable se ejecutó correctamente antes de acceder a 'previous'
  const previousY = pdfDoc.autoTable && pdfDoc.autoTable.previous 
    ? pdfDoc.autoTable.previous.finalY 
    : 50;

  // Agregar más espacio entre las tablas (por ejemplo, 20 unidades adicionales)
  const spacing = 30;  
  pdfDoc.text('Tabla de productos vendidos', 14, previousY + spacing);

  autoTable(pdfDoc, {
    startY: previousY + spacing + 10, // Más espacio antes de iniciar la tabla
    head: [['Producto', 'Cantidad']],
    body: Object.values(orderData.productCounts).map(({ name, count }) => [name, count])
  });
};

const generatePDF = async () => {
  if (!turnType || !turnTime) {
    alert('Debe seleccionar el tipo de turno y el turno para generar el PDF');
    return;
  }

  setIsProcessing(true);

  const pdfDoc = new jsPDF();
  const orderData = await fetchOrderData(turnTime);
  const pageWidth = pdfDoc.internal.pageSize.getWidth();

  // Título principal
  pdfDoc.setFontSize(18);
  pdfDoc.text(`Informe de Cierre - ${new Date().toLocaleDateString('es-ES')}`, pageWidth / 2, 20, { align: 'center' });
  pdfDoc.setFontSize(14);
  pdfDoc.text(`Turno: ${turnType} | Hora: ${turnTime}`, pageWidth / 2, 28, { align: 'center' });

  // Tabla de Pedidos
  pdfDoc.setFontSize(16);
  pdfDoc.text('Resumen de Pedidos', 14, 40);

  autoTable(pdfDoc, {
    startY: 45,
    head: [['Descripción', 'Cantidad']],
    body: [
      ['Pedidos a domicilio', orderData.domicilioOrders],
      ['Pedidos en mesa', orderData.mesaOrders],
      ['Pedidos para llevar', orderData.llevarOrders],
      ['Total de pedidos', orderData.totalOrders],
    ],
    theme: 'striped',
    styles: { fontSize: 12, cellPadding: 3 },
    headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
  });

  const previousY = pdfDoc.lastAutoTable.finalY + 10;

  // Tabla de Productos Vendidos
  pdfDoc.setFontSize(16);
  pdfDoc.text('Productos Vendidos', 14, previousY);

  autoTable(pdfDoc, {
    startY: previousY + 5,
    head: [['Producto', 'Cantidad']],
    body: Object.values(orderData.productCounts).map(({ name, count }) => [name, count]),
    theme: 'striped',
    styles: { fontSize: 12, cellPadding: 3 },
    headStyles: { fillColor: [46, 204, 113], textColor: 255, fontStyle: 'bold' },
  });

  const expensesY = pdfDoc.lastAutoTable.finalY + 10;

  // Tabla de Egresos
  pdfDoc.setFontSize(16);
  pdfDoc.text('Egresos del Día', 14, expensesY);

  autoTable(pdfDoc, {
    startY: expensesY + 5,
    head: [['Concepto', 'Monto']],
    body: expenses.map((expense) => [expense.concept, formatPrice(expense.amount)]),
    theme: 'striped',
    styles: { fontSize: 12, cellPadding: 3 },
    headStyles: { fillColor: [231, 76, 60], textColor: 255, fontStyle: 'bold' },
  });

  const balancesY = pdfDoc.lastAutoTable.finalY + 10;

  // Tabla de Balances de Domiciliarios y Meseros
  pdfDoc.setFontSize(16);
  pdfDoc.text('Balances de Domiciliarios y Meseros', 14, balancesY);

  const balanceRows = selectedDeliveryPersons.map((person) => {
    const name = deliveryPersons.find((p) => p.id === person.id)?.name || 'Desconocido';
    const role = deliveryPersons.find((p) => p.id === person.id)?.role || 'Desconocido';
    const efectivo = parseFloat(person.efectivo || 0);
    const nequi = parseFloat(person.nequi || 0);
    const total = efectivo + nequi;
    return [name, role, formatPrice(efectivo), formatPrice(nequi), formatPrice(total)];
  });

  const totalEfectivo = balanceRows.reduce((sum, row) => sum + parseFloat(row[2].replace(/[$,]/g, '')), 0);
  const totalNequi = balanceRows.reduce((sum, row) => sum + parseFloat(row[3].replace(/[$,]/g, '')), 0);
  const grandTotal = totalEfectivo + totalNequi;

  autoTable(pdfDoc, {
    startY: balancesY + 5,
    head: [['Nombre', 'Rol', 'Efectivo', 'Nequi', 'Total']],
    body: [
      ...balanceRows,
      ['TOTAL', '', formatPrice(totalEfectivo), formatPrice(totalNequi), formatPrice(grandTotal)]
    ],
    theme: 'striped',
    styles: { fontSize: 12, cellPadding: 3 },
    headStyles: { fillColor: [52, 152, 219], textColor: 255, fontStyle: 'bold' },
  });

  // Guardar PDF con nombre personalizado
  const pdfName = `CIERRE_INFORME_CAJA_${new Date().toLocaleDateString('es-ES').replace(/\//g, '-')}.pdf`;
  pdfDoc.save(pdfName);

  setIsProcessing(false);
};


const fetchExpenses = async () => {
  const db = getFirestore();
  const { date } = determineDateAndShift(); // Get current date
  const docRef = doc(db, 'EGRESOS', date);

  try {
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      const expensesList = Object.entries(data).flatMap(([period, entries]) =>
        Object.entries(entries).map(([id, expense]) => ({
          id,
          period,
          ...expense,
        }))
      );
      setExpenses(expensesList);
    } else {
      setExpenses([]); // No expenses for the day
    }
  } catch (error) {
    console.error('Error fetching expenses:', error);
  }
};

useEffect(() => {
  if (modalVisible) {
    fetchExpenses(); // Fetch expenses when the modal is visible
  }
}, [modalVisible]);

  if (!modalVisible) return null;

  return (
    <div className="turno-modal">
      <div className="turno-modal-content">
        <h2>Turno</h2>
        <p>Definir aspectos del turno aquí.</p>
        <form onSubmit={handleSubmit}>
          <label>
            Tipo de Turno:
            <select value={turnType} onChange={(e) => setTurnType(e.target.value)} required>
              <option value="">Seleccione</option>
              <option value="INICIO">Inicio del Turno</option>
              <option value="FIN">Fin del Turno</option>
            </select>
          </label>
          {turnType === 'INICIO' && (
            <>
              <label>
                Turno:
                <select value={turnTime} onChange={handleTurnTimeChange} required>
                  <option value="Seleccione">Seleccione Turno</option>
                  <option value="MORNING">Mañana</option>
                  <option value="NIGHT">Noche</option>
                </select>
              </label>
              <label>
                Valor Base Nequi:
                <input
                  type="text"
                  className="inputturno"
                  value={nequiValueBase}
                  onChange={(e) => setNequiValueBase(e.target.value)}
                  onBlur={(e) => setNequiValueBase(formatPrice(e.target.value))}
                />
              </label>
              <label>
                Valor Base Efectivo:
                <input
                  type="text"
                  className="inputturno"
                  value={cashValueBase}
                  onChange={(e) => setCashValueBase(e.target.value)}
                  onBlur={(e) => setCashValueBase(formatPrice(e.target.value))}
                />
              </label>
              {deliveryPersons.filter(person => !selectedDeliveryPersons.some(selected => selected.id === person.id)).length > 0 && (
                <>
                  <label>
                    Domiciliario/Mesero:
                    <select value={deliveryPerson} onChange={(e) => setDeliveryPerson(e.target.value)}>
                      <option value="">Seleccione</option>
                      {deliveryPersons
                        .filter(person => !selectedDeliveryPersons.some(selected => selected.id === person.id))
                        .map(person => (
                          <option key={person.id} value={person.id}>{person.name} ({person.role})</option> // Show role in dropdown
                        ))}
                    </select>
                  </label>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <input
                      type="text"
                      className="inputturno"
                      placeholder="NEQUI"
                      value={nequiValue}
                      onChange={(e) => setNequiValue(e.target.value)}
                      onBlur={(e) => setNequiValue(formatPrice(e.target.value))}
                    />
                    <input
                      type="text"
                      className="inputturno"
                      placeholder="EFECTIVO"
                      value={cashValue}
                      onChange={(e) => setCashValue(e.target.value)}
                      onBlur={(e) => setCashValue(formatPrice(e.target.value))}
                    />
                  </div>
                  <button type="button" onClick={handleAddDeliveryPerson}>Agregar</button>
                </>
              )}
              <label>
                Domiciliarios Agregados:
                <ul>
                  {selectedDeliveryPersons.map(person => (
                    <li key={person.id}>
                      {deliveryPersons.find(p => p.id === person.id).name}: Nequi - {person.nequi}, Efectivo - {person.efectivo}
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <input
                          type="text"
                          className="inputturno"
                          placeholder="NEQUI"
                          value={person.nequi}
                          onChange={(e) => handleDeliveryPersonChange(selectedDeliveryPersons.indexOf(person), 'nequi', e.target.value)}
                          onBlur={(e) => handleDeliveryPersonChange(selectedDeliveryPersons.indexOf(person), 'nequi', formatPrice(e.target.value))}
                        />
                        <input
                          type="text"
                          className="inputturno"
                          placeholder="EFECTIVO"
                          value={person.efectivo}
                          onChange={(e) => handleDeliveryPersonChange(selectedDeliveryPersons.indexOf(person), 'efectivo', e.target.value)}
                          onBlur={(e) => handleDeliveryPersonChange(selectedDeliveryPersons.indexOf(person), 'efectivo', formatPrice(e.target.value))}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </label>
              <button type="submit" disabled={isProcessing}>
                {isProcessing ? 'Procesando...' : 'Guardar'}
              </button>
            </>
          )}
          {turnType === 'FIN' && (
            <>
              <label>
                Turno:
                <select value={turnTime} onChange={handleTurnTimeChange} required>
                  <option value="Seleccione">Seleccione Turno</option>
                  <option value="MORNING">Mañana</option>
                  <option value="NIGHT">Noche</option>
                </select>
              </label>
              <table className="turno-table">
                <thead>
                  <tr>
                    <th>Descripción</th>
                    <th>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Base Nequi Inicial</td>
                    <td>{formatPrice(nequiValueBase)}</td>
                  </tr>
                  <tr>
                    <td>Base Efectivo Inicial</td>
                    <td>{formatPrice(cashValueBase)}</td>
                  </tr>
                  {selectedDeliveryPersons.map(person => (
                    <React.Fragment key={person.id}>
                      <tr>
                        <td>Balance NEQUI del {person.name.split(' ')[0]}</td>
                        <td>{formatPrice(person.nequi)}</td>
                      </tr>
                      <tr>
                        <td>Balance EFECTIVO del {person.name.split(' ')[0]}</td>
                        <td>{formatPrice(person.efectivo)}</td>
                      </tr>
                    </React.Fragment>
                  ))}
                  {balances.length > 0 && (
                    <>
                      <tr>
                        <td>Total de pedidos</td>
                        <td>{balances[0].totalOrders}</td>
                      </tr>
                      <tr>
                        <td>Pedidos a domicilio</td>
                        <td>{balances[0].domicilioOrders}</td>
                      </tr>
                      <tr>
                        <td>Pedidos en mesa</td>
                        <td>{balances[0].mesaOrders}</td>
                      </tr>
                    </>
                  )}
                  <tr>
                    <td>Total Nequi</td>
                    <td>{calculateTotals().totalNequi}</td>
                  </tr>
                  <tr>
                    <td>Total Efectivo</td>
                    <td>{calculateTotals().totalEfectivo}</td>
                  </tr>
                  <tr>
                    <td>Base Nequi Final</td>
                    <td>
                      <input
                        type="text"
                        className="inputturno"
                        value={nequiValueEnd}
                        onChange={(e) => setNequiValueEnd(e.target.value)}
                        onBlur={(e) => setNequiValueEnd(formatPrice(e.target.value))}
                        required
                      />
                    </td>
                  </tr>
                  <tr>
                    <td>Base Efectivo Final</td>
                    <td>
                      <input
                        type="text"
                        className="inputturno"
                        value={cashValueEnd}
                        onChange={(e) => setCashValueEnd(e.target.value)}
                        onBlur={(e) => setCashValueEnd(formatPrice(e.target.value))}
                        required
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
              <h3>EGRESOS DEL DÍA</h3>
              <table className="turno-table">
                <thead>
                  <tr>
                    <th>Concepto</th>
                    <th>Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((expense) => (
                    <tr key={expense.id}>
                      <td>{expense.concept}</td>
                      <td>{formatPrice(expense.amount)}</td>
                    </tr>
                  ))}
                  {expenses.length === 0 && (
                    <tr>
                      <td colSpan="2" style={{ textAlign: 'center' }}>
                        No hay egresos registrados para el día.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <button onClick={handleSubmit} disabled={isProcessing}>
                {isProcessing ? 'Procesando...' : 'Guardar'}
              </button>
              <button onClick={generatePDF} disabled={isProcessing}>
                {isProcessing ? 'Procesando...' : 'Imprimir'}
              </button>
            </>
          )}
        </form>
        <button onClick={closeModal} disabled={isProcessing}>Cerrar</button>
        {balances.length > 0 && (
          <div>
            <h3>Balances de Domiciliarios</h3>
            <ul>
              {balances.map(balance => (
                <li key={balance.id}>
                  {balance.name}: Nequi - {balance.nequi}, Efectivo - {balance.efectivo}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default Turno;