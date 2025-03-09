import React from 'react';
import './ConfirmationDelete.css';

const ConfirmationDelete = ({ title, message, onConfirm, onCancel }) => {
  return (
    <>
      <div className="confirmation-overlay"></div>
      <div className="confirmation-modal">
        <h2>{title}</h2>
        <p>{message}</p>
        <button className="confirmation-button" onClick={onCancel}>No deseo borrarlo</button>
        <button className="confirmation-button" onClick={onConfirm}>Sí, deseo borrarlo</button>
      </div>
    </>
  );
};

export default ConfirmationDelete;
