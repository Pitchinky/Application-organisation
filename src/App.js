/* global google */
import React, { useState, useEffect, useRef } from 'react';
import { gapi } from 'gapi-script';
import { 
  Settings, ChevronLeft, ChevronRight, Check, Circle, 
  Menu, Plus, Clock, Filter, X, 
  Cloud, Sun, CloudRain, Snowflake, CloudLightning, Wind, Umbrella, Calendar as CalIcon 
} from 'lucide-react';
import { format, addDays, subDays, isSameDay, startOfWeek, parseISO, differenceInMinutes } from 'date-fns';
import { fr } from 'date-fns/locale';
import './App.css';

const CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;
const API_KEY = process.env.REACT_APP_GOOGLE_API_KEY;
const WEATHER_KEY = process.env.REACT_APP_WEATHER_API_KEY;
const SCOPES = "https://www.googleapis.com/auth/calendar.events";
const DISCOVERY_DOC = "https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest";

function App() {
  const [events, setEvents] = useState([]);
  const [calendars, setCalendars] = useState([]);
  const [selectedCalendarIds, setSelectedCalendarIds] = useState(['primary']);
  const [completedEvents, setCompletedEvents] = useState({});
  const [forecast, setForecast] = useState([]);
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [now, setNow] = useState(new Date()); 
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showCalMenu, setShowCalMenu] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskTime, setNewTaskTime] = useState("12:00");
  const [newTaskDuration, setNewTaskDuration] = useState(60);
  const [tokenClient, setTokenClient] = useState(null);
  
  // Référence pour scroller automatiquement vers l'heure actuelle
  const nowRef = useRef(null);

  // --- INITIALISATION ---
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
    const initClient = () => {
      if (window.google && window.google.accounts) {
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID, scope: SCOPES,
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
      } else { setTimeout(initClient, 500); }
    };
    initClient();
  }, []);

  useEffect(() => {
    if (!WEATHER_KEY) return;
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const res = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&units=metric&lang=fr&appid=${WEATHER_KEY}`);
        const data = await res.json();
        if (data.list) setForecast(data.list);
      } catch (e) { console.error(e); }
    });
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => { if (isSignedIn) fetchAllEvents(); }, [currentDate, selectedCalendarIds, isSignedIn]);

  // Scroll automatique vers l'événement en cours au chargement
  useEffect(() => {
    if (!isLoading && events.length > 0 && nowRef.current) {
      nowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [events, isLoading]);

  const loadData = async () => await loadCalendars();
  const loadCalendars = async () => { try { const r = await gapi.client.calendar.calendarList.list(); setCalendars(r.result.items); } catch(e){} };

  const fetchAllEvents = async () => {
    if (selectedCalendarIds.length === 0) { setEvents([]); return; }
    setEvents([]); setIsLoading(true);
    try {
      const startOfDay = new Date(currentDate); startOfDay.setHours(0,0,0,0);
      const endOfDay = new Date(currentDate); endOfDay.setHours(23,59,59,999);
      const promises = selectedCalendarIds.map(async (calId) => {
        const r = await gapi.client.calendar.events.list({ 'calendarId': calId, 'timeMin': startOfDay.toISOString(), 'timeMax': endOfDay.toISOString(), 'showDeleted': false, 'singleEvents': true, 'orderBy': 'startTime' });
        const cal = calendars.find(c => c.id === calId);
        return r.result.items.map(e => ({ ...e, color: cal?.backgroundColor, calId: calId }));
      });
      const results = await Promise.all(promises);
      const raw = results.flat();
      const unique = new Map(); raw.forEach(e => !unique.has(e.id) && unique.set(e.id, e));
      setEvents(Array.from(unique.values()).sort((a,b) => new Date(a.start.dateTime||a.start.date) - new Date(b.start.dateTime||b.start.date)));
    } catch(e) { if(e.status===401){setIsSignedIn(false);localStorage.clear();} } finally { setIsLoading(false); }
  };

  // --- HELPERS ---
  const getDailySummary = (date) => {
    if (forecast.length === 0) return null;
    const dateStr = format(date, 'yyyy-MM-dd');
    const daySlots = forecast.filter(item => item.dt_txt.includes(dateStr));
    if (daySlots.length === 0) return null;
    const maxPop = Math.max(...daySlots.map(slot => slot.pop));
    const worstSlot = daySlots.find(slot => slot.weather[0].id < 700) || daySlots.find(slot => slot.weather[0].id < 800) || daySlots[Math.floor(daySlots.length / 2)];
    return { pop: maxPop, weather: worstSlot.weather, temp: daySlots[Math.floor(daySlots.length / 2)].main.temp };
  };

  const getWeatherIcon = (code, size=16) => {
    if (code >= 200 && code < 300) return <CloudLightning size={size} />;
    if (code >= 300 && code < 600) return <CloudRain size={size} />;
    if (code >= 600 && code < 700) return <Snowflake size={size} />;
    if (code === 800) return <Sun size={size} />;
    if (code > 800) return <Cloud size={size} />;
    return <Wind size={size} />;
  };

  const getEventStatus = (event) => {
    if (!event.start.dateTime) return { status: 'future', progress: 0 };
    const start = parseISO(event.start.dateTime); const end = parseISO(event.end.dateTime);
    if (now > end) return { status: 'past', progress: 100 };
    if (now < start) return { status: 'future', progress: 0 };
    const total = differenceInMinutes(end, start); const elapsed = differenceInMinutes(now, start);
    return { status: 'current', progress: Math.min(100, Math.max(0, (elapsed / total) * 100)) };
  };

  const handleLogin = () => tokenClient?.requestAccessToken();
  const toggleCalendar = (id) => setSelectedCalendarIds(p => p.includes(id) ? p.filter(i=>i!==id) : [...p, id]);
  const toggleTaskCompletion = (id) => { const n = {...completedEvents, [id]:!completedEvents[id]}; setCompletedEvents(n); localStorage.setItem('completed_tasks', JSON.stringify(n)); };
  const createEvent = async () => { if(!newTaskTitle)return; try { const [h,m] = newTaskTime.split(':'); const s = new Date(currentDate); s.setHours(parseInt(h),parseInt(m),0); const e = new Date(s.getTime()+newTaskDuration*60000); await gapi.client.calendar.events.insert({calendarId:'primary', resource:{summary:newTaskTitle, start:{dateTime:s.toISOString()}, end:{dateTime:e.toISOString()}}}); setShowAddModal(false); setNewTaskTitle(""); setTimeout(()=>fetchAllEvents(),500); } catch(e){alert("Erreur");} };

  const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(startOfWeek(currentDate, { weekStartsOn: 1 }), i));
  const todaySummary = getDailySummary(new Date());

  return (
    <div className="structured-layout">
      {/* Container Principal : Centre l'app sur Desktop, Plein écran sur Mobile */}
      <div className="app-container">
        
        {/* HEADER FIXE */}
        <header className="app-header">
          <div className="header-top">
            <div className="date-block">
               {/* Titre mois cliquable pour revenir à aujourd'hui */}
               <h1 onClick={() => setCurrentDate(new Date())}>{format(currentDate, 'MMMM yyyy', { locale: fr })}</h1>
               {todaySummary && (
                 <div className="weather-pill">
                   {getWeatherIcon(todaySummary.weather[0].id, 14)}
                   <span>{Math.round(todaySummary.temp)}°</span>
                 </div>
               )}
            </div>
            
            <div className="header-actions">
              <div className="cal-filter-wrapper">
                 <button className="icon-btn" onClick={()=>setShowCalMenu(!showCalMenu)}><Filter size={18}/></button>
                 {showCalMenu && <div className="dropdown-menu">{calendars.map(c=>(<div key={c.id} className="dropdown-item" onClick={()=>toggleCalendar(c.id)}><div className="dot-check" style={{background:c.backgroundColor}}>{selectedCalendarIds.includes(c.id)&&<Check size={12} color="white"/>}</div><span>{c.summaryOverride||c.summary}</span></div>))}</div>}
              </div>
              <button className="icon-btn"><Settings size={18} /></button>
              {!isSignedIn && <button onClick={handleLogin} className="login-btn-small">Login</button>}
            </div>
          </div>

          {/* Navigation Jours (Scrollable) */}
          <div className="days-strip-scroll">
            <div className="days-strip">
              {weekDays.map((day, i) => {
                const isSelected = isSameDay(day, currentDate);
                const isToday = isSameDay(day, new Date());
                const summary = getDailySummary(day);
                const rainChance = summary ? Math.round(summary.pop * 100) : 0;
                return (
                  <div key={i} className={`day-item ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`} onClick={() => setCurrentDate(day)}>
                    <span className="day-name">{format(day, 'EEE', { locale: fr })}</span>
                    <span className="day-num">{format(day, 'd')}</span>
                    {summary && rainChance >= 20 ? (
                       <div className="day-weather rain" style={{color: rainChance > 50 ? '#FF3B30' : '#007AFF'}}>
                         <Umbrella size={10} strokeWidth={3} />
                       </div>
                    ) : (
                       summary && <div className="day-weather">{getWeatherIcon(summary.weather[0].id, 10)}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </header>

        {/* TIMELINE (SCROLLABLE AREA) */}
        <main className="timeline-area" onClick={()=>setShowCalMenu(false)}>
           {isSignedIn ? (
             <div className="timeline-content">
               {isLoading && <div className="loader"><div className="spinner"></div></div>}
               
               {/* Ligne "MAINTENANT" (si on est aujourd'hui) */}
               {isSameDay(currentDate, new Date()) && !isLoading && (
                 <div className="now-indicator-line" style={{ top: '100px' /* Dynamique dans une version avancée */ }}>
                    {/* Pour l'instant visuel, positionnerait en CSS avancé */}
                 </div>
               )}

               {!isLoading && events.length > 0 ? events.map((e, i) => {
                 const isAllDay=!e.start.dateTime; const start=isAllDay?null:parseISO(e.start.dateTime); const end=isAllDay?null:parseISO(e.end.dateTime);
                 const color=e.color||'#34C759'; const checked=completedEvents[e.id];
                 const {status,progress}=isAllDay?{status:'future',progress:0}:getEventStatus(e); const isCur=status==='current';
                 
                 // Ref pour le scroll auto
                 const itemRef = isCur ? nowRef : null;

                 return (
                   <div key={e.id} ref={itemRef} className={`timeline-row ${checked||status==='past'?'past':''} ${isCur?'current':''}`}>
                      <div className="time-column">
                        <span className="time-start">{start ? format(start, 'HH:mm') : 'Jour'}</span>
                        <span className="time-end">{end && format(end, 'HH:mm')}</span>
                      </div>
                      
                      <div className="visual-column">
                        <div className="line"></div>
                        <div className="pill" style={{
                           borderColor: status==='past' ? '#E5E5EA' : color,
                           background: isCur ? `linear-gradient(to bottom, ${color} ${progress}%, white ${progress}%)` : (status==='past'||checked ? '#F2F2F7' : 'white')
                        }}>
                           {checked ? <Check size={12} color="#999"/> : isCur ? <div className="pulse-dot" style={{background:color}}></div> : <div className="static-dot" style={{background:color}}></div>}
                        </div>
                      </div>

                      <div className="card-column">
                        <div className="event-card" onClick={()=>toggleTaskCompletion(e.id)}>
                          <div className="card-text">
                            <h3>{e.summary}</h3>
                            {e.location && <p className="location">📍 {e.location}</p>}
                          </div>
                          <div className="check-ring">
                            {checked ? <div className="check-fill"><Check size={14} color="white"/></div> : <div className="check-outline"></div>}
                          </div>
                        </div>
                      </div>
                   </div>
                 );
               }) : (!isLoading && <div className="empty-state"><p>Aucun plan pour aujourd'hui ✨</p></div>)}
               
               <div className="spacer-bottom"></div>
             </div>
           ) : (
             <div className="login-screen">
               <h1>Bienvenue</h1>
               <p>Connectez votre calendrier pour commencer.</p>
               <button onClick={handleLogin} className="login-btn-large">Connexion Google</button>
             </div>
           )}
        </main>

        {/* BOUTON FLOTTANT (FAB) */}
        {isSignedIn && (
          <button className="fab" onClick={()=>setShowAddModal(true)}>
            <Plus size={32} color="white" />
          </button>
        )}

        {/* MODALE AJOUT (Style iOS Bottom Sheet en Mobile) */}
        {showAddModal && (
          <div className="modal-backdrop" onClick={()=>setShowAddModal(false)}>
            <div className="modal-sheet" onClick={e=>e.stopPropagation()}>
              <div className="modal-handle"></div>
              <div className="modal-header">
                <h2>Nouvelle tâche</h2>
                <button className="close-icon" onClick={()=>setShowAddModal(false)}><X size={24}/></button>
              </div>
              <div className="modal-content">
                <input autoFocus type="text" placeholder="Titre de la tâche..." className="input-title" value={newTaskTitle} onChange={e=>setNewTaskTitle(e.target.value)} />
                <div className="row-inputs">
                  <div className="input-wrap">
                    <label>Heure</label>
                    <input type="time" value={newTaskTime} onChange={e=>setNewTaskTime(e.target.value)} />
                  </div>
                  <div className="input-wrap">
                    <label>Durée (min)</label>
                    <input type="number" value={newTaskDuration} onChange={e=>setNewTaskDuration(e.target.value)} />
                  </div>
                </div>
                <button className="btn-save" onClick={createEvent}>Ajouter</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;