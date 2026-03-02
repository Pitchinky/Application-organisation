import React from 'react';
import './RecurringChoiceModal.css';

export default function RecurringChoiceModal({ isOpen, onClose, onSelect, actionType = 'edit' }) {
  if (!isOpen) return null;

  return (
    <div className="simple-popup-overlay">
      <div className="simple-popup-card">
        <h3>{actionType === 'edit' ? 'Modifier la série' : 'Supprimer la série'}</h3>
        <p>Voulez-vous appliquer ce changement à toute la série ou uniquement à ce jour ?</p>
        
        <div className="simple-popup-buttons">
          <button className="btn-choice" onClick={() => onSelect('this')}>
            Uniquement cet événement
          </button>
          <button className="btn-choice bold" onClick={() => onSelect('all')}>
            Toute la série
          </button>
          <button className="btn-cancel" onClick={onClose}>
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}