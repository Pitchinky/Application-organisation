import React from 'react';
import { format, isSameDay, addDays, startOfWeek, addWeeks, subWeeks } from 'date-fns';
import { fr } from 'date-fns/locale';
import { 
  Plus, CloudLightning, CloudRain, Snowflake, 
  Sun, Cloud, Wind, Umbrella, ChevronLeft, ChevronRight 
} from 'lucide-react';
import './Header.css';

import { getDailySummary } from '../../utils/weatherLogic';

export default function Header({ 
  currentDate, setCurrentDate, todaySummary, 
  setShowAddModal, handleLogin, isSignedIn, forecast 
}) {
  
  const weekDays = Array.from({ length: 7 }).map((_, i) => 
    addDays(startOfWeek(currentDate, { weekStartsOn: 1 }), i)
  );

  const nextWeek = () => setCurrentDate(addWeeks(currentDate, 1));
  const prevWeek = () => setCurrentDate(subWeeks(currentDate, 1));

  const getWeatherIcon = (code, size=16) => {
    if (!code) return <Sun size={size} />;
    if (code >= 200 && code < 300) return <CloudLightning size={size} />;
    if (code >= 300 && code < 600) return <CloudRain size={size} />;
    if (code >= 600 && code < 700) return <Snowflake size={size} />;
    if (code === 800) return <Sun size={size} />;
    if (code > 800) return <Cloud size={size} />;
    return <Wind size={size} />;
  };

  return (
    <header className="app-header">
      <div className="header-top">
        <div className="date-block">
           <div className="month-selector">
              <button className="nav-arrow" onClick={prevWeek}><ChevronLeft size={20} /></button>
              <h1 onClick={() => setCurrentDate(new Date())}>
                {format(currentDate, 'MMMM yyyy', { locale: fr })}
              </h1>
              <button className="nav-arrow" onClick={nextWeek}><ChevronRight size={20} /></button>
           </div>
           
           {/* MÉTÉO DÉPLACÉE ICI POUR ÊTRE À CÔTÉ DU MOIS */}
           {todaySummary && (
             <div className="weather-pill">
               {getWeatherIcon(todaySummary.weather[0].id, 14)}
               <span>{Math.round(todaySummary.temp)}°</span>
             </div>
           )}
        </div>
        
        <div className="header-actions">
           {!isSignedIn ? (
             <button onClick={handleLogin} className="login-btn-google">
                <span>Connexion</span>
             </button>
           ) : (
             <button className="add-btn-minimal" onClick={()=>setShowAddModal(true)}>
               <Plus size={20} />
             </button>
           )}
        </div>
      </div>

      <div className="days-wrapper">
        <div className="days-grid">
        {weekDays.map((day, i) => {
          const isSelected = isSameDay(day, currentDate);
          const isToday = isSameDay(day, new Date());
          const daySummary = getDailySummary(day, forecast);
          const rainChance = daySummary ? Math.round(daySummary.pop * 100) : 0;

          return (
            <div key={i} className={`day-card ${isSelected ? 'selected' : ''} ${isToday ? 'is-today' : ''}`} onClick={() => setCurrentDate(day)}>
              <span className="day-label">{format(day, 'EEE', { locale: fr }).replace('.', '')}</span>
              <span className="day-number">{format(day, 'd')}</span>
              
              <div className="day-meta">
                {daySummary && rainChance >= 20 ? (
                  <div className="rain-info" style={{ color: rainChance > 50 ? "#FF3B30" : "#007AFF" }}>
                    <Umbrella size={10} strokeWidth={3} />
                    <span>{rainChance}%</span>
                  </div>
                ) : (
                  daySummary && <div className="weather-small">{getWeatherIcon(daySummary.weather[0].id, 12)}</div>
                )}
              </div>
            </div>
          );
        })}
        </div>
      </div>
    </header>
  );
}