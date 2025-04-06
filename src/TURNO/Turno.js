import React, { useState, useEffect } from 'react';
import { getFirestore, collection, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';
import './turno.css';
import { toast, ToastContainer } from 'react-toastify'; // Import ToastContainer
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

    // Reset values to 0 by default
    setNequiValueBase(formatPrice(0));
    setCashValueBase(formatPrice(0));
    setNequiValueEnd(formatPrice(0));
    setCashValueEnd(formatPrice(0));
    setSelectedDeliveryPersons([]);

    if (baseDocSnap.exists()) {
      const baseData = baseDocSnap.data();
      if (baseData[turnTime]) {
        setNequiValueBase(formatPrice(baseData[turnTime].BASENEQUIINICIO || 0));
        setCashValueBase(formatPrice(baseData[turnTime].BASEEFECTIVOINICIO || 0));
        setNequiValueEnd(formatPrice(baseData[turnTime].BASENEQUIFIN || 0));
        setCashValueEnd(formatPrice(baseData[turnTime].BASEEFECTIVOFIN || 0));
      }
    }

    if (domiciliosDocSnap.exists()) {
      const domiciliosData = domiciliosDocSnap.data();
      const newBalances = [];

      Object.keys(domiciliosData).forEach(personId => {
        if (domiciliosData[personId][turnTime] && domiciliosData[personId][turnTime].balance) {
          newBalances.push({
            id: personId,
            name: deliveryPersons.find(p => p.id === personId)?.name || 'Desconocido',
            nequi: domiciliosData[personId][turnTime].balance.NEQUI || 0,
            efectivo: domiciliosData[personId][turnTime].balance.EFECTIVO || 0
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

    // Show appropriate toast message based on turn type
    if (turnType === 'INICIO') {
      toast.success('Caja abierta con éxito', { autoClose: 1000 }); // Set autoClose to 3 seconds
    } else if (turnType === 'FIN') {
      toast.success('Cierre de caja con éxito', { autoClose: 1000 }); // Set autoClose to 3 seconds
    }

    setTimeout(() => {
    }, 1000);
  };

  const calculateTotals = () => {
    const totalNequi = selectedDeliveryPersons.reduce((sum, person) => sum + parseFloat(person.nequi || 0), 0) 
      + parseFloat(nequiValueBase.replace(/[$,]/g, '') || 0)
      - expenses
          .filter(expense => expense.paymentMethod === 'NEQUI')
          .reduce((sum, expense) => sum + parseFloat(expense.amount || 0), 0);
  
    const totalEfectivo = selectedDeliveryPersons.reduce((sum, person) => sum + parseFloat(person.efectivo || 0), 0) 
      + parseFloat(cashValueBase.replace(/[$,]/g, '') || 0)
      - expenses
          .filter(expense => expense.paymentMethod === 'EFECTIVO')
          .reduce((sum, expense) => sum + parseFloat(expense.amount || 0), 0);
  
    return { totalNequi: formatPrice(totalNequi), totalEfectivo: formatPrice(totalEfectivo) };
  };

const capitalizeName = (name) => {
  return name
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
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
  pdfDoc.text('Egresos del Turno', 14, expensesY);

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
    const name = capitalizeName(deliveryPersons.find(p => p.id === person.id)?.name || 'Desconocido');
    const role = capitalizeName(deliveryPersons.find(p => p.id === person.id)?.role || 'Desconocido');
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

  // Nueva página para el informe resumen
  pdfDoc.addPage();

  const { totalNequi: finalNequi, totalEfectivo: finalEfectivo } = calculateTotals();
  const initialNequi = formatPrice(nequiValueBase);
  const initialCash = formatPrice(cashValueBase);

  const deliveryDetails = selectedDeliveryPersons.map(person => {
    const name = capitalizeName(deliveryPersons.find(p => p.id === person.id)?.name || 'Desconocido');
    const nequi = formatPrice(person.nequi);
    const efectivo = formatPrice(person.efectivo);
    return efectivo !== '$0'
      ? `${name} entregó un total de ${nequi} en Nequi y ${efectivo} en efectivo.`
      : `${name} entregó un total de ${nequi} en Nequi.`;
  });

  const expenseDetails = expenses.map(expense => 
    `${capitalizeName(expense.concept)} por un monto de ${formatPrice(expense.amount)}.`
  );

  pdfDoc.setFontSize(18);
  pdfDoc.text('Informe escrito', pageWidth / 2, 20, { align: 'center' });

  pdfDoc.setFontSize(12);
  pdfDoc.text(
    `Hoy se abrió la caja con un balance inicial de ${initialCash} en efectivo y ${initialNequi} en Nequi. Durante la jornada, se recibieron ingresos a través de los domiciliarios:\n\n` +
    `${deliveryDetails.join('\n')}\n\n` +
    `En cuanto a egresos, se registraron los siguientes pagos:\n\n` +
    `${expenseDetails.join('\n')}\n\n` +
    `Al finalizar el Turno, el total recibido en Nequi ascendió a ${finalNequi}, mientras que en efectivo se acumuló un total de ${finalEfectivo}, sumando un ingreso total de ${formatPrice(parseFloat(finalNequi.replace(/[$,]/g, '')) + parseFloat(finalEfectivo.replace(/[$,]/g, '')))}.`,
    14,
    30,
    { maxWidth: pageWidth - 28 }
  );

  // Guardar PDF con nombre personalizado
  const pdfName = `CIERRE_INFORME_CAJA_${new Date().toLocaleDateString('es-ES').replace(/\//g, '-')}.pdf`;
  pdfDoc.save(pdfName);

  setIsProcessing(false);
};


const fetchExpenses = async (turnTime) => {
  const db = getFirestore();
  const { date } = determineDateAndShift(); // Get current date
  const docRef = doc(db, 'EGRESOS', date);

  try {
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      const expensesList = Object.entries(data[turnTime] || {}).map(([id, expense]) => ({
        id,
        ...expense,
      }));
      setExpenses(expensesList);
    } else {
      setExpenses([]); // No expenses for the selected turn
    }
  } catch (error) {
    console.error('Error fetching expenses:', error);
  }
};

useEffect(() => {
  if (modalVisible && turnTime) {
    fetchExpenses(turnTime); // Fetch expenses for the selected turn when the modal is visible
  }
}, [modalVisible, turnTime]);

const generateSummaryReport = () => {
  if (!turnType || !turnTime) {
    alert('Debe seleccionar el tipo de turno y el turno para generar el informe');
    return;
  }

  const { totalNequi, totalEfectivo } = calculateTotals();
  const initialNequi = parseFloat(nequiValueBase.replace(/[$,]/g, '') || 0);
  const finalNequi = parseFloat(nequiValueEnd.replace(/[$,]/g, '') || 0);
  const initialCash = parseFloat(cashValueBase.replace(/[$,]/g, '') || 0);
  const finalCash = parseFloat(cashValueEnd.replace(/[$,]/g, '') || 0);

  const nequiDifference = finalNequi - initialNequi;
  const cashDifference = finalCash - initialCash;
  const totalBusinessIncome = nequiDifference + cashDifference;

  const deliveryDetails = selectedDeliveryPersons.map(person => {
    const name = deliveryPersons.find(p => p.id === person.id)?.name || 'Desconocido';
    const nequi = formatPrice(person.nequi);
    const efectivo = formatPrice(person.efectivo);
    return efectivo !== '$0'
      ? `**${name}** entregó un total de **${nequi}** en Nequi y **${efectivo}** en efectivo.`
      : `**${name}** entregó un total de **${nequi}** en Nequi.`;
  });

  const expenseDetails = expenses.map(expense => 
    `**${expense.concept}** por un monto de **${formatPrice(expense.amount)}**.`
  );

  const report = `
Hoy se abrió la caja con un balance inicial de **${formatPrice(initialCash)}** en efectivo y **${formatPrice(initialNequi)}** en Nequi. Durante la jornada, se recibieron ingresos a través de los domiciliarios:
${deliveryDetails.join('\n')}

En cuanto a egresos, se registraron los siguientes pagos:
${expenseDetails.join('\n')}

Al finalizar el Turno, el total recibido en Nequi ascendió a **${totalNequi}**, mientras que en efectivo se acumuló un total de **${totalEfectivo}**, sumando un ingreso total de **${formatPrice(parseFloat(totalNequi.replace(/[$,]/g, '')) + parseFloat(totalEfectivo.replace(/[$,]/g, '')))}**.

La diferencia entre la base inicial y final en Nequi fue de **${formatPrice(nequiDifference)}**, y en efectivo fue de **${formatPrice(cashDifference)}**. En total, el ingreso neto al negocio fue de **${formatPrice(totalBusinessIncome)}**.
`;

  const newWindow = window.open('', '_blank');
  newWindow.document.write(`<pre style="font-family: Arial, sans-serif; font-size: 16px;">${report}</pre>`);
  newWindow.document.close();
};

  if (!modalVisible) return null;

  return (
    <>
      <ToastContainer autoClose={3000} /> {/* Set autoClose to 3 seconds */}
      {modalVisible && (
        <div className="turno-modal" onClick={closeModal}> {/* Close modal on overlay click */}
          <div className="turno-modal-content" onClick={(e) => e.stopPropagation()}> {/* Prevent closing when clicking inside content */}
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
                        <td
                          title={" lo que hay en nequi al momento de cerrar Caja con su total y todo"} // Tooltip content
                        >
                          Base Nequi Final
                        </td>
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
                      <td
                          title={" lo que hay en Efectivo contandolo todo sin meter nada, debe ser igual a el base efectivo"} // Tooltip content
                        >
                          Base Efectivo Final
                        </td>
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
                  <h3>EGRESOS DEL TURNO</h3>
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
                            No hay egresos registrados para el Turno.
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
            {turnType === 'FIN' && balances.length > 0 && (
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
      )}
    </>
  );
};

export default Turno;