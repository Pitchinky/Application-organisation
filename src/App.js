/* global google */
import React, { useState, useEffect } from 'react';
import { gapi } from 'gapi-script';
import { 
  Settings, ChevronLeft, ChevronRight, Inbox, Check, Circle, 
  Menu, Plus, Clock, Filter, X, Calendar as CalIcon 
} from 'lucide-react';
import { format, addDays, subDays, isSameDay, startOfWeek, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import './App.css';

const CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;
const API_KEY = process.env.REACT_APP_GOOGLE_API_KEY;
const SCOPES = "https://www.googleapis.com/auth/calendar.events"; // Scope modifié pour ÉCRIRE
const DISCOVERY_DOC = "https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest";

function App() {
  // --- ÉTATS (DATA) ---
  const [events, setEvents] = useState([]);
  const [calendars, setCalendars] = useState([]);
  const [selectedCalendarIds, setSelectedCalendarIds] = useState(['primary']);
  const [completedEvents, setCompletedEvents] = useState({}); // Stocke les IDs cochés
  
  // --- ÉTATS (UI) ---
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [showCalMenu, setShowCalMenu] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  
  // --- ÉTATS (NOUVELLE TÂCHE) ---
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskTime, setNewTaskTime] = useState("12:00");
  const [newTaskDuration, setNewTaskDuration] = useState(60);

  const [tokenClient, setTokenClient] = useState(null);

  // 1. Initialiser GAPI
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

  // 2. Initialiser GIS
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

  // Recharger les événements si la date ou les filtres changent
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
        return response.result.items.map(event => ({ ...event, color: cal?.backgroundColor, calId: calId }));
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

  // --- ACTIONS ---

  const handleLogin = () => tokenClient.requestAccessToken();

  const toggleCalendar = (calId) => {
    setSelectedCalendarIds(prev => 
      prev.includes(calId) ? prev.filter(id => id !== calId) : [...prev, calId]
    );
  };

  const toggleTaskCompletion = (eventId) => {
    const newStatus = { ...completedEvents, [eventId]: !completedEvents[eventId] };
    setCompletedEvents(newStatus);
    localStorage.setItem('completed_tasks', JSON.stringify(newStatus));
  };

  const createEvent = async () => {
    if (!newTaskTitle) return;

    try {
      // Calculer Date de début et fin
      const [hours, minutes] = newTaskTime.split(':');
      const start = new Date(currentDate);
      start.setHours(parseInt(hours), parseInt(minutes), 0);
      
      const end = new Date(start.getTime() + newTaskDuration * 60000);

      const event = {
        summary: newTaskTitle,
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() }
      };

      await gapi.client.calendar.events.insert({
        calendarId: 'primary',
        resource: event,
      });

      setShowAddModal(false);
      setNewTaskTitle("");
      fetchAllEvents(); // Rafraîchir la liste
      alert("Tâche ajoutée !");
    } catch (e) {
      console.error("Erreur création", e);
      alert("Erreur lors de la création.");
    }
  };

  // --- RENDU ---

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
          {/* BOUTON FILTRE AGENDAS */}
          <div className="relative-container">
            <button 
              className={`view-btn ${showCalMenu ? 'active' : ''}`} 
              onClick={() => setShowCalMenu(!showCalMenu)}
            >
              <Filter size={14} /> Agendas
            </button>
            
            {showCalMenu && (
              <div className="dropdown-menu">
                <div className="dropdown-title">Mes Calendriers</div>
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

          <button className="icon-btn"><Settings size={20} /></button>
          {!isSignedIn && <button onClick={handleLogin} className="login-btn">Connexion</button>}
        </div>
      </header>

      {/* BARRE JOURS */}
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
              {isSelected && <div className="active-dot"></div>}
            </div>
          );
        })}
      </div>

      {/* TIMELINE */}
      <div className="timeline-scroll-area" onClick={() => setShowCalMenu(false)}>
        <div className="timeline-container">
          
          {isSignedIn ? (
            events.length > 0 ? events.map((event) => {
              const isAllDay = !event.start.dateTime;
              const startTime = isAllDay ? null : parseISO(event.start.dateTime);
              const endTime = isAllDay ? null : parseISO(event.end.dateTime);
              const eventColor = event.color || '#34C759'; 
              const isChecked = completedEvents[event.id];

              return (
                <div key={event.id} className={`timeline-row ${isChecked ? 'completed' : ''}`}>
                  <div className="time-col">
                    <span className="time-text">
                      {startTime ? format(startTime, 'HH:mm') : 'Jour'}
                    </span>
                  </div>

                  <div className="visual-col">
                    <div className="vertical-line"></div>
                    <div className="capsule-icon" style={{ backgroundColor: isChecked ? '#ccc' : eventColor }}>
                      {isChecked ? <Check size={14} color="white" /> : <Clock size={14} color="white" />}
                    </div>
                  </div>

                  <div className="card-col">
                    <div className="structured-card">
                      <div className="card-left" style={{ borderLeft: `4px solid ${isChecked ? '#ccc' : eventColor}` }}>
                        <div className="card-info">
                          <span className="event-range">
                             {startTime && endTime ? `${format(startTime, 'HH:mm')} - ${format(endTime, 'HH:mm')}` : 'Toute la journée'}
                          </span>
                          <h3 className="event-title">{event.summary}</h3>
                        </div>
                      </div>
                      <div className="card-right">
                         <button className="check-btn" onClick={() => toggleTaskCompletion(event.id)}>
                           {isChecked ? (
                             <div className="checked-circle"><Check size={14} color="white" /></div>
                           ) : (
                             <Circle size={24} color="#E5E5EA" strokeWidth={2} />
                           )}
                         </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }) : (
              <div className="empty-state">
                <p>Aucune tâche pour le moment.</p>
              </div>
            )
          ) : (
             <div className="welcome-box">
               <button onClick={handleLogin} className="primary-btn">Synchroniser Google</button>
             </div>
          )}
          
          <div style={{height: '100px'}}></div>
        </div>
      </div>

      {/* FAB (Ajouter Tâche) */}
      {isSignedIn && (
        <button className="fab-btn" onClick={() => setShowAddModal(true)}>
          <Plus size={28} color="white" />
        </button>
      )}

      {/* MODAL AJOUT TÂCHE */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h2>Nouvelle Tâche</h2>
              <button className="close-btn" onClick={() => setShowAddModal(false)}><X size={20}/></button>
            </div>
            
            <div className="modal-body">
              <input 
                type="text" 
                placeholder="Ex: Aller à la salle de sport..." 
                className="task-input"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                autoFocus
              />
              
              <div className="time-inputs">
                <div className="input-group">
                  <label>Heure</label>
                  <input 
                    type="time" 
                    value={newTaskTime}
                    onChange={(e) => setNewTaskTime(e.target.value)}
                  />
                </div>
                <div className="input-group">
                  <label>Durée (min)</label>
                  <input 
                    type="number" 
                    value={newTaskDuration}
                    onChange={(e) => setNewTaskDuration(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="date-preview">
                📅 {format(currentDate, 'd MMMM yyyy', {locale: fr})}
              </div>
            </div>

            <div className="modal-footer">
              <button className="save-btn" onClick={createEvent}>Créer la tâche</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;