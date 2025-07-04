import React, { useState, useEffect } from 'react';
import { getFirestore, collection, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';
import './turno.css';
import { toast, ToastContainer } from 'react-toastify'; // Import ToastContainer
import jsPDF from 'jspdf'; // Assuming you have jspdf installed
import autoTable from 'jspdf-autotable'; // Ensure autoTable is imported correctly
import Carga from '../Loada/Carga'; // Importa el componente de carga

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
  const [selectedDate, setSelectedDate] = useState(() => {
    // Por defecto, hoy en formato yyyy-mm-dd
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

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

  const handleDateChange = (e) => {
    setSelectedDate(e.target.value);
    // Si ya hay un turno seleccionado, recargar datos para esa fecha y turno
    if (turnTime) {
      fetchTurnData(turnTime, e.target.value);
      fetchExpenses(turnTime, e.target.value);
    }
  };

  const fetchTurnData = async (turnTime, customDate) => {
    const db = getFirestore();
    // Usar la fecha seleccionada si se provee, si no usar la lógica anterior
    let date;
    if (customDate) {
      const [yyyy, mm, dd] = customDate.split('-');
      date = `${parseInt(dd)}-${parseInt(mm)}-${yyyy}`;
    } else {
      date = determineDateAndShift().date;
    }
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

  const fetchOrderData = async (turnTime, customDate) => {
    const db = getFirestore();
    let date;
    if (customDate) {
      const [yyyy, mm, dd] = customDate.split('-');
      date = `${parseInt(dd)}-${parseInt(mm)}-${yyyy}`;
    } else {
      date = determineDateAndShift().date;
    }
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
    if (turnType === 'FIN') {
      await fetchTurnData(selectedTurnTime, selectedDate);
      await fetchExpenses(selectedTurnTime, selectedDate);
      const { totalOrders, domicilioOrders, mesaOrders } = await fetchOrderData(selectedTurnTime, selectedDate);
      setBalances(prevBalances => prevBalances.map(balance => ({
        ...balance,
        totalOrders,
        domicilioOrders,
        mesaOrders
      })));
    } else {
      await fetchTurnData(selectedTurnTime);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!turnType || !turnTime) {
      alert('Todos los campos son obligatorios');
      return;
    }

    setIsProcessing(true);

    const db = getFirestore();
    // Usar la fecha seleccionada si es FIN, si no la lógica anterior
    let date;
    if (turnType === 'FIN' && selectedDate) {
      const [yyyy, mm, dd] = selectedDate.split('-');
      date = `${parseInt(dd)}-${parseInt(mm)}-${yyyy}`;
    } else {
      date = determineDateAndShift().date;
    }

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

    if (turnType === 'INICIO') {
      toast.success('Caja abierta con éxito', { autoClose: 1000 });
    } else if (turnType === 'FIN') {
      toast.success('Cierre de caja con éxito', { autoClose: 1000 });
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
  // Usar la fecha seleccionada para los datos y el nombre del archivo
  const orderData = await fetchOrderData(turnTime, selectedDate);
  const deletedOrders = await fetchDeletedOrders(turnTime, selectedDate); // <-- NUEVO
  const pageWidth = pdfDoc.internal.pageSize.getWidth();

  // Título principal
  pdfDoc.setFontSize(18);
  pdfDoc.text(
    `Informe de Cierre - ${
      selectedDate
        ? (() => {
            const [yyyy, mm, dd] = selectedDate.split('-');
            return `${dd}-${mm}-${yyyy}`;
          })()
        : new Date().toLocaleDateString('es-ES')
    }`,
    pageWidth / 2,
    20,
    { align: 'center' }
  );
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
    pageBreak: 'auto'
  });

  // NUEVO: Tabla de Pedidos Borrados
  let deletedY = pdfDoc.lastAutoTable.finalY + 10;
  pdfDoc.setFontSize(16);
  pdfDoc.text('Pedidos Borrados', 14, deletedY);
  autoTable(pdfDoc, {
    startY: deletedY + 5,
    head: [['ID', 'Hora', 'Motivo']],
    body: deletedOrders.length > 0 ? deletedOrders.map((del) => [
      del.id ? del.id.split('_')[0] : '',
      del.timestamp ? `${del.timestamp.getHours().toString().padStart(2, '0')}:${del.timestamp.getMinutes().toString().padStart(2, '0')}` : '',
      del.motivo
    ]) : [['', '', 'No hay pedidos borrados']],
    theme: 'striped',
    styles: { fontSize: 12, cellPadding: 3 },
    headStyles: { fillColor: [155, 89, 182], textColor: 255, fontStyle: 'bold' },
    pageBreak: 'auto'
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

  // Use generateSummaryReport for the written summary
  const { totalNequi: finalNequi, totalEfectivo: finalEfectivo } = calculateTotals();
  const initialNequi = formatPrice(nequiValueBase);
  const initialCash = formatPrice(cashValueBase);

  const deliveryDetails = selectedDeliveryPersons.map(person => {
    const name = capitalizeName(deliveryPersons.find(p => p.id === person.id)?.name || 'Desconocido');
    const nequi = formatPrice(person.nequi);
    const efectivo = formatPrice(person.efectivo);
    return efectivo !== '$0'
      ? `• ${name} entregó un total de ${nequi} en Nequi y ${efectivo} en efectivo.`
      : `• ${name} entregó un total de ${nequi} en Nequi.`;
  });

  const expenseDetails = expenses.length > 0
    ? expenses.map(expense => 
        `• ${capitalizeName(expense.concept)} por un monto de ${formatPrice(expense.amount)}.`)
    : ['En el turno no hubieron egresos'];

  pdfDoc.setFontSize(18);
  pdfDoc.text('Registro de Caja - Jornada del Día', pageWidth / 2, 20, { align: 'center' });

  pdfDoc.setFontSize(12);
  pdfDoc.text(
    `Hoy se abrió la caja con un balance inicial de ${initialCash} en efectivo y ${initialNequi} en Nequi.\n\n` +
    `Durante la jornada, se recibieron ingresos a través de los domiciliarios:\n\n` +
    `${deliveryDetails.join('\n')}\n\n` +
    `El total esperado en efectivo es de ${calculateTotals().totalEfectivo}\n` +
    `El efectivo contado es de ${formatPrice(cashValueEnd)}\n\n` +
    `El total esperado en Nequi es de ${calculateTotals().totalNequi}\n` +
    `El Nequi contado es de ${formatPrice(nequiValueEnd)}\n\n` +
    `En cuanto a egresos, se registraron los siguientes pagos:\n\n` +
    `${expenseDetails.join('\n')}\n\n` +
    `Al finalizar el turno, el total recibido en Nequi ascendió a ${formatPrice(nequiValueEnd)}, mientras que en efectivo se acumuló un total de ${formatPrice(cashValueEnd)}, sumando un ingreso total de ${formatPrice(parseFloat(nequiValueEnd.replace(/[$,]/g, '')) + parseFloat(cashValueEnd.replace(/[$,]/g, '')))}.`,
    14,
    30,
    { maxWidth: pageWidth - 28 }
  );

  // Guardar PDF con nombre personalizado usando la fecha seleccionada
  const pdfName = `CIERRE_INFORME_CAJA_${
    selectedDate
      ? (() => {
          const [yyyy, mm, dd] = selectedDate.split('-');
          return `${dd}-${mm}-${yyyy}`;
        })()
      : new Date().toLocaleDateString('es-ES').replace(/\//g, '-')
  }.pdf`;
  pdfDoc.save(pdfName);

  setIsProcessing(false);
};


const fetchExpenses = async (turnTime, customDate) => {
  const db = getFirestore();
  let date;
  if (customDate) {
    const [yyyy, mm, dd] = customDate.split('-');
    date = `${parseInt(dd)}-${parseInt(mm)}-${yyyy}`;
  } else {
    date = determineDateAndShift().date;
  }
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

// Función para obtener pedidos borrados del día
const fetchDeletedOrders = async (turnTime, customDate) => {
  const db = getFirestore();
  let date;
  if (customDate) {
    const [yyyy, mm, dd] = customDate.split('-');
    date = `${parseInt(dd)}-${parseInt(mm)}-${yyyy}`;
  } else {
    const now = new Date();
    date = `${now.getDate()}-${now.getMonth() + 1}-${now.getFullYear()}`;
  }
  const deletedDocRef = doc(db, 'BORRADOS', date);
  try {
    const deletedDocSnap = await getDoc(deletedDocRef);
    if (deletedDocSnap.exists()) {
      const data = deletedDocSnap.data();
      return Object.values(data).map(entry => ({
        motivo: entry.motivo,
        timestamp: entry.timestamp && entry.timestamp.toDate ? entry.timestamp.toDate() : new Date(entry.timestamp),
        id: entry.ID || '',
      }));
    }
    return [];
  } catch (e) {
    return [];
  }
};

useEffect(() => {
  if (modalVisible && turnTime && turnType === 'FIN') {
    fetchExpenses(turnTime, selectedDate);
    fetchTurnData(turnTime, selectedDate);
  }
}, [modalVisible, turnTime, turnType, selectedDate]);

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
    const name = capitalizeName(deliveryPersons.find(p => p.id === person.id)?.name || 'Desconocido');
    const nequi = formatPrice(person.nequi);
    const efectivo = formatPrice(person.efectivo);
    return efectivo !== '$0'
      ? `• ${name} entregó un total de ${nequi} en Nequi y ${efectivo} en efectivo.`
      : `• ${name} entregó un total de ${nequi} en Nequi.`;
  });

  const expenseDetails = expenses.map(expense => 
    `• ${capitalizeName(expense.concept)} por un monto de ${formatPrice(expense.amount)}.`
  );

  const report = `
Registro de Caja - Jornada del Día

Hoy se abrió la caja con un balance inicial de ${formatPrice(initialCash)} en efectivo y ${formatPrice(initialNequi)} en Nequi.

Durante la jornada, se recibieron ingresos a través de los domiciliarios:
${deliveryDetails.join('\n')}

El total esperado en efectivo es de ${formatPrice(totalEfectivo)}
El efectivo contado es de ${formatPrice(finalCash)}

El total esperado en Nequi es de ${formatPrice(totalNequi)}
El Nequi contado es de ${formatPrice(finalNequi)}

En cuanto a egresos, se registraron los siguientes pagos:
${expenseDetails.join('\n')}

Al finalizar el turno, el total recibido en Nequi ascendió a ${formatPrice(finalNequi)}, mientras que en efectivo se acumuló un total de ${formatPrice(finalCash)}, sumando un ingreso total de ${formatPrice(totalBusinessIncome)}.
`;

  const newWindow = window.open('', '_blank');
  newWindow.document.write(`<pre style="font-family: Arial, sans-serif; font-size: 16px;">${report}</pre>`);
  newWindow.document.close();
};

// NUEVO: Función para obtener todas las fechas del mes y año seleccionados
const getAllDatesOfMonth = (year, month) => {
  const dates = [];
  const daysInMonth = new Date(year, month, 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    dates.push(`${day}-${month}-${year}`);
  }
  return dates;
};

// NUEVO: Función para generar el reporte mensual
const generateMonthlyReport = async () => {
  if (!turnType || !turnTime || !selectedDate) {
    alert('Debe seleccionar el tipo de turno, el turno y la fecha para generar el reporte mensual');
    return;
  }
  setIsProcessing(true);

  // Obtener mes y año del calendario
  const [yyyy, mm] = selectedDate.split('-');
  const year = parseInt(yyyy);
  const month = parseInt(mm);

  const datesOfMonth = getAllDatesOfMonth(year, month);

  // Acumuladores
  let totalOrders = 0;
  let domicilioOrders = 0;
  let mesaOrders = 0;
  let llevarOrders = 0;
  let productCounts = {};
  let totalNequi = 0;
  let totalEfectivo = 0;
  let totalExpenses = 0;
  let expensesList = [];
  let deliverySummary = {}; // { personId: { name, nequi, efectivo } }

  const db = getFirestore();

  for (const date of datesOfMonth) {
    // Pedidos
    const pedidosDocRef = doc(db, 'PEDIDOS', date);
    const pedidosDocSnap = await getDoc(pedidosDocRef);
    if (pedidosDocSnap.exists()) {
      const pedidosData = pedidosDocSnap.data();
      if (pedidosData[turnTime]) {
        totalOrders += Object.keys(pedidosData[turnTime]).length;
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
            const productName = product.name.replace(/[^\w\s]/gi, '');
            if (productCounts[productId]) {
              productCounts[productId].count++;
            } else {
              productCounts[productId] = { name: productName, count: 1 };
            }
          });
        });
      }
    }

    // DOMICILIOS (balances)
    const domiciliosDocRef = doc(db, 'DOMICILIOS', date);
    const domiciliosDocSnap = await getDoc(domiciliosDocRef);
    if (domiciliosDocSnap.exists()) {
      const domiciliosData = domiciliosDocSnap.data();
      Object.keys(domiciliosData).forEach(personId => {
        if (domiciliosData[personId][turnTime] && domiciliosData[personId][turnTime].balance) {
          const nequi = parseFloat(domiciliosData[personId][turnTime].balance.NEQUI || 0);
          const efectivo = parseFloat(domiciliosData[personId][turnTime].balance.EFECTIVO || 0);
          totalNequi += nequi;
          totalEfectivo += efectivo;
          // Acumular por domiciliario/mesero
          if (!deliverySummary[personId]) {
            deliverySummary[personId] = {
              name: deliveryPersons.find(p => p.id === personId)?.name || 'Desconocido',
              nequi: 0,
              efectivo: 0
            };
          }
          deliverySummary[personId].nequi += nequi;
          deliverySummary[personId].efectivo += efectivo;
        }
      });
    }

    // EGRESOS
    const egresosDocRef = doc(db, 'EGRESOS', date);
    const egresosDocSnap = await getDoc(egresosDocRef);
    if (egresosDocSnap.exists()) {
      const data = egresosDocSnap.data();
      const turnExpenses = Object.entries(data[turnTime] || {}).map(([id, expense]) => ({
        id: `${date}-${id}`,
        ...expense,
      }));
      expensesList = expensesList.concat(turnExpenses);
      totalExpenses += turnExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0);
    }
  }

  // Generar PDF
  const pdfDoc = new jsPDF();
  const pageWidth = pdfDoc.internal.pageSize.getWidth();

  pdfDoc.setFontSize(18);
  pdfDoc.text(
    `Reporte Mensual - Turno ${turnTime === 'MORNING' ? 'Mañana' : 'Noche'}\n${mm.padStart(2, '0')}/${year}`,
    pageWidth / 2,
    20,
    { align: 'center' }
  );

  pdfDoc.setFontSize(14);
  pdfDoc.text(`Tipo de Turno: ${turnType}`, pageWidth / 2, 28, { align: 'center' });

  // Tabla de Pedidos
  pdfDoc.setFontSize(16);
  pdfDoc.text('Resumen de Pedidos', 14, 40);

  autoTable(pdfDoc, {
    startY: 45,
    head: [['Descripción', 'Cantidad']],
    body: [
      ['Pedidos a domicilio', domicilioOrders],
      ['Pedidos en mesa', mesaOrders],
      ['Pedidos para llevar', llevarOrders],
      ['Total de pedidos', totalOrders],
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
    body: Object.values(productCounts).map(({ name, count }) => [name, count]),
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
    body: expensesList.map((expense) => [expense.concept, formatPrice(expense.amount)]),
    theme: 'striped',
    styles: { fontSize: 12, cellPadding: 3 },
    headStyles: { fillColor: [231, 76, 60], textColor: 255, fontStyle: 'bold' },
    pageBreak: 'auto' // Permite salto de página automático si no caben los egresos
  });

  const balancesY = pdfDoc.lastAutoTable.finalY + 10;

  // Tabla de Totales
  pdfDoc.setFontSize(16);
  pdfDoc.text('Totales del Mes', 14, balancesY);

  autoTable(pdfDoc, {
    startY: balancesY + 5,
    head: [['Total Nequi', 'Total Efectivo', 'Total Egresos']],
    body: [[formatPrice(totalNequi), formatPrice(totalEfectivo), formatPrice(totalExpenses)]],
    theme: 'striped',
    styles: { fontSize: 12, cellPadding: 3 },
    headStyles: { fillColor: [52, 152, 219], textColor: 255, fontStyle: 'bold' },
  });

  // NUEVO: Página resumen mensual tipo texto
  pdfDoc.addPage();

  // Resumen de domiciliarios/meseros
  const deliveryDetails = Object.values(deliverySummary).map(person => {
    const name = capitalizeName(person.name);
    const nequi = formatPrice(person.nequi);
    const efectivo = formatPrice(person.efectivo);
    return efectivo !== '$0'
      ? `• ${name} entregó un total de ${nequi} en Nequi y ${efectivo} en efectivo.`
      : `• ${name} entregó un total de ${nequi} en Nequi.`;
  });

  const expenseDetails = expensesList.length > 0
    ? expensesList.map(expense =>
        `• ${capitalizeName(expense.concept)} por un monto de ${formatPrice(expense.amount)}.`)
    : ['En el mes no hubieron egresos'];

  pdfDoc.setFontSize(18);
  pdfDoc.text(
    `Resumen Mensual - Turno ${turnTime === 'MORNING' ? 'Mañana' : 'Noche'}\n${mm.padStart(2, '0')}/${year}`,
    pageWidth / 2,
    20,
    { align: 'center' }
  );

  pdfDoc.setFontSize(12);

  // --- NUEVO: Imprimir el resumen con salto de página si es necesario ---
  let y = 35;
  const lineHeight = 7;
  const margin = 14;
  const maxY = pdfDoc.internal.pageSize.getHeight() - margin;

  const addTextWithPageBreak = (lines) => {
    for (const line of lines) {
      if (y > maxY) {
        pdfDoc.addPage();
        y = margin;
      }
      pdfDoc.text(line, margin, y, { maxWidth: pageWidth - margin * 2 });
      y += lineHeight;
    }
    y += lineHeight; // Espacio extra entre secciones
  };

  addTextWithPageBreak([
    `Durante el mes, se recibieron ingresos a través de los domiciliarios/meseros:`,
    ''
  ]);
  addTextWithPageBreak(deliveryDetails);

  addTextWithPageBreak([
    '',
    `El total recibido en efectivo fue de ${formatPrice(totalEfectivo)}`,
    `El total recibido en Nequi fue de ${formatPrice(totalNequi)}`,
    '',
    `En cuanto a egresos, se registraron los siguientes pagos:`,
    ''
  ]);
  addTextWithPageBreak(expenseDetails);

  addTextWithPageBreak([
    '',
    `Al finalizar el mes, el total recibido en Nequi ascendió a ${formatPrice(totalNequi)}, mientras que en efectivo se acumuló un total de ${formatPrice(totalEfectivo)}, sumando un ingreso total de ${formatPrice(totalNequi + totalEfectivo)}.`
  ]);
  // --- FIN NUEVO ---

  // Guardar PDF
  const pdfName = `REPORTE_MENSUAL_${turnTime}_${mm.padStart(2, '0')}_${year}.pdf`;
  pdfDoc.save(pdfName);

  setIsProcessing(false);
};

  // Al inicio del return principal, muestra la pantalla de carga si isProcessing es true
  if (!modalVisible) return null;

  return (
    <>
      <ToastContainer autoClose={3000} />
      {/* Pantalla de carga superpuesta si isProcessing */}
      {isProcessing && (
        <div style={{
          position: 'fixed',
          zIndex: 9999,
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Carga />
        </div>
      )}
      {modalVisible && (
        <div className="turno-modal" onClick={closeModal}>
          <div className="turno-modal-content" onClick={(e) => e.stopPropagation()}>
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
                  {/* NUEVO: Selección de fecha */}
                  <label>
                    Selecciona fecha:
                    <input
                      type="date"
                      value={selectedDate}
                      max={new Date().toISOString().split('T')[0]}
                      onChange={handleDateChange}
                      required
                    />
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
                  {/* NUEVO: Botón de reporte mensual */}
                  <button
                    type="button"
                    style={{ marginBottom: '10px', color: 'black' }}
                    onClick={generateMonthlyReport}
                    disabled={isProcessing}
                    className={turnType !== 'FIN' ? 'hidden' : ''}
                  >
                    {isProcessing ? 'Procesando...' : 'Reporte Mensual'}
                  </button>
                  <button onClick={handleSubmit} disabled={isProcessing}>
                    {isProcessing ? 'Procesando...' : 'Guardar'}
                  </button>
                  <button onClick={generatePDF} disabled={isProcessing}>
                    {isProcessing ? 'Procesando...' : 'Imprimir informe Diario'}
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