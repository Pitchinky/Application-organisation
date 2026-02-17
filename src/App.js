/* global google */
import React, { useState, useEffect } from 'react';
import { gapi } from 'gapi-script';
import { Calendar, Settings, ChevronLeft, ChevronRight, Layout, Clock, Filter, Check } from 'lucide-react';
import { format, isSameDay, parseISO, addDays, subDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import './App.css';

const CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;
const API_KEY = process.env.REACT_APP_GOOGLE_API_KEY;
const SCOPES = "https://www.googleapis.com/auth/calendar.readonly";
const DISCOVERY_DOC = "https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest";

function App() {
  const [events, setEvents] = useState([]);
  const [calendars, setCalendars] = useState([]);
  
  // NOUVEAU : Tableau pour stocker PLUSIEURS agendas sélectionnés
  const [selectedCalendarIds, setSelectedCalendarIds] = useState(['primary']);
  
  // NOUVEAU : Gestion de la date affichée
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [tokenClient, setTokenClient] = useState(null);
  const [showCalMenu, setShowCalMenu] = useState(false); // Afficher/Cacher le menu des agendas

  // Initialisation GAPI & Vérification Session
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

  // Initialisation GIS
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

  // Recharge les événements à chaque changement de date OU d'agendas sélectionnés
  useEffect(() => {
    if (isSignedIn && calendars.length > 0) {
      fetchAllEvents();
    }
  }, [currentDate, selectedCalendarIds, calendars, isSignedIn]);

  const loadData = async () => {
    await loadCalendars();
    // fetchAllEvents sera déclenché par le useEffect
  };

  const loadCalendars = async () => {
    try {
      const response = await gapi.client.calendar.calendarList.list();
      setCalendars(response.result.items);
    } catch (e) { console.error(e); }
  };

  // NOUVEAU : Récupère et fusionne les événements de TOUS les agendas sélectionnés
  const fetchAllEvents = async () => {
    if (selectedCalendarIds.length === 0) {
      setEvents([]);
      return;
    }

    try {
      const startOfDay = new Date(currentDate); startOfDay.setHours(0,0,0,0);
      const endOfDay = new Date(currentDate); endOfDay.setHours(23,59,59,999);

      // Créer une promesse d'appel API pour CHAQUE calendrier sélectionné
      const promises = selectedCalendarIds.map(async (calId) => {
        const response = await gapi.client.calendar.events.list({
          'calendarId': calId,
          'timeMin': startOfDay.toISOString(),
          'timeMax': endOfDay.toISOString(),
          'showDeleted': false,
          'singleEvents': true,
          'orderBy': 'startTime',
        });
        
        // Retrouver la couleur de ce calendrier
        const cal = calendars.find(c => c.id === calId);
        const color = cal?.backgroundColor || '#007AFF';

        // Attacher la couleur à chaque événement pour l'affichage
        return response.result.items.map(event => ({ ...event, color }));
      });

      // Attendre que TOUS les appels Google soient terminés
      const results = await Promise.all(promises);
      
      // Fusionner tous les tableaux d'événements en un seul et trier par heure
      const mergedEvents = results.flat().sort((a, b) => {
        const timeA = new Date(a.start.dateTime || a.start.date);
        const timeB = new Date(b.start.dateTime || b.start.date);
        return timeA - timeB;
      });

      setEvents(mergedEvents);
    } catch (e) {
      console.error(e);
      if(e.status === 401) { setIsSignedIn(false); localStorage.clear(); }
    }
  };

  // NOUVEAU : Gérer la sélection multiple d'agendas
  const toggleCalendar = (id) => {
    setSelectedCalendarIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(calId => calId !== id); // Le retirer
      } else {
        return [...prev, id]; // L'ajouter
      }
    });
  };

  // NOUVEAU : Navigation dans le temps
  const prevDay = () => setCurrentDate(prev => subDays(prev, 1));
  const nextDay = () => setCurrentDate(prev => addDays(prev, 1));
  const goToToday = () => setCurrentDate(new Date());

  const handleLogin = () => tokenClient.requestAccessToken();

  return (
    <div className="structured-layout">
      {/* SIDEBAR */}
      <nav className="sidebar">
        <div className="logo-area">
          <div className="app-icon">S</div>
        </div>
        <div className="nav-items">
          <button className="nav-btn active"><Layout size={20} /></button>
          <button className="nav-btn" onClick={goToToday} title="Aujourd'hui"><Calendar size={20} /></button>
          <button className="nav-btn"><Settings size={20} /></button>
        </div>
      </nav>

      {/* CONTENU PRINCIPAL */}
      <main className="main-content">
        <header className="top-bar">
          <div className="date-display">
            <div className="date-nav">
              <button onClick={prevDay} className="icon-btn"><ChevronLeft size={24} /></button>
              <h2>{isSameDay(currentDate, new Date()) ? "Aujourd'hui" : format(currentDate, 'EEEE d MMM', { locale: fr })}</h2>
              <button onClick={nextDay} className="icon-btn"><ChevronRight size={24} /></button>
            </div>
            <p className="subtitle">{format(currentDate, 'MMMM yyyy', { locale: fr })}</p>
          </div>
          
          <div className="actions">
            {isSignedIn ? (
              <div className="filter-container">
                <button 
                  className="filter-btn" 
                  onClick={() => setShowCalMenu(!showCalMenu)}
                >
                  <Filter size={16} /> Agendas ({selectedCalendarIds.length})
                </button>

                {showCalMenu && (
                  <div className="cal-dropdown">
                    <div className="cal-dropdown-header">Mes Agendas</div>
                    {calendars.map(cal => {
                      const isSelected = selectedCalendarIds.includes(cal.id);
                      return (
                        <div 
                          key={cal.id} 
                          className="cal-option" 
                          onClick={() => toggleCalendar(cal.id)}
                        >
                          <div className="cal-color-dot" style={{ backgroundColor: cal.backgroundColor }}>
                            {isSelected && <Check size={10} color="white" />}
                          </div>
                          <span className="cal-name">{cal.summaryOverride || cal.summary}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <button onClick={handleLogin} className="login-btn">Connexion</button>
            )}
          </div>
        </header>

        <div className="timeline-wrapper" onClick={() => setShowCalMenu(false)}>
           {isSignedIn ? (
             <div className="timeline">
               {events.length > 0 ? events.map((event, i) => {
                 const isAllDay = !event.start.dateTime;
                 const startTime = isAllDay ? null : parseISO(event.start.dateTime);
                 const endTime = isAllDay ? null : parseISO(event.end.dateTime);
                 
                 return (
                   <div key={event.id} className="event-row">
                     <div className="time-col">
                       <span className="time-start">
                         {isAllDay ? 'Jour' : format(startTime, 'HH:mm')}
                       </span>
                       <span className="time-end">
                         {!isAllDay && format(endTime, 'HH:mm')}
                       </span>
                     </div>
                     
                     <div className="visual-col">
                       <div className="line-segment"></div>
                       {/* Le point prend la couleur de l'agenda */}
                       <div className="bullet" style={{ borderColor: event.color }}></div>
                     </div>

                     <div className="card-col">
                       <div className="event-card" style={{ borderLeft: `4px solid ${event.color}` }}>
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
                   <p>Rien de prévu pour ce jour.</p>
                 </div>
               )}
             </div>
           ) : (
             <div className="welcome-screen">
               <h1>Ton Planning Parfait</h1>
               <p>Connecte ton compte Google pour voir tes journées.</p>
               <button onClick={handleLogin} className="big-login-btn">
                 Synchroniser
               </button>
             </div>
           )}
        </div>
      </main>
    </div>
  );
}

export default App;