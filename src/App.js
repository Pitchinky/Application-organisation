/* global google */
import React, { useState, useEffect, useRef } from 'react';
import { gapi } from 'gapi-script';
import './App.css';

const CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;
const API_KEY = process.env.REACT_APP_GOOGLE_API_KEY;
const SCOPES = "https://www.googleapis.com/auth/calendar.readonly";
const DISCOVERY_DOC = "https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest";

function App() {
  const [events, setEvents] = useState([]);
  const [calendars, setCalendars] = useState([]);
  const [selectedCalendarId, setSelectedCalendarId] = useState('primary');
  const [calendarColor, setCalendarColor] = useState('#007AFF');
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [tokenClient, setTokenClient] = useState(null);
  const [currentTimePosition, setCurrentTimePosition] = useState(null);

  // Initialisation GAPI (Lecture)
  useEffect(() => {
    gapi.load("client", async () => {
      await gapi.client.init({
        apiKey: API_KEY,
        discoveryDocs: [DISCOVERY_DOC],
      });
      // Tentative de restauration de session
      const savedToken = localStorage.getItem('google_access_token');
      const savedExpiration = localStorage.getItem('google_token_expires');
      
      if (savedToken && savedExpiration && Date.now() < parseInt(savedExpiration)) {
        gapi.client.setToken({ access_token: savedToken });
        setIsSignedIn(true);
        loadCalendars();
        listUpcomingEvents('primary');
      }
    });
  }, []);

  // Initialisation GIS (Connexion)
  useEffect(() => {
    try {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (tokenResponse) => {
          if (tokenResponse && tokenResponse.access_token) {
            // Sauvegarde du token pour 50 minutes (marge de sécurité)
            const expiresIn = (tokenResponse.expires_in || 3599) * 1000;
            localStorage.setItem('google_access_token', tokenResponse.access_token);
            localStorage.setItem('google_token_expires', Date.now() + expiresIn);
            
            setIsSignedIn(true);
            loadCalendars();
            listUpcomingEvents('primary');
          }
        },
      });
      setTokenClient(client);
    } catch (err) {
      console.error("Erreur init Google Identity:", err);
    }
  }, []);

  // Calcul de la position de la ligne "Maintenant"
  useEffect(() => {
    const interval = setInterval(() => {
        // On recalcule la position (logique simplifiée pour l'exemple visuel)
        // Dans une vraie app Structured, c'est calculé par rapport à la hauteur des pixels
        setCurrentTimePosition(new Date()); 
    }, 60000); // Mise à jour chaque minute
    return () => clearInterval(interval);
  }, []);

  const handleLogin = () => {
    if (tokenClient) tokenClient.requestAccessToken();
  };

  const handleLogout = () => {
    const token = gapi.client.getToken();
    if (token !== null) {
      google.accounts.oauth2.revoke(token.access_token, () => {
        gapi.client.setToken('');
        localStorage.removeItem('google_access_token');
        localStorage.removeItem('google_token_expires');
        setIsSignedIn(false);
        setEvents([]);
        setCalendars([]);
      });
    }
  };

  const loadCalendars = async () => {
    try {
      const response = await gapi.client.calendar.calendarList.list();
      setCalendars(response.result.items);
    } catch (err) { console.error(err); }
  };

  const listUpcomingEvents = async (calendarId) => {
    try {
      // On récupère les événements de minuit ce matin à minuit ce soir
      const startOfDay = new Date();
      startOfDay.setHours(0,0,0,0);
      const endOfDay = new Date();
      endOfDay.setHours(23,59,59,999);

      const response = await gapi.client.calendar.events.list({
        'calendarId': calendarId,
        'timeMin': startOfDay.toISOString(),
        'timeMax': endOfDay.toISOString(),
        'showDeleted': false,
        'singleEvents': true,
        'maxResults': 50,
        'orderBy': 'startTime',
      });
      setEvents(response.result.items);
      
      const currentCal = calendars.find(c => c.id === calendarId);
      if (currentCal && currentCal.backgroundColor) {
        setCalendarColor(currentCal.backgroundColor);
      }
    } catch (err) {
      console.error("Erreur événements", err);
      if (err.status === 401) {
        // Token expiré, on nettoie
        handleLogout();
      }
    }
  };

  const handleCalendarChange = (e) => {
    const newId = e.target.value;
    setSelectedCalendarId(newId);
    listUpcomingEvents(newId);
  };

  // Fonction utilitaire pour formater l'heure
  const formatTime = (isoString) => {
    if (!isoString) return "";
    return new Date(isoString).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'});
  };

  // Vérifier si un événement est "en cours"
  const isCurrentEvent = (start, end) => {
    const now = new Date();
    return now >= new Date(start) && now <= new Date(end);
  };

  return (
    <div className="structured-app">
      <header className="app-header">
        <div className="header-top">
            <span className="greeting">Bonjour,</span>
            {isSignedIn && (
                <div className="avatar-placeholder" onClick={handleLogout}>D</div>
            )}
        </div>
        <h1>Mon Planning</h1>
        
        {!isSignedIn ? (
          <div className="login-container">
            <p>Connecte-toi pour voir ta journée</p>
            <button onClick={handleLogin} className="sync-btn">Connexion Google</button>
          </div>
        ) : (
          <div className="calendar-selector-container">
            <select 
                className="calendar-select" 
                value={selectedCalendarId} 
                onChange={handleCalendarChange}
                style={{color: calendarColor, borderColor: calendarColor}}
            >
                <option value="primary">Mon Agenda</option>
                {calendars.filter(c => c.id !== 'primary').map(c => (
                    <option key={c.id} value={c.id}>{c.summary}</option>
                ))}
            </select>
          </div>
        )}
      </header>

      {isSignedIn && (
        <div className="timeline-container">
            {/* Indicateur ligne rouge (visuel simple positionné en haut pour l'exemple) */}
            <div className="current-time-indicator">
                <div className="red-dot"></div>
                <div className="red-line"></div>
                <span className="time-now">MAINTENANT</span>
            </div>

            {events.length > 0 ? events.map((event, index) => {
                const isActive = event.start.dateTime && isCurrentEvent(event.start.dateTime, event.end.dateTime);
                
                return (
                <div key={event.id || index} className={`timeline-item ${isActive ? 'active-event' : ''}`}>
                    <div className="time-column">
                        <span className="start-time">{formatTime(event.start.dateTime)}</span>
                        <span className="end-time">{formatTime(event.end.dateTime)}</span>
                    </div>
                    
                    <div className="visual-timeline">
                        <div className="timeline-line"></div>
                        <div className="event-dot" style={{backgroundColor: calendarColor, boxShadow: isActive ? `0 0 10px ${calendarColor}` : 'none'}}>
                             {/* On pourrait mettre une icône ici plus tard */}
                        </div>
                    </div>

                    <div className="event-card" style={{borderLeft: `4px solid ${calendarColor}`}}>
                        <h3>{event.summary}</h3>
                        {event.location && <p className="location">📍 {event.location}</p>}
                    </div>
                </div>
                );
            }) : (
                <div className="empty-state">
                    <p>Aucun événement pour le reste de la journée 🎉</p>
                </div>
            )}
        </div>
      )}
    </div>
  );
}

export default App;