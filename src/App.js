/* global google */
import React, { useState, useEffect } from 'react';
import { gapi } from 'gapi-script';
import { 
  Settings, ChevronLeft, ChevronRight, Check, Circle, 
  Menu, Plus, Clock, Filter, X, MoreHorizontal 
} from 'lucide-react';
import { format, addDays, subDays, isSameDay, startOfWeek, parseISO, differenceInMinutes } from 'date-fns';
import { fr } from 'date-fns/locale';
import './App.css';

const CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;
const API_KEY = process.env.REACT_APP_GOOGLE_API_KEY;
const SCOPES = "https://www.googleapis.com/auth/calendar.events";
const DISCOVERY_DOC = "https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest";

function App() {
  const [events, setEvents] = useState([]);
  const [calendars, setCalendars] = useState([]);
  const [selectedCalendarIds, setSelectedCalendarIds] = useState(['primary']);
  const [completedEvents, setCompletedEvents] = useState({});
  
  // UI States
  const [currentDate, setCurrentDate] = useState(new Date());
  const [now, setNow] = useState(new Date()); // Pour la barre de progression
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [showCalMenu, setShowCalMenu] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  
  // New Task Form
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskTime, setNewTaskTime] = useState("12:00");
  const [newTaskDuration, setNewTaskDuration] = useState(60);

  const [tokenClient, setTokenClient] = useState(null);

  // --- INIT & AUTH (Identique à avant) ---
  useEffect(() => {
    gapi.load("client", async () => {
      await gapi.client.init({ apiKey: API_KEY, discoveryDocs: [DISCOVERY_DOC] });
      const savedCompleted = JSON.parse(localStorage.getItem('completed_tasks') || '{}');
      setCompletedEvents(savedCompleted);
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

  // Timer pour mettre à jour la barre de progression chaque minute
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (isSignedIn) fetchAllEvents();
  }, [currentDate, selectedCalendarIds, isSignedIn]);

  const loadData = async () => await loadCalendars();

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
          'calendarId': calId, 'timeMin': startOfDay.toISOString(), 'timeMax': endOfDay.toISOString(),
          'showDeleted': false, 'singleEvents': true, 'orderBy': 'startTime',
        });
        const cal = calendars.find(c => c.id === calId);
        return response.result.items.map(event => ({ ...event, color: cal?.backgroundColor, calId: calId }));
      });

      const results = await Promise.all(promises);
      const merged = results.flat().sort((a, b) => new Date(a.start.dateTime || a.start.date) - new Date(b.start.dateTime || b.start.date));
      setEvents(merged);
    } catch (e) { if(e.status === 401) { setIsSignedIn(false); localStorage.clear(); } }
  };

  // --- LOGIQUE PROGRESSION ---
  const getEventStatus = (event) => {
    if (!event.start.dateTime) return { status: 'future', progress: 0 };
    
    const start = parseISO(event.start.dateTime);
    const end = parseISO(event.end.dateTime);
    const totalMinutes = differenceInMinutes(end, start);
    const elapsedMinutes = differenceInMinutes(now, start);

    if (now > end) return { status: 'past', progress: 100 };
    if (now < start) return { status: 'future', progress: 0 };
    
    // En cours : calcul du pourcentage
    const progress = Math.min(100, Math.max(0, (elapsedMinutes / totalMinutes) * 100));
    return { status: 'current', progress: progress };
  };

  // --- ACTIONS (Identique) ---
  const handleLogin = () => tokenClient.requestAccessToken();
  const toggleCalendar = (calId) => setSelectedCalendarIds(prev => prev.includes(calId) ? prev.filter(id => id !== calId) : [...prev, calId]);
  const toggleTaskCompletion = (eventId) => {
    const newStatus = { ...completedEvents, [eventId]: !completedEvents[eventId] };
    setCompletedEvents(newStatus);
    localStorage.setItem('completed_tasks', JSON.stringify(newStatus));
  };
  const createEvent = async () => {
    if (!newTaskTitle) return;
    try {
      const [hours, minutes] = newTaskTime.split(':');
      const start = new Date(currentDate); start.setHours(parseInt(hours), parseInt(minutes), 0);
      const end = new Date(start.getTime() + newTaskDuration * 60000);
      await gapi.client.calendar.events.insert({
        calendarId: 'primary',
        resource: { summary: newTaskTitle, start: { dateTime: start.toISOString() }, end: { dateTime: end.toISOString() } },
      });
      setShowAddModal(false); setNewTaskTitle(""); fetchAllEvents();
    } catch (e) { alert("Erreur création"); }
  };

  const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(startOfWeek(currentDate, { weekStartsOn: 1 }), i));

  return (
    <div className="structured-web-layout">
      {/* HEADER */}
      <header className="main-header">
        <div className="header-left">
          <button className="icon-btn"><Menu size={20} /></button>
          <div className="date-title">
            <h1>{format(currentDate, 'MMMM yyyy', { locale: fr })}</h1>
            <div className="nav-arrows">
              <button onClick={() => setCurrentDate(subDays(currentDate, 1))}><ChevronLeft size={16}/></button>
              <button onClick={() => setCurrentDate(addDays(currentDate, 1))}><ChevronRight size={16}/></button>
              <button onClick={() => setCurrentDate(new Date())} className="today-btn">Auj.</button>
            </div>
          </div>
        </div>
        <div className="header-right">
          <div className="relative-container">
            <button className={`view-btn ${showCalMenu ? 'active' : ''}`} onClick={() => setShowCalMenu(!showCalMenu)}>
              <Filter size={14} /> Agendas
            </button>
            {showCalMenu && (
              <div className="dropdown-menu">
                {calendars.map(cal => (
                  <div key={cal.id} className="dropdown-item" onClick={() => toggleCalendar(cal.id)}>
                    <div className="dot-check" style={{background: cal.backgroundColor}}>
                      {selectedCalendarIds.includes(cal.id) && <Check size={12} color="white" />}
                    </div>
                    <span>{cal.summaryOverride || cal.summary}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {!isSignedIn && <button onClick={handleLogin} className="login-btn">Connexion</button>}
        </div>
      </header>

      {/* DAY STRIP */}
      <div className="day-strip">
        {weekDays.map((day, i) => {
          const isSelected = isSameDay(day, currentDate);
          const isToday = isSameDay(day, new Date());
          return (
            <div key={i} className={`day-cell ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`} onClick={() => setCurrentDate(day)}>
              <span className="day-name">{format(day, 'EEE', { locale: fr })}</span>
              <span className="day-num">{format(day, 'd')}</span>
              {isSelected && <div className="active-dot"></div>}
            </div>
          );
        })}
      </div>

      {/* TIMELINE */}
      <div className="timeline-scroll-area" onClick={() => setShowCalMenu(false)}>
        <div className="timeline-container">
          {isSignedIn ? (
            events.length > 0 ? events.map((event, index) => {
              const isAllDay = !event.start.dateTime;
              const startTime = isAllDay ? null : parseISO(event.start.dateTime);
              const endTime = isAllDay ? null : parseISO(event.end.dateTime);
              const eventColor = event.color || '#34C759'; 
              const isChecked = completedEvents[event.id];
              
              // Calculer l'état (Passé, En cours, Futur)
              const { status, progress } = isAllDay ? { status: 'future', progress: 0 } : getEventStatus(event);
              const isCurrent = status === 'current';

              return (
                <div key={event.id} className={`timeline-row ${isChecked || status === 'past' ? 'dimmed' : ''}`}>
                  <div className="time-col">
                    <span className="time-text">{startTime ? format(startTime, 'HH:mm') : 'Jour'}</span>
                    {startTime && <span className="time-sub">{format(endTime, 'HH:mm')}</span>}
                  </div>

                  {/* LA BULLE MAGIQUE */}
                  <div className="visual-col">
                    {/* Ligne de connexion */}
                    <div className="vertical-line"></div>
                    
                    {/* La Gélule (Pill) */}
                    <div 
                      className={`capsule-pill ${isCurrent ? 'active-pulse' : ''}`}
                      style={{ 
                        // C'est ici que la magie opère : Le dégradé dynamique
                        background: isCurrent 
                          ? `linear-gradient(to bottom, ${eventColor} ${progress}%, #F2F2F7 ${progress}%)`
                          : (status === 'past' || isChecked ? '#E5E5EA' : '#F2F2F7'),
                        border: `2px solid ${status === 'past' ? '#E5E5EA' : eventColor}`,
                        color: isCurrent && progress > 50 ? 'white' : eventColor
                      }}
                    >
                      {isChecked ? <Check size={14} color={status === 'past' ? "#999" : eventColor} /> : 
                       isCurrent ? <Clock size={14} color="inherit" /> :
                       <div className="bullet-dot" style={{background: eventColor}}></div>
                      }
                    </div>
                  </div>

                  <div className="card-col">
                    <div className="structured-card">
                      <div className="card-content">
                        <h3 className="event-title" style={{textDecoration: isChecked ? 'line-through' : 'none'}}>
                          {event.summary}
                        </h3>
                        <span className="event-range">
                          {startTime && endTime ? `${differenceInMinutes(endTime, startTime)} min` : 'Toute la journée'}
                          {event.location && ` • 📍 ${event.location}`}
                        </span>
                      </div>
                      <div className="card-actions">
                         <button className="check-btn" onClick={() => toggleTaskCompletion(event.id)}>
                           {isChecked ? <div className="checked-circle"><Check size={14} color="white" /></div> : <Circle size={24} color="#E5E5EA" />}
                         </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }) : <div className="empty-state"><p>Rien de prévu 🎉</p></div>
          ) : <div className="welcome-box"><button onClick={handleLogin} className="primary-btn">Synchroniser</button></div>}
          <div style={{height: '100px'}}></div>
        </div>
      </div>

      {/* FAB */}
      {isSignedIn && <button className="fab-btn" onClick={() => setShowAddModal(true)}><Plus size={28} color="white" /></button>}

      {/* MODAL */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header"><h2>Nouvelle Tâche</h2><button className="close-btn" onClick={() => setShowAddModal(false)}><X size={20}/></button></div>
            <div className="modal-body">
              <input type="text" placeholder="Titre..." className="task-input" value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} autoFocus />
              <div className="time-inputs">
                <div className="input-group"><label>Heure</label><input type="time" value={newTaskTime} onChange={(e) => setNewTaskTime(e.target.value)} /></div>
                <div className="input-group"><label>Durée (min)</label><input type="number" value={newTaskDuration} onChange={(e) => setNewTaskDuration(e.target.value)} /></div>
              </div>
            </div>
            <div className="modal-footer"><button className="save-btn" onClick={createEvent}>Créer</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;