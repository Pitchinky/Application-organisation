import React, { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { Icon } from '@iconify/react';
import { getCategoryData } from '../../utils/categoryLogic';
import { getEventStatus, THRESHOLD_SHORT_EVENT, formatDuration } from '../../utils/timelineLogic';
import './TimelineItem.css';
import { MoreHorizontal, Trash2, Edit2 } from 'lucide-react';

export default function TimelineItem({ item, now, completedEvents, toggleTaskCompletion, onToggleSubtask, onDeleteEvent, onEditEvent }) {

  const [showMenu, setShowMenu] = useState(false);
  
  if (item.type === 'gap') {
    const showLabel = item.duration >= 15;
    const gapHeight = Math.max(item.height, 20);
    return (
      <div className="timeline-gap" style={{ height: `${gapHeight}px` }}>
        <div className="gap-line"></div>
        {showLabel && (
          <div className="gap-label">
            <span className="gap-dots">•••</span>
            <span>{formatDuration(item.duration)} de libre</span>
          </div>
        )}
      </div>
    );
  }

  
  const e = item.data;
  if (!e || !e.summary) return null;

  const { icon, color: catColor } = getCategoryData(e.summary);
  const start = parseISO(e.start.dateTime);
  const end = parseISO(e.end.dateTime);
  const checked = completedEvents[e.id];
  const { status, progress } = getEventStatus(e, now);
  
  const isCur = status === 'current';
  const isPast = status === 'past' || checked;
  const isShort = item.duration <= THRESHOLD_SHORT_EVENT;
  
  // Ajustement de la hauteur visuelle si présence de sous-tâches
  const hasSubtasks = e.subtasks && e.subtasks.length > 0;
  const visualHeight = isShort ? 50 : Math.max(item.height, hasSubtasks ? 80 : 50);

  // --- LOGIQUE DE STYLE ---
  let pillStyle = {};
  let iconColor = "white";

  if (isPast) {
    pillStyle = { backgroundColor: catColor };
    iconColor = "white";
  } else if (isCur && !isShort) {
    const fadeStart = Math.max(0, progress - 10);
    const fadeEnd = Math.min(100, progress + 10);
    pillStyle = { 
       background: `linear-gradient(to bottom, ${catColor} 0%, ${catColor} ${fadeStart}%, #F2F2F7 ${fadeEnd}%)`,
       border: `1px solid ${catColor}40`,
       boxShadow: `0 4px 12px ${catColor}30`
    };
    iconColor = "white"; 
  } else {
    pillStyle = { backgroundColor: '#F2F2F7', border: '1px solid #E5E5EA' };
    iconColor = catColor;
  }

  const toggleMenu = (event) => {
    event.stopPropagation();
    setShowMenu(!showMenu);
  };

  

  return (
    <div className={`timeline-row ${isPast ? 'past' : ''} ${isCur ? 'current' : ''}`} 
         style={{ minHeight: `${visualHeight}px`, height: 'auto', paddingBottom: hasSubtasks ? '15px' : '0', zIndex: showMenu ? 100 : 1 }}
         >
       
       <div className="time-column">
         <span className="time-start">{format(start, 'HH:mm')}</span>
         {!isShort && <span className="time-end">{format(end, 'HH:mm')}</span>}
       </div>
       
       <div className="visual-column">
         <div className="line full-height"></div>
         <div 
            className={`shape ${isShort ? 'circle' : 'pill-strip'}`} 
            style={pillStyle}
            onClick={() => toggleTaskCompletion(e.id)}
         >
            <div className="icon-centered">
               <Icon icon={icon} color={iconColor} width={isShort ? "18" : "22"} />
            </div>
         </div>
       </div>
       
        <div className="card-column">
         <div className="event-card-transparent">

          <div className="card-text" onClick={() => toggleTaskCompletion(e.id)}>
            {isCur && !checked && (
              <span className="status-label" style={{color: catColor}}>{Math.round(100 - progress)}% restant</span>
            )}
            <h3 style={{ textDecoration: checked ? 'line-through' : 'none' }}>
        {e.summary}
      </h3>
            {e.location && !isShort && <p className="location">{e.location}</p>}

            {hasSubtasks && !isShort && (
              <div className="task-subtasks-list">
                {e.subtasks.map((sub, idx) => (
                    <div 
                      key={sub.id || idx} 
                      className="subtask-item"
                      onClick={(event) => {
                        event.stopPropagation(); // Empêche de cocher la tâche parente
                        onToggleSubtask(e.id, e.subtasks, sub.id);
                      }}
                    >
                      <div 
                        className={`subtask-dot ${sub.completed ? 'done' : ''}`} 
                        style={{ borderColor: sub.completed ? catColor : '#C7C7CC', backgroundColor: sub.completed ? catColor : 'transparent' }}
                      />
                      <span className={sub.completed ? 'sub-done' : ''}>
                        {sub.text}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </div>
             
            
          <div className="card-actions-right">
            <div className="options-container">
              <button className="options-trigger" onClick={toggleMenu}>
                <MoreHorizontal size={20} color="#8E8E93" />
              </button>

              {showMenu && (
                <>
                  {/* Ce calque invisible ferme le menu au clic n'importe où ailleurs */}
                  <div className="menu-backdrop" onClick={() => setShowMenu(false)} />
                  
                  <div className="options-menu">
                    <button className="menu-item" onClick={(ev) => { ev.stopPropagation(); onEditEvent(e); setShowMenu(false); }}>
                      <Edit2 size={14} /> <span>Modifier</span>
                    </button>
                    <button className="menu-item delete" onClick={(ev) => { ev.stopPropagation(); onDeleteEvent(e.id); setShowMenu(false); }}>
                      <Trash2 size={14} /> <span>Supprimer</span>
                    </button>
                  </div>
                </>
              )}
            </div>

            <div 
              className={`check-circle-large ${checked ? 'checked' : ''}`} 
              onClick={() => toggleTaskCompletion(e.id)}
              style={{ 
                backgroundColor: checked ? catColor : 'transparent',
                borderColor: checked ? catColor : '#D1D1D6' 
              }}>
              {checked && <Icon icon="ph:check-bold" color="white" width="14" />}
            </div>
          </div>
              
              

  
           
           
           
         </div>
        </div>

    </div>
  );
}