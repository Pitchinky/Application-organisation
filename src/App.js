import React, { useState, useEffect } from 'react';
import { gapi } from 'gapi-script';
import './App.css';

const CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;
const API_KEY = process.env.REACT_APP_GOOGLE_API_KEY;
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"];
const SCOPES = "https://www.googleapis.com/auth/calendar.readonly";

function App() {
  const [events, setEvents] = useState([]);
  const [isSignedIn, setIsSignedIn] = useState(false);

  useEffect(() => {
    const start = () => {
      gapi.client.init({
        apiKey: API_KEY,
        clientId: CLIENT_ID,
        discoveryDocs: DISCOVERY_DOCS,
        scope: SCOPES,
      }).then(() => {
        // Vérifier si déjà connecté
        setIsSignedIn(gapi.auth2.getAuthInstance().isSignedIn.get());
      }).catch(err => console.error("Erreur init Google:", err));
    };
    gapi.load('client:auth2', start);
  }, []);

  const handleAuth = () => {
    if (isSignedIn) {
      gapi.auth2.getAuthInstance().signOut().then(() => setIsSignedIn(false));
    } else {
      gapi.auth2.getAuthInstance().signIn({ux_mode: 'popup'}).then(() => {
        setIsSignedIn(true);
        loadEvents();
      });
    }
  };

  const loadEvents = () => {
    gapi.client.calendar.events.list({
      'calendarId': 'primary',
      'timeMin': (new Date()).toISOString(),
      'showDeleted': false,
      'singleEvents': true,
      'maxResults': 10,
      'orderBy': 'startTime'
    }).then(response => {
      setEvents(response.result.items);
    });
  };

  // Charger les événements automatiquement si déjà connecté
  useEffect(() => {
    if (isSignedIn) loadEvents();
  }, [isSignedIn]);

  return (
    <div className="structured-app">
      <header>
        <div className="date-pill">Aujourd'hui</div>
        <h1>Planning</h1>
        <button onClick={handleAuth} className="sync-btn">
          {isSignedIn ? "Déconnexion" : "Connexion Google"}
        </button>
      </header>

      <div className="timeline-container">
        {events.length > 0 ? events.map((event) => (
          <div key={event.id} className="timeline-item">
            <div className="time-label">
              {new Date(event.start.dateTime || event.start.date).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}
            </div>
            <div className="event-card">
              <b>{event.summary}</b>
            </div>
          </div>
        )) : (
          <p className="empty">{isSignedIn ? "Aucun événement trouvé." : "Connectez-vous pour voir votre agenda."}</p>
        )}
      </div>
    </div>
  );
}

export default App;