import React from 'react';
import { format, isSameDay, addDays, startOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Filter, Plus, CloudLightning, CloudRain, Snowflake, Sun, Cloud, Wind } from 'lucide-react';
import './Header.css';

import { getDailySummary } from '../../utils/weatherLogic';
import { Umbrella } from 'lucide-react';

export default function Header({ 
  currentDate, setCurrentDate, todaySummary, 
  showCalMenu, setShowCalMenu, setShowAddModal, 
  handleLogin, isSignedIn, forecast, ...props
}) {
  
  const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(startOfWeek(currentDate, { weekStartsOn: 1 }), i));

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
           <h1 onClick={() => setCurrentDate(new Date())}>{format(currentDate, 'MMMM yyyy', { locale: fr })}</h1>
           {todaySummary && (
             <div className="weather-pill">
               {getWeatherIcon(todaySummary.weather[0].id, 14)}
               <span>{Math.round(todaySummary.temp)}°</span>
             </div>
           )}
        </div>
        <div className="header-actions">
           <div className="desktop-only-actions">
              
              <button className="desktop-add-btn" onClick={()=>setShowAddModal(true)}><Plus size={16} /> Ajouter</button>
           </div>
           {!isSignedIn && <button onClick={handleLogin} className="login-btn-small">Login</button>}
        </div>
      </div>

      <div className="days-strip-scroll">
        <div className="days-strip">
        {weekDays.map((day, i) => {
          const isSelected = isSameDay(day, currentDate);
          const isToday = isSameDay(day, new Date());
          
          // APPEL DE LA FONCTION UTILS
          const daySummary = getDailySummary(day, forecast);
          const rainChance = daySummary ? Math.round(daySummary.pop * 100) : 0;

          let rainColor = "#8E8E93"; // Gris par défaut
          if (rainChance > 70) rainColor = "#FF3B30"; // Rouge
          else if (rainChance > 30) rainColor = "#FF9500"; // Orange
          else if (rainChance > 10) rainColor = "#007AFF"; // Bleu

          return (
            <div key={i} className={`day-item ${isSelected ? 'selected' : ''}`} onClick={() => setCurrentDate(day)}>
              <span className="day-name">{format(day, 'EEE', { locale: fr })}</span>
              <span className="day-num">{format(day, 'd')}</span>
              
              {daySummary && rainChance >= 20 ? (
                <div className="day-rain-indicator" style={{ color: rainColor }}>
                  <Umbrella size={12} strokeWidth={2.5} />
                  <span className="rain-percent">{rainChance}%</span>
                </div>
              ) : (
                daySummary && <div className="day-weather-small">{getWeatherIcon(daySummary.weather[0].id, 12)}</div>
              )}
            </div>
          );
        })}
        </div>
      </div>
    </header>
  );
}