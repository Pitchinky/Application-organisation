import React, { useEffect, useRef } from 'react';
import Header from '../components/shared/Header';
import TimelineItem from '../components/shared/TimelineItem';
import { processTimeline } from '../utils/timelineLogic';
import AllDayHeader from '../components/shared/AllDayHeader';
import { isWithinInterval, parseISO, isSameDay } from 'date-fns';

import './TimelineView.css';

export default function TimelineView({ 
  events, currentDate, setCurrentDate, todaySummary, calendars, 
  showCalMenu, setShowCalMenu, setShowAddModal, handleLogin, isSignedIn,
  now, completedEvents, toggleTaskCompletion, isLoading, forecast, onToggleSubtask, onDeleteEvent, onEditEvent, allDayEvents,
}) {
  
  // Référence vers la zone de scroll
  const scrollContainerRef = useRef(null);

  // Génère les données de la timeline
  const timelineData = processTimeline(events, currentDate);
  const isToday = isSameDay(currentDate, new Date());

  // --- LOGIQUE AUTO-SCROLL ---
  useEffect(() => {
    // On ne scrolle que si on est sur "Aujourd'hui" et que le chargement est fini
    if (isSignedIn && isToday && !isLoading && timelineData.length > 0) {
      
      // On attend un tout petit peu que le DOM soit bien rendu
      const timer = setTimeout(() => {
        // On cherche l'élément qui contient la ligne rouge
        const activeElement = document.querySelector('.now-indicator-row');
        
        if (activeElement) {
          activeElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center', // Place la ligne pile au milieu de l'écran
          });
        }
      }, 500); // 500ms de délai pour la fluidité

      return () => clearTimeout(timer);
    }
  }, [isLoading, currentDate, isSignedIn, isToday]);

  return (
    <>
      <Header 
        forecast={forecast}
        currentDate={currentDate} 
        setCurrentDate={setCurrentDate}
        todaySummary={todaySummary} 
        calendars={calendars}
        showCalMenu={showCalMenu} 
        setShowCalMenu={setShowCalMenu}
        setShowAddModal={setShowAddModal} 
        isSignedIn={isSignedIn}
        handleLogin={handleLogin}
      />

      <AllDayHeader 
        events={allDayEvents} 
        completedEvents={completedEvents} 
        onToggle={toggleTaskCompletion} 
      />

      {/* On ajoute la ref ici sur la zone qui scrolle */}
      <div 
        className="timeline-area" 
        ref={scrollContainerRef}
        onClick={() => setShowCalMenu(false)}
      >
         {isSignedIn ? (
           <div className="timeline-content">
             {isLoading && <div className="loader"><div className="spinner"></div></div>}
             
             {!isLoading && timelineData.length > 0 ? timelineData.map((item, i) => (
              <TimelineItem 
                key={item.id || i} 
                item={item}
                now={now} 
                completedEvents={completedEvents} 
                onToggleSubtask={onToggleSubtask}
                toggleTaskCompletion={toggleTaskCompletion} 
                onDeleteEvent={onDeleteEvent}
                onEditEvent={onEditEvent}
              />
            )) : (!isLoading && <div className="empty-state"><p>Rien de prévu ✨</p></div>)}
             
             <div className="spacer-bottom"></div>
           </div>
         ) : (
           <div className="login-screen">
             <h1>Bienvenue</h1>
             <p>Connectez votre calendrier pour commencer.</p>
             <button onClick={handleLogin} className="login-btn-large">
               Connexion Google
             </button>
           </div>
         )}
      </div>
    </>
  );
}