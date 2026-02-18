import React from 'react';
import { format, parseISO } from 'date-fns';
import { Check, Briefcase } from 'lucide-react';
import { getEventStatus, THRESHOLD_SHORT_EVENT, formatDuration } from '../../utils/timelineLogic';
import './TimelineItem.css';

export default function TimelineItem({ item, now, completedEvents, toggleTaskCompletion }) {
  
  // Cas GAP (Trou)
  if (item.type === 'gap') {
    const showLabel = item.duration >= 15;
    const gapHeight = Math.max(item.height, 20);
    return (
      <div className="timeline-gap" style={{ height: `${gapHeight}px` }}>
        <div className="gap-line"></div>
        {showLabel && (
          <div className="gap-label"><span className="gap-dots">•••</span><span>{formatDuration(item.duration)} de libre</span></div>
        )}
      </div>
    );
  }

  // Cas EVENT
  const e = item.data;
  const start = parseISO(e.start.dateTime);
  const end = parseISO(e.end.dateTime);
  const color = e.color || '#34C759';
  const checked = completedEvents[e.id];
  const { status, progress } = getEventStatus(e, now);
  const isCur = status === 'current';
  
  const isShort = item.duration <= THRESHOLD_SHORT_EVENT;
  const visualHeight = isShort ? 50 : Math.max(item.height, 50);

  // Style de la pilule (Le dégradé)
  let pillStyle = {};
  if (status === 'past' || checked) {
    pillStyle = { backgroundColor: '#E5E5EA', boxShadow: 'none' };
  } else if (isCur && !isShort) {
    const fadeStart = Math.max(0, progress - 15);
    const fadeEnd = Math.min(100, progress + 5);
    pillStyle = { 
       background: `linear-gradient(to bottom, ${color} 0%, ${color} ${fadeStart}%, #FFFFFF ${fadeEnd}%)`,
       boxShadow: `0 4px 15px ${color}40`,
       border: `2px solid ${color}`
    };
  } else {
    pillStyle = { backgroundColor: color, boxShadow: `0 4px 10px ${color}40` };
  }

  return (
    <div className={`timeline-row ${checked || status === 'past' ? 'past' : ''} ${isCur ? 'current' : ''}`} 
         style={{ height: `${visualHeight}px`, minHeight: `${visualHeight}px` }}>
       
       <div className="time-column">
         <span className="time-start">{format(start, 'HH:mm')}</span>
         {!isShort && <span className="time-end">{format(end, 'HH:mm')}</span>}
       </div>
       
       <div className="visual-column">
         <div className="line full-height"></div>
         <div className={`shape ${isShort ? 'circle' : 'pill-strip'}`} style={pillStyle}>
            {checked ? <Check size={14} color="white"/> : <Briefcase size={16} color="white" strokeWidth={2.5} />}
         </div>
       </div>
       
       <div className="card-column">
         <div className="event-card-transparent" onClick={() => toggleTaskCompletion(e.id)}>
           <div className="card-text">
              {isCur && <span className="status-label">{Math.round(100 - progress)}% restant</span>}
              <h3 style={{ textDecoration: checked ? 'line-through' : 'none', color: checked ? '#8E8E93' : '#1C1C1E' }}>
                {e.summary}
              </h3>
              {e.location && !isShort && <p className="location">{e.location}</p>}
           </div>
           <div className={`check-circle-outline ${checked ? 'checked' : ''}`} style={{borderColor: checked ? color : '#E5E5EA'}}></div>
         </div>
       </div>
    </div>
  );
}