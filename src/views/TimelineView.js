import React from 'react';
import Header from '../components/shared/Header';
import TimelineItem from '../components/shared/TimelineItem';
import { processTimeline } from '../utils/timelineLogic';
import AllDayHeader from '../components/shared/AllDayHeader';

import './TimelineView.css';

export default function TimelineView({ 
  events, currentDate, setCurrentDate, todaySummary, calendars, 
  showCalMenu, setShowCalMenu, setShowAddModal, handleLogin, isSignedIn,
  now, completedEvents, toggleTaskCompletion, isLoading, forecast, onToggleSubtask, onDeleteEvent, onEditEvent, allDayEvents,
}) {
  
  const timelineData = processTimeline(events, currentDate);

  return (
    <>
      <div className="timeline-header-sticky">
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
      </div>

      <div className="timeline-area" onClick={() => setShowCalMenu(false)}>
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