import React, { useState } from 'react';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import './ExpensesForm.css';

const formatPrice = (value) => {
    if (value === null || value === undefined || value === '') return '0';
    
    const numberValue = parseFloat(value.toString().replace(/[$,]/g, ''));
    
    if (isNaN(numberValue)) return '0';

    return `$${numberValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
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

const ExpensesForm = ({ modalVisible, closeModal }) => {
  const [expense, setExpense] = useState({ concept: '', amount: '' });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setExpense({ ...expense, [name]: name === 'amount' ? formatPrice(value) : value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const db = getFirestore();
    const { date, period } = determineDateAndShift(); // Get current date and shift
    const docRef = doc(db, 'EGRESOS', date); // Document ID is the date

    try {
      const docSnap = await getDoc(docRef);
      const existingData = docSnap.exists() ? docSnap.data() : {};

      // Merge new expense into the period map
      const updatedPeriodData = {
        ...(existingData[period] || {}),
        [new Date().getTime()]: {
          concept: expense.concept,
          amount: parseFloat(expense.amount.replace(/[$,]/g, '')) || 0,
          timestamp: new Date(),
        },
      };

      // Update the document
      await setDoc(docRef, { [period]: updatedPeriodData }, { merge: true });

      closeModal();
    } catch (error) {
      console.error('Error al guardar el egreso:', error);
    }
  };

  if (!modalVisible) return null;

  return (
    <div className="expenses-modal">
      <div className="expenses-modal-content">
        <h2>Registrar Egreso</h2>
        <form onSubmit={handleSubmit}>
          <label>
            Concepto:
            <input
              type="text"
              name="concept"
              value={expense.concept}
              onChange={handleInputChange}
              required
            />
          </label>
          <label>
            Monto:
            <input
              type="text"
              name="amount"
              value={expense.amount}
              onChange={handleInputChange}
              required
            />
          </label>
          <button type="submit">Guardar</button>
          <button type="button" onClick={closeModal}>Cerrar</button>
        </form>
      </div>
    </div>
  );
};

export default ExpensesForm;
