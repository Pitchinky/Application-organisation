/* global google */
import React, { useState, useEffect } from 'react';
import { gapi } from 'gapi-script';
import './App.css';

const CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;
const API_KEY = process.env.REACT_APP_GOOGLE_API_KEY;
const SCOPES = "https://www.googleapis.com/auth/calendar.readonly";
const DISCOVERY_DOC = "https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest";

function App() {
  const [events, setEvents] = useState([]);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [tokenClient, setTokenClient] = useState(null);

  // 1. Initialiser le client GAPI (pour lire les données)
  useEffect(() => {
    gapi.load("client", async () => {
      await gapi.client.init({
        apiKey: API_KEY,
        discoveryDocs: [DISCOVERY_DOC],
      });
    });
  }, []);

  // 2. Initialiser le client GIS (pour se connecter - Nouvelle Méthode)
  useEffect(() => {
    /* Le script google est chargé dans index.html */
    try {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (tokenResponse) => {
          if (tokenResponse && tokenResponse.access_token) {
            setIsSignedIn(true);
            listUpcomingEvents();
          }
        },
      });
      setTokenClient(client);
    } catch (err) {
      console.error("Erreur init Google Identity:", err);
    }
  }, []);

  const handleLogin = () => {
    if (tokenClient) {
      // Ouvre la popup Google moderne
      tokenClient.requestAccessToken();
    } else {
      alert("Le service Google n'est pas encore prêt. Attendez 2 secondes.");
    }
  };

  const handleLogout = () => {
    const token = gapi.client.getToken();
    if (token !== null) {
      google.accounts.oauth2.revoke(token.access_token, () => {
        gapi.client.setToken('');
        setIsSignedIn(false);
        setEvents([]);
      });
    }
  };

  const listUpcomingEvents = async () => {
    try {
      const response = await gapi.client.calendar.events.list({
        'calendarId': 'primary',
        'timeMin': (new Date()).toISOString(),
        'showDeleted': false,
        'singleEvents': true,
        'maxResults': 15,
        'orderBy': 'startTime',
      });
      setEvents(response.result.items);
    } catch (err) {
      console.error("Erreur chargement événements:", err);
      if (err.status === 401 || err.status === 403) {
        setIsSignedIn(false);
        alert("Session expirée, veuillez vous reconnecter.");
      }
    }
  };

  return (
    <div className="structured-app">
      <header>
        <div className="date-pill">Aujourd'hui</div>
        <h1>Mon Planning</h1>
        {!isSignedIn ? (
          <button onClick={handleLogin} className="sync-btn">Connexion Google</button>
        ) : (
          <button onClick={handleLogout} className="sync-btn" style={{backgroundColor: '#FF3B30'}}>Déconnexion</button>
        )}
      </header>

      <div className="timeline-container">
        {events.length > 0 ? events.map((event, index) => (
          <div key={event.id || index} className="timeline-item">
            <div className="time-label">
              {event.start.dateTime 
                ? new Date(event.start.dateTime).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})
                : "Journée"}
            </div>
            <div className="dot-container">
               <div className="dot"></div>
               {index !== events.length - 1 && <div className="line"></div>}
            </div>
            <div className="event-card">
              <b>{event.summary}</b>
            </div>
          </div>
        )) : (
          <p className="empty">
            {isSignedIn ? "Aucun événement prévu." : "Connectez-vous pour voir votre agenda."}
          </p>
        )}
      </div>
    </div>
  );
}

export default App;