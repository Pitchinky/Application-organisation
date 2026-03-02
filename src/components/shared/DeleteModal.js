import React from 'react';
import { Trash2, AlertTriangle } from 'lucide-react';
import './DeleteModal.css';

export default function DeleteModal({ isOpen, onClose, onConfirm, taskTitle }) {
  if (!isOpen) return null;

  return (
    <div className="delete-modal-overlay" onClick={onClose}>
      <div className="delete-modal-card" onClick={e => e.stopPropagation()}>
        <div className="delete-icon-circle">
          <Trash2 size={28} color="#FF3B30" />
        </div>
        
        <h3>Supprimer la tâche ?</h3>
        <p>Voulez-vous vraiment supprimer <strong>"{taskTitle}"</strong> ? Cette action est irréversible.</p>

        <div className="delete-modal-buttons">
          <button className="btn-confirm-delete" onClick={onConfirm}>
            Supprimer
          </button>
          <button className="btn-cancel-delete" onClick={onClose}>
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}