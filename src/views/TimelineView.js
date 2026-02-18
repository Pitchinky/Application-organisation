import React from 'react';
import Header from '../components/shared/Header';
import TimelineItem from '../components/shared/TimelineItem';
import { processTimeline } from '../utils/timelineLogic';

import './TimelineView.css';

export default function TimelineView({ 
  events, currentDate, setCurrentDate, todaySummary, calendars, 
  showCalMenu, setShowCalMenu, setShowAddModal, handleLogin, isSignedIn,
  now, completedEvents, toggleTaskCompletion, isLoading, forecast
}) {
  
  // Génère les données de la timeline (incluant les Gaps/Temps libres)
  const timelineData = processTimeline(events, currentDate);

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

      <div className="timeline-area" onClick={() => setShowCalMenu(false)}>
         {isSignedIn ? (
           <div className="timeline-content">
             {/* Loader pendant la récupération des données */}
             {isLoading && <div className="loader"><div className="spinner"></div></div>}
             
             {/* Affichage de la Timeline */}
             {!isLoading && timelineData.length > 0 ? (
               timelineData.map((item, i) => (
                <TimelineItem 
                  key={item.id || `item-${i}`} 
                  item={item} // L'objet calculé par processTimeline (data + height + type)
                  now={now} 
                  completedEvents={completedEvents} 
                  toggleTaskCompletion={toggleTaskCompletion} 
                />
             ))
            ) : (
              !isLoading && (
                <div className="empty-state">
                  <p>Rien de prévu ✨</p>
                </div>
              )
            )}
             
             {/* Espace pour ne pas que le dernier item soit caché par la nav */}
             <div className="spacer-bottom"></div>
           </div>
         ) : (
           /* Écran de connexion si non connecté */
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