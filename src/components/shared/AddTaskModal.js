import React from 'react';
import { X, Calendar, Clock, Timer } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getCategoryData } from '../../utils/categoryLogic';
import { Icon } from '@iconify/react';
import './AddTaskModal.css';

export default function AddTaskModal({ 
  onClose, 
  onAdd, 
  currentDate, setCurrentDate, // On utilise setCurrentDate ici
  newTaskTitle, setNewTaskTitle, 
  newTaskTime, setNewTaskTime, 
  newTaskDuration, setNewTaskDuration 
}) {
  
  const { icon, color } = getCategoryData(newTaskTitle);

  // Fonction pour gérer le changement de date proprement
  const handleDateChange = (e) => {
    const newDate = new Date(e.target.value);
    if (!isNaN(newDate.getTime())) {
      setCurrentDate(newDate);
    }
  };

  return (
    <div className="modal-backdrop-compact" onClick={onClose}>
      <div className="modal-card-mini" onClick={e => e.stopPropagation()}>
        
        <div className="mini-header" style={{ backgroundColor: color }}>
          <div className="floating-pill-icon">
            <Icon icon={icon} color="white" width="24" />
          </div>
          <button className="mini-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="mini-body">
          <div className="title-wrap">
             <input 
                type="text" 
                placeholder="Nouvelle tâche..." 
                className="mini-input-title"
                value={newTaskTitle}
                onChange={e => setNewTaskTitle(e.target.value)}
                autoFocus={false} 
              />
              <p className="mini-time-info">
                {newTaskTime} • {newTaskDuration} min
              </p>
          </div>

          <div className="mini-settings-grid">
            {/* DATE : Cliquable pour ouvrir le calendrier natif */}
            <div className="mini-setting-item">
              <Calendar size={14} color={color} />
              <span>{format(currentDate || new Date(), 'd MMM', { locale: fr })}</span>
              <input 
                type="date" 
                className="abs-input" 
                value={format(currentDate || new Date(), 'yyyy-MM-dd')}
                onChange={handleDateChange} 
              />
            </div>

            {/* HEURE */}
            <div className="mini-setting-item">
              <Clock size={14} color={color} />
              <span>{newTaskTime}</span>
              <input 
                type="time" 
                className="abs-input" 
                value={newTaskTime} 
                onChange={e => setNewTaskTime(e.target.value)} 
              />
            </div>

            {/* DURÉE : Lecture seule (On utilise le slider) */}
            <div className="mini-setting-item">
              <Timer size={14} color={color} />
              <span>{newTaskDuration}m</span>
            </div>
          </div>

          <div className="duration-slider-container">
            <input 
              type="range" 
              min="5" 
              max="120" 
              step="5" 
              value={newTaskDuration} 
              onChange={e => setNewTaskDuration(e.target.value)}
              style={{ accentColor: color }}
            />
            <div className="slider-labels">
                <span>5m</span>
                <span>1h</span>
                <span>2h</span>
            </div>
          </div>

          <button 
            className="mini-btn-save" 
            onClick={onAdd}
            disabled={!newTaskTitle}
            style={{ 
              backgroundColor: newTaskTitle ? color : '#F2F2F7', 
              color: newTaskTitle ? 'white' : '#C7C7CC'
            }}
          >
            Ajouter la tâche
          </button>
        </div>
      </div>
    </div>
  );
}