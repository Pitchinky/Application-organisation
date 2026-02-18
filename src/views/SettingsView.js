// src/views/SettingsView.js
import React from 'react';
import { Check, Calendar, LogOut, User } from 'lucide-react';
import './SettingsView.css';

export default function SettingsView({ 
  calendars, 
  selectedCalendarIds, 
  toggleCalendar, 
  handleLogout, 
  user 
}) {
  return (
    <div className="settings-container">
      <header className="settings-header">
        <h1>Paramètres</h1>
      </header>

      <section className="settings-section">
        <h2 className="section-title">Calendriers</h2>
        <p className="section-desc">Sélectionnez les calendriers à afficher dans votre timeline.</p>
        
        <div className="cal-list-settings">
          {calendars.map((c) => (
            <div 
              key={c.id} 
              className="cal-item-settings" 
              onClick={() => toggleCalendar(c.id)}
            >
              <div 
                className="cal-dot" 
                style={{ backgroundColor: c.backgroundColor }}
              >
                {selectedCalendarIds.includes(c.id) && <Check size={14} color="white" />}
              </div>
              <span className="cal-name">{c.summary}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <h2 className="section-title">Compte</h2>
        <button className="logout-btn" onClick={handleLogout}>
          <LogOut size={18} />
          Déconnexion
        </button>
      </section>
    </div>
  );
}