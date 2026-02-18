import React from 'react';
import { X } from 'lucide-react';

import './AddTaskModal.css';

export default function AddTaskModal({ 
  onClose, 
  newTaskTitle, setNewTaskTitle, 
  newTaskTime, setNewTaskTime, 
  newTaskDuration, setNewTaskDuration, 
  onAdd 
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet" onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <h2>Nouvelle tâche</h2>
          <button className="close-icon" onClick={onClose}><X size={20}/></button>
        </div>
        <div className="modal-content">
          <input type="text" placeholder="Titre..." className="input-title" value={newTaskTitle} onChange={e=>setNewTaskTitle(e.target.value)} />
          <div className="row-inputs">
            <div className="input-wrap">
              <label>Heure</label>
              <input type="time" value={newTaskTime} onChange={e=>setNewTaskTime(e.target.value)} />
            </div>
            <div className="input-wrap">
              <label>Durée (min)</label>
              <input type="number" value={newTaskDuration} onChange={e=>setNewTaskDuration(e.target.value)} />
            </div>
          </div>
          <button className="btn-save" onClick={onAdd}>Ajouter</button>
        </div>
      </div>
    </div>
  );
}