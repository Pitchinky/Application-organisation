/* global google */
import React, { useState, useEffect } from 'react';
import { gapi } from 'gapi-script';
import { 
  Settings, ChevronLeft, ChevronRight, Inbox, CheckCircle, Circle, 
  Menu, Plus, Clock, Calendar as CalIcon 
} from 'lucide-react';
import { format, addDays, subDays, isSameDay, startOfWeek, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import './App.css';

const CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;
const API_KEY = process.env.REACT_APP_GOOGLE_API_KEY;
const SCOPES = "https://www.googleapis.com/auth/calendar.readonly";
const DISCOVERY_DOC = "https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest";

function App() {
  const [events, setEvents] = useState([]);
  const [calendars, setCalendars] = useState([]);
  const [selectedCalendarIds, setSelectedCalendarIds] = useState(['primary']);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [tokenClient, setTokenClient] = useState(null);

  // --- INITIALISATION (GAPI + GIS) ---
  useEffect(() => {
    gapi.load("client", async () => {
      await gapi.client.init({ apiKey: API_KEY, discoveryDocs: [DISCOVERY_DOC] });
      const token = localStorage.getItem('g_token');
      const expiry = localStorage.getItem('g_expiry');
      if (token && expiry && Date.now() < parseInt(expiry)) {
        gapi.client.setToken({ access_token: token });
        setIsSignedIn(true);
        loadData();
      }
    });
  }, []);

  useEffect(() => {
    try {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (resp) => {
          if (resp.access_token) {
            const expiresIn = (resp.expires_in || 3599) * 1000;
            localStorage.setItem('g_token', resp.access_token);
            localStorage.setItem('g_expiry', Date.now() + expiresIn);
            setIsSignedIn(true);
            loadData();
          }
        },
      });
      setTokenClient(client);
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => {
    if (isSignedIn) fetchAllEvents();
  }, [currentDate, selectedCalendarIds, isSignedIn]);

  const loadData = async () => {
    await loadCalendars();
  };

  const loadCalendars = async () => {
    try {
      const response = await gapi.client.calendar.calendarList.list();
      setCalendars(response.result.items);
    } catch (e) { console.error(e); }
  };

  const fetchAllEvents = async () => {
    if (selectedCalendarIds.length === 0) return setEvents([]);
    try {
      const startOfDay = new Date(currentDate); startOfDay.setHours(0,0,0,0);
      const endOfDay = new Date(currentDate); endOfDay.setHours(23,59,59,999);

      const promises = selectedCalendarIds.map(async (calId) => {
        const response = await gapi.client.calendar.events.list({
          'calendarId': calId,
          'timeMin': startOfDay.toISOString(),
          'timeMax': endOfDay.toISOString(),
          'showDeleted': false,
          'singleEvents': true,
          'orderBy': 'startTime',
        });
        const cal = calendars.find(c => c.id === calId);
        // On force des couleurs pastels si possible, sinon couleur Google
        return response.result.items.map(event => ({ ...event, color: cal?.backgroundColor }));
      });

      const results = await Promise.all(promises);
      const merged = results.flat().sort((a, b) => {
        return new Date(a.start.dateTime || a.start.date) - new Date(b.start.dateTime || b.start.date);
      });
      setEvents(merged);
    } catch (e) {
      if(e.status === 401) { setIsSignedIn(false); localStorage.clear(); }
    }
  };

  const handleLogin = () => tokenClient.requestAccessToken();

  // Générer les jours de la semaine pour la barre du haut
  const weekDays = Array.from({ length: 7 }).map((_, i) => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 }); // Lundi
    return addDays(start, i);
  });

  return (
    <div className="structured-web-layout">
      
      {/* HEADER TYPE STRUCTURED */}
      <header className="main-header">
        <div className="header-left">
          <button className="icon-btn"><Menu size={20} /></button>
          <button className="inbox-btn"><Inbox size={16} /> Inbox</button>
          <div className="date-title">
            <h1>{format(currentDate, 'MMMM yyyy', { locale: fr })}</h1>
            <div className="nav-arrows">
              <button onClick={() => setCurrentDate(subDays(currentDate, 1))}><ChevronLeft size={16}/></button>
              <button onClick={() => setCurrentDate(addDays(currentDate, 1))}><ChevronRight size={16}/></button>
            </div>
          </div>
        </div>
        
        <div className="header-right">
          <div className="view-switcher">
            <button className="view-btn active">Jour</button>
            <button className="view-btn">Semaine</button>
          </div>
          <button className="icon-btn"><Settings size={20} /></button>
          {!isSignedIn && <button onClick={handleLogin} className="login-btn">Connexion</button>}
        </div>
      </header>

      {/* BARRE DES JOURS (Horizontal Day Strip) */}
      <div className="day-strip">
        {weekDays.map((day, i) => {
          const isSelected = isSameDay(day, currentDate);
          const isToday = isSameDay(day, new Date());
          return (
            <div 
              key={i} 
              className={`day-cell ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`}
              onClick={() => setCurrentDate(day)}
            >
              <span className="day-name">{format(day, 'EEE', { locale: fr })}</span>
              <span className="day-num">{format(day, 'd')}</span>
              {/* Petits points de charge (simulés) */}
              <div className="day-dots">
                {i % 2 === 0 && <div className="dot" style={{background: '#ff7eb6'}}></div>}
                {i % 3 === 0 && <div className="dot" style={{background: '#7afcff'}}></div>}
              </div>
            </div>
          );
        })}
      </div>

      {/* TIMELINE PRINCIPALE */}
      <div className="timeline-scroll-area">
        <div className="timeline-container">
          
          {isSignedIn ? (
            events.length > 0 ? events.map((event, index) => {
              const isAllDay = !event.start.dateTime;
              const startTime = isAllDay ? null : parseISO(event.start.dateTime);
              const endTime = isAllDay ? null : parseISO(event.end.dateTime);
              const duration = startTime && endTime ? Math.round((endTime - startTime) / 60000) : 0;
              
              // Couleur pastel dérivée ou par défaut
              const eventColor = event.color || '#34C759'; 
              
              return (
                <div key={event.id} className="timeline-row">
                  {/* HEURE */}
                  <div className="time-col">
                    <span className="time-text">
                      {startTime ? format(startTime, 'HH:mm') : 'Journée'}
                    </span>
                  </div>

                  {/* VISUEL CENTRAL (Ligne + Capsule) */}
                  <div className="visual-col">
                    <div className="vertical-line"></div>
                    <div className="capsule-icon" style={{ backgroundColor: eventColor }}>
                      <Clock size={14} color="white" />
                    </div>
                  </div>

                  {/* CARTE ÉVÉNEMENT */}
                  <div className="card-col">
                    <div className="structured-card">
                      <div className="card-left" style={{ borderLeft: `4px solid ${eventColor}` }}>
                        <div className="card-info">
                          <span className="event-range">
                             {startTime && endTime ? `${format(startTime, 'HH:mm')} - ${format(endTime, 'HH:mm')}` : 'Toute la journée'} 
                             {duration > 0 && ` (${Math.round(duration/60)}h${duration%60 > 0 ? duration%60 : ''})`}
                          </span>
                          <h3 className="event-title">{event.summary}</h3>
                          {event.location && <p className="event-loc">📍 {event.location}</p>}
                        </div>
                      </div>
                      <div className="card-right">
                         {/* Checkbox "Structured" */}
                         <button className="check-btn">
                           <Circle size={22} color="#ddd" />
                         </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }) : (
              <div className="empty-state">
                <p>Rien de prévu 🎉</p>
                <button className="add-task-btn">Ajouter une tâche</button>
              </div>
            )
          ) : (
             <div className="welcome-box">
               <h2>Bienvenue sur Structured Web</h2>
               <button onClick={handleLogin} className="primary-btn">Connecter Google Calendar</button>
             </div>
          )}
          
          {/* Ligne vide pour scroller jusqu'en bas */}
          <div style={{height: '100px'}}></div>
        </div>
      </div>

      {/* FAB (Bouton Plus flottant) */}
      <button className="fab-btn">
        <Plus size={24} color="white" />
      </button>
    </div>
  );
}

export default App;