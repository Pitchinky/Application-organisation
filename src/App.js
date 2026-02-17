/* global google */
import React, { useState, useEffect, useRef } from 'react';
import { gapi } from 'gapi-script';
import { Calendar, Settings, ChevronLeft, ChevronRight, Layout, Clock } from 'lucide-react';
import { format, isSameDay, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import './App.css';

const CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;
const API_KEY = process.env.REACT_APP_GOOGLE_API_KEY;
const SCOPES = "https://www.googleapis.com/auth/calendar.readonly";
const DISCOVERY_DOC = "https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest";

function App() {
  const [events, setEvents] = useState([]);
  const [calendars, setCalendars] = useState([]);
  const [selectedCalendarId, setSelectedCalendarId] = useState('primary');
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [tokenClient, setTokenClient] = useState(null);
  const [nowPosition, setNowPosition] = useState(0);

  // Initialisation GAPI
  useEffect(() => {
    gapi.load("client", async () => {
      await gapi.client.init({ apiKey: API_KEY, discoveryDocs: [DISCOVERY_DOC] });
      checkSession();
    });
  }, []);

  // Initialisation GIS
  useEffect(() => {
    try {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (resp) => {
          if (resp.access_token) {
            saveSession(resp);
            setIsSignedIn(true);
            loadData();
          }
        },
      });
      setTokenClient(client);
    } catch (err) { console.error(err); }
  }, []);

  // Mise à jour de la ligne rouge "Maintenant" toutes les minutes
  useEffect(() => {
    const updatePosition = () => {
      const now = new Date();
      const startOfDay = new Date().setHours(0,0,0,0);
      const endOfDay = new Date().setHours(23,59,59,999);
      const totalMinutes = (endOfDay - startOfDay) / 60000;
      const currentMinutes = (now - startOfDay) / 60000;
      // On convertit en pourcentage de la journée pour placer la ligne
      setNowPosition((currentMinutes / totalMinutes) * 100);
    };
    updatePosition();
    const interval = setInterval(updatePosition, 60000);
    return () => clearInterval(interval);
  }, []);

  const checkSession = () => {
    const token = localStorage.getItem('g_token');
    const expiry = localStorage.getItem('g_expiry');
    if (token && expiry && Date.now() < parseInt(expiry)) {
      gapi.client.setToken({ access_token: token });
      setIsSignedIn(true);
      loadData();
    }
  };

  const saveSession = (response) => {
    const expiresIn = (response.expires_in || 3599) * 1000;
    localStorage.setItem('g_token', response.access_token);
    localStorage.setItem('g_expiry', Date.now() + expiresIn);
  };

  const loadData = async () => {
    await loadCalendars();
    await listEvents('primary');
  };

  const loadCalendars = async () => {
    try {
      const response = await gapi.client.calendar.calendarList.list();
      setCalendars(response.result.items);
    } catch (e) { console.error(e); }
  };

  const listEvents = async (calId) => {
    try {
      const start = new Date(); start.setHours(0,0,0,0);
      const end = new Date(); end.setHours(23,59,59,999);
      
      const response = await gapi.client.calendar.events.list({
        'calendarId': calId,
        'timeMin': start.toISOString(),
        'timeMax': end.toISOString(),
        'showDeleted': false,
        'singleEvents': true,
        'orderBy': 'startTime',
      });
      setEvents(response.result.items);
    } catch (e) {
      if(e.status === 401) { setIsSignedIn(false); localStorage.clear(); }
    }
  };

  const handleLogin = () => tokenClient.requestAccessToken();

  return (
    <div className="structured-layout">
      {/* SIDEBAR STYLE STRUCTURED */}
      <nav className="sidebar">
        <div className="logo-area">
          <div className="app-icon">S</div>
        </div>
        <div className="nav-items">
          <button className="nav-btn active"><Layout size={20} /></button>
          <button className="nav-btn"><Calendar size={20} /></button>
          <button className="nav-btn"><Settings size={20} /></button>
        </div>
      </nav>

      {/* CONTENU PRINCIPAL */}
      <main className="main-content">
        <header className="top-bar">
          <div className="date-display">
            <h2>Aujourd'hui</h2>
            <p>{format(new Date(), 'EEEE d MMMM', { locale: fr })}</p>
          </div>
          
          <div className="actions">
            {isSignedIn ? (
              <select 
                className="cal-select"
                value={selectedCalendarId}
                onChange={(e) => { setSelectedCalendarId(e.target.value); listEvents(e.target.value); }}
              >
                <option value="primary">Principal</option>
                {calendars.filter(c => c.id !== 'primary').map(c => (
                  <option key={c.id} value={c.id}>{c.summary}</option>
                ))}
              </select>
            ) : (
              <button onClick={handleLogin} className="login-btn">Connexion</button>
            )}
          </div>
        </header>

        <div className="timeline-wrapper">
           {/* Si connecté, on affiche la timeline */}
           {isSignedIn ? (
             <div className="timeline">
               {/* Ligne rouge MAINTENANT (positionnée approximativement pour l'exemple visuel) */}
               {/* Note: Dans une vraie app complexe, on calculerait la position pixel par pixel */}
               
               {events.length > 0 ? events.map((event, i) => {
                 const startTime = event.start.dateTime ? parseISO(event.start.dateTime) : null;
                 const endTime = event.end.dateTime ? parseISO(event.end.dateTime) : null;
                 
                 return (
                   <div key={event.id} className="event-row">
                     <div className="time-col">
                       <span className="time-start">
                         {startTime ? format(startTime, 'HH:mm') : 'Jour'}
                       </span>
                       <span className="time-end">
                         {endTime ? format(endTime, 'HH:mm') : ''}
                       </span>
                     </div>
                     
                     <div className="visual-col">
                       <div className="line-segment"></div>
                       <div className="bullet">
                         {/* Icône selon le type d'événement ou juste un rond */}
                       </div>
                     </div>

                     <div className="card-col">
                       <div className="event-card">
                         <div className="card-content">
                           <h3>{event.summary}</h3>
                           {event.location && (
                             <div className="location-badge">📍 {event.location}</div>
                           )}
                         </div>
                       </div>
                     </div>
                   </div>
                 );
               }) : (
                 <div className="empty-state">
                   <Clock size={48} color="#ddd" />
                   <p>Rien de prévu pour le reste de la journée.</p>
                 </div>
               )}
             </div>
           ) : (
             <div className="welcome-screen">
               <h1>Bienvenue sur ton Planning</h1>
               <p>Connecte ton compte Google pour synchroniser ta vie.</p>
               <button onClick={handleLogin} className="big-login-btn">
                 Synchroniser avec Google
               </button>
             </div>
           )}
        </div>
      </main>
    </div>
  );
}

export default App;