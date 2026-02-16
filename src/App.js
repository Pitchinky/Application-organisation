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
  const [calendars, setCalendars] = useState([]); // Liste des calendriers
  const [selectedCalendarId, setSelectedCalendarId] = useState('primary'); // Calendrier sélectionné
  const [calendarColor, setCalendarColor] = useState('#007AFF'); // Couleur du calendrier
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [tokenClient, setTokenClient] = useState(null);

  // 1. Initialiser GAPI
  useEffect(() => {
    gapi.load("client", async () => {
      await gapi.client.init({
        apiKey: API_KEY,
        discoveryDocs: [DISCOVERY_DOC],
      });
    });
  }, []);

  // 2. Initialiser GIS (Google Identity Services)
  useEffect(() => {
    try {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (tokenResponse) => {
          if (tokenResponse && tokenResponse.access_token) {
            setIsSignedIn(true);
            loadCalendars(); // On charge la liste des calendriers dès la connexion
            listUpcomingEvents('primary'); // On charge les événements du principal par défaut
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
      tokenClient.requestAccessToken();
    }
  };

  const handleLogout = () => {
    const token = gapi.client.getToken();
    if (token !== null) {
      google.accounts.oauth2.revoke(token.access_token, () => {
        gapi.client.setToken('');
        setIsSignedIn(false);
        setEvents([]);
        setCalendars([]);
      });
    }
  };

  // Charge la liste de tous les calendriers disponibles
  const loadCalendars = async () => {
    try {
      const response = await gapi.client.calendar.calendarList.list();
      setCalendars(response.result.items);
    } catch (err) {
      console.error("Erreur chargement liste calendriers:", err);
    }
  };

  // Charge les événements d'un calendrier spécifique
  const listUpcomingEvents = async (calendarId) => {
    try {
      const response = await gapi.client.calendar.events.list({
        'calendarId': calendarId,
        'timeMin': (new Date()).toISOString(),
        'showDeleted': false,
        'singleEvents': true,
        'maxResults': 15,
        'orderBy': 'startTime',
      });
      setEvents(response.result.items);
      
      // Trouver la couleur du calendrier pour l'affichage
      const currentCal = calendars.find(c => c.id === calendarId);
      if (currentCal && currentCal.backgroundColor) {
        setCalendarColor(currentCal.backgroundColor);
      }
    } catch (err) {
      console.error("Erreur chargement événements:", err);
    }
  };

  // Quand l'utilisateur change de calendrier dans le menu
  const handleCalendarChange = (e) => {
    const newCalendarId = e.target.value;
    setSelectedCalendarId(newCalendarId);
    
    // Mettre à jour la couleur
    const selectedCal = calendars.find(cal => cal.id === newCalendarId);
    if (selectedCal) {
      setCalendarColor(selectedCal.backgroundColor || '#007AFF');
    }

    listUpcomingEvents(newCalendarId);
  };

  return (
    <div className="structured-app">
      <header>
        <div className="date-pill">Aujourd'hui</div>
        <h1>Mon Planning</h1>
        
        {/* Menu de sélection des calendriers (n'apparaît que si connecté) */}
        {isSignedIn && calendars.length > 0 && (
          <select 
            className="calendar-select" 
            value={selectedCalendarId} 
            onChange={handleCalendarChange}
            style={{ marginBottom: '15px', padding: '8px', borderRadius: '8px', border: '1px solid #ccc', width: '100%' }}
          >
            <option value="primary">Mon Agenda Principal</option>
            {calendars
              .filter(cal => cal.id !== 'primary') // On évite les doublons si 'primary' est déjà là
              .map((cal) => (
              <option key={cal.id} value={cal.id}>
                {cal.summaryOverride || cal.summary}
              </option>
            ))}
          </select>
        )}

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
               {/* Le point prend la couleur du calendrier */}
               <div className="dot" style={{backgroundColor: calendarColor}}></div>
               {index !== events.length - 1 && <div className="line"></div>}
            </div>
            <div className="event-card">
              <b>{event.summary}</b>
            </div>
          </div>
        )) : (
          <p className="empty">
            {isSignedIn ? "Aucun événement prévu sur cet agenda." : "Connectez-vous pour voir votre agenda."}
          </p>
        )}
      </div>
    </div>
  );
}

export default App;