import React from 'react';
import { format, parseISO } from 'date-fns';
import { Icon } from '@iconify/react';
import { getCategoryData } from '../../utils/categoryLogic';
import { getEventStatus, THRESHOLD_SHORT_EVENT, formatDuration } from '../../utils/timelineLogic';
import './TimelineItem.css';

export default function TimelineItem({ item, now, completedEvents, toggleTaskCompletion }) {
  
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
  const visualHeight = isShort ? 50 : Math.max(item.height, 50);

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
       border: `1px solid ${catColor}40`
    };
    iconColor = progress > 50 ? catColor : "white";
  } else {
    pillStyle = { backgroundColor: '#F2F2F7', border: '1px solid #E5E5EA' };
    iconColor = catColor;
  }

  return (
    <div className={`timeline-row ${isPast ? 'past' : ''} ${isCur ? 'current' : ''}`} 
         style={{ height: `${visualHeight}px`, minHeight: `${visualHeight}px` }}>
       
       <div className="time-column">
         <span className="time-start">{format(start, 'HH:mm')}</span>
         {!isShort && <span className="time-end">{format(end, 'HH:mm')}</span>}
       </div>
       
       <div className="visual-column">
         <div className="line full-height"></div>
         {/* L'icône est maintenant centrée dans la pill-strip */}
         <div 
            className={`shape ${isShort ? 'circle' : 'pill-strip'}`} 
            style={pillStyle}
            onClick={() => toggleTaskCompletion(e.id)}
         >
            <div className="icon-centered">
               {checked ? (
                 <Icon icon="ph:check-bold" color="white" width="14" />
               ) : (
                 <Icon icon={icon} color={iconColor} width={isShort ? "18" : "22"} />
               )}
            </div>
         </div>
       </div>
       
       <div className="card-column" onClick={() => toggleTaskCompletion(e.id)}>
         <div className="event-card-transparent">
           <div className="card-text">
              <h3 style={{ 
                textDecoration: checked ? 'line-through' : 'none', 
                color: checked ? '#8E8E93' : '#1C1C1E' 
              }}>
                {e.summary}
              </h3>
              {e.location && !isShort && <p className="location">{e.location}</p>}
           </div>
           
           {/* CERCLE DE VALIDATION PLUS VISIBLE */}
           <div className={`check-circle-large ${checked ? 'checked' : ''}`} 
                style={{ borderColor: checked ? catColor : '#D1D1D6' }}>
             {checked && <Icon icon="ph:check-bold" color="white" width="14" />}
           </div>
         </div>
       </div>
    </div>
  );
}