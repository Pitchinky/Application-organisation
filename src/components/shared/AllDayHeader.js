import React from 'react';
import { Icon } from '@iconify/react';
import { getCategoryData } from '../../utils/categoryLogic';
import './AllDayHeader.css';

export default function AllDayHeader({ events, completedEvents, onToggle }) {
  if (!events || events.length === 0) return null;

  return (
    <div className="all-day-section">
      <div className="all-day-grid">
        {events.map(e => {
          const { icon, color } = getCategoryData(e.summary);
          const isDone = completedEvents[e.id];

          return (
            <div 
              key={e.id} 
              className={`all-day-item ${isDone ? 'is-done' : ''}`}
              onClick={() => onToggle(e.id)}
            >
              {/* GROS CERCLE ICÔNE AVEC CHECK SUPERPOSÉ */}
              <div className="icon-wrapper">
                <div className="main-pill-icon" style={{ backgroundColor: isDone ? '#AEAEB2' : color }}>
                  <Icon icon={icon} color="white" width="24" />
                </div>
                
                {/* Petit badge de check superposé en bas à droite */}
                <div className={`mini-check-badge ${isDone ? 'active' : ''}`} style={{ backgroundColor: color }}>
                   {isDone && <Icon icon="ph:check-bold" color="white" width="10" />}
                </div>
              </div>

              {/* TEXTE EN DESSOUS */}
              <span className="pill-label">{e.summary}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}