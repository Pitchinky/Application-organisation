import React, { useState, useEffect } from 'react';
import { gapi } from 'gapi-script';
import './App.css';

// Remplace par tes infos Google Cloud
// React exige que les variables d'environnement commencent par REACT_APP_
const CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;
const API_KEY = process.env.REACT_APP_GOOGLE_API_KEY;
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"];
const SCOPES = "https://www.googleapis.com/auth/calendar.readonly";

function App() {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    const start = () => {
      gapi.client.init({
        apiKey: API_KEY,
        clientId: CLIENT_ID,
        discoveryDocs: DISCOVERY_DOCS,
        scope: SCOPES,
      });
    };
    gapi.load('client:auth2', start);
  }, []);

  const handleLogin = () => {
    gapi.auth2.getAuthInstance().signIn().then(() => {
      listUpcomingEvents();
    });
  };

  const listUpcomingEvents = () => {
    gapi.client.calendar.events.list({
      'calendarId': 'primary',
      'timeMin': (new Date()).toISOString(),
      'showDeleted': false,
      'singleEvents': true,
      'maxResults': 10,
      'orderBy': 'startTime'
    }).then(response => {
      const resEvents = response.result.items.map(event => ({
        id: event.id,
        title: event.summary,
        start: new Date(event.start.dateTime || event.start.date),
      }));
      setEvents(resEvents);
    });
  };

  return (
    <div className="structured-app">
      <header>
        <div className="date-pill">{new Date().toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
        <h1>Planning</h1>
        <button onClick={handleLogin} className="sync-btn">Connexion Google</button>
      </header>

      <div className="timeline-container">
        {events.length > 0 ? events.map((event, index) => (
          <div key={event.id} className="timeline-item">
            <div className="time-label">
              {event.start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div className="dot-container">
              <div className="dot"></div>
              {index !== events.length - 1 && <div className="line"></div>}
            </div>
            <div className="event-card">
              <b>{event.title}</b>
            </div>
          </div>
        )) : (
          <p className="empty">Aucun événement. Connectez votre compte Google.</p>
        )}
      </div>
    </div>
  );
}

export default App;