import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, Plus, Sun } from 'lucide-react';
import { format, addMinutes, isValid, parse } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getCategoryData } from '../../utils/categoryLogic';
import { Icon } from '@iconify/react';
import './AddTaskModal.css';

export default function AddTaskModal({ 
  onClose, onAdd, currentDate, setCurrentDate,
  newTaskTitle, setNewTaskTitle, 
  newTaskTime, setNewTaskTime, 
  newTaskDuration, setNewTaskDuration 
}) {
  
  const [localDate, setLocalDate] = useState(currentDate || new Date());
  const [isAllDay, setIsAllDay] = useState(false);
  const [subtasks, setSubtasks] = useState([]);
  const [tempSubtask, setTempSubtask] = useState('');

  useEffect(() => {
    if (currentDate) setLocalDate(currentDate);
  }, [currentDate]);

  const { icon, color } = getCategoryData(newTaskTitle);

  const duration = parseInt(newTaskDuration) || 0;
  const h = Math.floor(duration / 60);
  const m = duration % 60;

  const quickPresets = [
    { label: '15m', val: 15 }, { label: '30m', val: 30 },
    { label: '1h', val: 60 }, { label: '2h', val: 120 }
  ];

  const getEndTime = () => {
    if (!newTaskTime || isAllDay) return '--:--';
    try {
      const dateRef = parse(newTaskTime, 'HH:mm', new Date());
      return format(addMinutes(dateRef, duration), 'HH:mm');
    } catch (e) { return '--:--'; }
  };

  const handleDateChange = (e) => {
    const selected = new Date(e.target.value);
    if (isValid(selected)) {
      setLocalDate(selected);
      setCurrentDate(selected);
    }
  };

  return (
    <div className="modal-backdrop-compact" onClick={onClose}>
      <div className="modal-card-mini" onClick={e => e.stopPropagation()}>
        
        <div className="mini-header" style={{ backgroundColor: color }}>
          <div className="header-date-center">
            {isValid(localDate) ? format(localDate, 'eeee d MMMM yyyy', { locale: fr }) : ''}
          </div>

          <div className="floating-pill-icon">
            <Icon icon={icon} color="white" width="22" />
          </div>
          <button className="mini-close" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="mini-body">
          <input type="text" placeholder="Nouvelle tâche..." className="mini-input-title"
                value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} />
          
          <div className="time-preview-badge" style={{color: color, backgroundColor: `${color}15`}}>
            {isAllDay ? "Toute la journée" : `${newTaskTime} — ${getEndTime()} (${h > 0 ? `${h}h` : ''}${m > 0 ? `${m}m` : ''})`}
          </div>

          <div className="mini-settings-grid-advanced">
            <div className="mini-setting-item">
              <Calendar size={12} color={color} />
              <span>{isValid(localDate) ? format(localDate, 'd MMM', { locale: fr }) : 'Date'}</span>
              <input type="date" className="abs-input" 
                value={isValid(localDate) ? format(localDate, 'yyyy-MM-dd') : ''}
                onChange={handleDateChange} 
              />
            </div>

            <div className={`mini-setting-item ${isAllDay ? 'disabled-opt' : ''}`}>
              <Clock size={12} color={color} />
              <span>{newTaskTime}</span>
              <input type="time" className="abs-input" value={newTaskTime} onChange={e => setNewTaskTime(e.target.value)} />
            </div>

            <div className={`mini-setting-item ${isAllDay ? 'active-all-day' : ''}`} onClick={() => setIsAllDay(!isAllDay)}>
              <Sun size={12} color={isAllDay ? 'white' : color} />
              <span>Journée</span>
            </div>
          </div>

          {!isAllDay && (
            <div className="duration-hybrid-selector">
              <div className="duration-quick-grid">
                {quickPresets.map(p => (
                  <button key={p.val} className={`preset-btn ${duration === p.val ? 'active' : ''}`}
                    style={{ '--active-bg': color }} onClick={() => setNewTaskDuration(p.val)}>
                    {p.label}
                  </button>
                ))}
              </div>
              
              {/* RETOUR AU DESIGN WHEEL PICKER D'AVANT */}
              <div className="duration-wheel-box">
                <div className="wheel-col">
                  <select value={h} onChange={(e) => setNewTaskDuration(parseInt(e.target.value) * 60 + m)}>
                    {[...Array(24).keys()].map(v => <option key={v} value={v}>{v} h</option>)}
                  </select>
                </div>
                <div className="wheel-sep">:</div>
                <div className="wheel-col">
                  <select value={m} onChange={(e) => setNewTaskDuration(h * 60 + parseInt(e.target.value))}>
                    {[...Array(60).keys()].map(v => <option key={v} value={v}>{v} min</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          <div className="subtasks-mini-section">
            <div className="sub-input-wrap">
              <input type="text" placeholder="Ajouter une étape..." value={tempSubtask}
                onChange={e => setTempSubtask(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (tempSubtask.trim() && setSubtasks([...subtasks, {id: Date.now(), text: tempSubtask}]) || setTempSubtask(''))} />
              <Plus size={16} color={color} onClick={() => {if(tempSubtask.trim()){setSubtasks([...subtasks, {id: Date.now(), text: tempSubtask}]); setTempSubtask('');}}} style={{cursor:'pointer'}} />
            </div>
          </div>

          <button className="mini-btn-save" 
            onClick={() => onAdd({title: newTaskTitle, allDay: isAllDay, subtasks, date: localDate})}
            disabled={!newTaskTitle} 
            style={{ backgroundColor: newTaskTitle ? color : '#F2F2F7', color: newTaskTitle ? 'white' : '#C7C7CC' }}>
            Ajouter la tâche
          </button>
        </div>
      </div>
    </div>
  );
}