/* global google */
import React, { useState, useEffect, useRef } from 'react';
import { gapi } from 'gapi-script';
import { 
  Settings, Check, Plus, Filter, X, 
  Cloud, Sun, CloudRain, Snowflake, CloudLightning, Wind, Umbrella, 
  Layout, Calendar as CalIcon, Inbox, Clock,
  Briefcase // Icône générique
} from 'lucide-react';
import { format, addDays, isSameDay, startOfWeek, parseISO, differenceInMinutes, startOfDay, endOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import './App.css';

const CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;
const API_KEY = process.env.REACT_APP_GOOGLE_API_KEY;
const WEATHER_KEY = process.env.REACT_APP_WEATHER_API_KEY;
const SCOPES = "https://www.googleapis.com/auth/calendar.events";
const DISCOVERY_DOC = "https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest";

const PX_PER_MIN = 1.3; 
const THRESHOLD_SHORT_EVENT = 50; 

function App() {
  const [events, setEvents] = useState([]);
  const [calendars, setCalendars] = useState([]);
  const [selectedCalendarIds, setSelectedCalendarIds] = useState([]); 
  const [completedEvents, setCompletedEvents] = useState({});
  const [forecast, setForecast] = useState([]);
  
  const [activeTab, setActiveTab] = useState('timeline');
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
  const nowRef = useRef(null);

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

  const loadData = async () => await loadCalendars();
  const loadCalendars = async () => { try { const r = await gapi.client.calendar.calendarList.list(); const items = r.result.items; setCalendars(items); const allIds = items.map(c => c.id); setSelectedCalendarIds(allIds); } catch(e){} };

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

  const processTimeline = () => {
    if (!events || events.length === 0) return [];
    const timelineItems = [];
    const dayStart = startOfDay(currentDate);
    const dayEnd = endOfDay(currentDate);
    let lastTime = dayStart;

    events.forEach((event) => {
      if (!event.start.dateTime) return;
      const start = parseISO(event.start.dateTime);
      const end = parseISO(event.end.dateTime);
      const gapDuration = differenceInMinutes(start, lastTime);
      if (gapDuration > 0) {
        timelineItems.push({ type: 'gap', start: lastTime, end: start, duration: gapDuration, height: gapDuration * PX_PER_MIN });
      }
      const eventDuration = differenceInMinutes(end, start);
      timelineItems.push({ type: 'event', data: event, duration: eventDuration, height: eventDuration * PX_PER_MIN });
      lastTime = end;
    });

    const endGap = differenceInMinutes(dayEnd, lastTime);
    if (endGap > 0) { timelineItems.push({ type: 'gap', start: lastTime, end: dayEnd, duration: endGap, height: endGap * PX_PER_MIN }); }
    return timelineItems;
  };

  const formatDuration = (mins) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0 && m > 0) return `${h}h ${m}min`;
    if (h > 0) return `${h}h`;
    return `${m} min`;
  };

  const handleLogin = () => tokenClient?.requestAccessToken();
  const toggleCalendar = (id) => setSelectedCalendarIds(p => p.includes(id) ? p.filter(i=>i!==id) : [...p, id]);
  const toggleTaskCompletion = (id) => { const n = {...completedEvents, [id]:!completedEvents[id]}; setCompletedEvents(n); localStorage.setItem('completed_tasks', JSON.stringify(n)); };
  const createEvent = async () => { if(!newTaskTitle)return; try { const [h,m] = newTaskTime.split(':'); const s = new Date(currentDate); s.setHours(parseInt(h),parseInt(m),0); const e = new Date(s.getTime()+newTaskDuration*60000); await gapi.client.calendar.events.insert({calendarId:'primary', resource:{summary:newTaskTitle, start:{dateTime:s.toISOString()}, end:{dateTime:e.toISOString()}}}); setShowAddModal(false); setNewTaskTitle(""); setTimeout(()=>fetchAllEvents(),500); } catch(e){alert("Erreur");} };

  const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(startOfWeek(currentDate, { weekStartsOn: 1 }), i));
  const todaySummary = getDailySummary(new Date());
  const timelineData = processTimeline();

  return (
    <div className="layout-wrapper">
      <nav className="desktop-sidebar">
        <div className="sidebar-logo">S</div>
        <div className="sidebar-menu">
          <button className={`sidebar-btn ${activeTab==='timeline'?'active':''}`} onClick={()=>setActiveTab('timeline')}><Layout size={20} /> Timeline</button>
          <button className={`sidebar-btn ${activeTab==='inbox'?'active':''}`} onClick={()=>setActiveTab('inbox')}><Inbox size={20} /> Inbox</button>
          <button className={`sidebar-btn ${activeTab==='calendar'?'active':''}`} onClick={()=>setActiveTab('calendar')}><CalIcon size={20} /> Calendrier</button>
        </div>
        <div className="sidebar-bottom"><button className="sidebar-btn"><Settings size={20} /></button></div>
      </nav>

      <div className="app-container">
        <header className="app-header">
          <div className="header-top">
            <div className="date-block">
               <h1 onClick={() => setCurrentDate(new Date())}>{format(currentDate, 'MMMM yyyy', { locale: fr })}</h1>
               {todaySummary && (
                 <div className="weather-pill">
                   {getWeatherIcon(todaySummary.weather[0].id, 14)}
                   <span>{Math.round(todaySummary.temp)}°</span>
                 </div>
               )}
            </div>
            <div className="header-actions">
               <div className="desktop-only-actions">
                  <div className="cal-filter-wrapper">
                     <button className="icon-btn" onClick={()=>setShowCalMenu(!showCalMenu)}><Filter size={18}/></button>
                     {showCalMenu && <div className="dropdown-menu">{calendars.map(c=>(<div key={c.id} className="dropdown-item" onClick={()=>toggleCalendar(c.id)}><div className="dot-check" style={{background:c.backgroundColor}}>{selectedCalendarIds.includes(c.id)&&<Check size={12} color="white"/>}</div><span>{c.summaryOverride||c.summary}</span></div>))}</div>}
                  </div>
                  <button className="desktop-add-btn" onClick={()=>setShowAddModal(true)}><Plus size={16} /> Ajouter</button>
               </div>
               {!isSignedIn && <button onClick={handleLogin} className="login-btn-small">Login</button>}
            </div>
          </div>

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
                       <div className="day-weather rain" style={{color: rainChance > 50 ? '#FF3B30' : '#007AFF'}}><Umbrella size={10} strokeWidth={3} /></div>
                    ) : (
                       summary && <div className="day-weather">{getWeatherIcon(summary.weather[0].id, 10)}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </header>

        <main className="timeline-area" onClick={()=>setShowCalMenu(false)}>
           {isSignedIn ? (
             <div className="timeline-content">
               {isLoading && <div className="loader"><div className="spinner"></div></div>}
               {isSameDay(currentDate, new Date()) && !isLoading && <div className="now-indicator-line" style={{display: 'none'}}></div>}
               
               {!isLoading && timelineData.length > 0 ? timelineData.map((item, i) => {
                 
                 // --- GAPS ---
                 if (item.type === 'gap') {
                   const showLabel = item.duration >= 15;
                   const gapHeight = Math.max(item.height, 20); 
                   return (
                     <div key={`gap-${i}`} className="timeline-gap" style={{ height: `${gapHeight}px` }}>
                       <div className="gap-line"></div>
                       {showLabel && (
                         <div className="gap-label"><span className="gap-dots">•••</span><span>{formatDuration(item.duration)} de libre</span></div>
                       )}
                     </div>
                   );
                 }

                 // --- ÉVÉNEMENTS ---
                 const e = item.data;
                 const start = parseISO(e.start.dateTime);
                 const end = parseISO(e.end.dateTime);
                 const color = e.color || '#34C759'; 
                 const checked = completedEvents[e.id];
                 const {status, progress} = getEventStatus(e); 
                 const isCur = status === 'current';
                 const isShort = item.duration <= THRESHOLD_SHORT_EVENT;
                 const visualHeight = isShort ? 50 : Math.max(item.height, 50);

                 // Calcul du STYLE pour la pilule
                // Calcul du STYLE pour la pilule
                let pillStyle = {};
                 
                if (status === 'past' || checked) {
                   // Passé : Gris
                   pillStyle = { backgroundColor: '#E5E5EA', boxShadow: 'none' };
                  } else if (isCur && !isShort) {
                    // TACHE EN COURS (EFFET FONDU)
                    // On garde la couleur unie jusqu'à un peu avant l'heure actuelle (progress - 15%)
                    // Et on finit le fondu vers le blanc un peu après (progress + 5%)
                    const fadeStart = Math.max(0, progress - 15);
                    const fadeEnd = Math.min(100, progress + 5);

                    pillStyle = { 
                       background: `linear-gradient(to bottom, 
                          ${color} 0%, 
                          ${color} ${fadeStart}%, 
                          #FFFFFF ${fadeEnd}%
                       )`,
                       boxShadow: `0 4px 15px ${color}40`,
                       border: `2px solid ${color}`
                    };
                 } else {
                   // Futur : Tout blanc avec bordure colorée (ou plein selon tes goûts)
                   // Si tu veux que le futur soit "vide" en attendant d'arriver :
                   pillStyle = { 
                       backgroundColor: '#FFFFFF', // Fond blanc
                       border: `2px solid ${color}`, // Bordure couleur
                       boxShadow: `0 4px 10px ${color}20`
                   };
                   
              
                }

                 return (
                   <div key={e.id} className={`timeline-row ${checked||status==='past'?'past':''} ${isCur?'current':''}`} style={{ height: `${visualHeight}px`, minHeight: `${visualHeight}px` }}>
                      
                      <div className="time-column">
                        <span className="time-start">{format(start, 'HH:mm')}</span>
                        {!isShort && <span className="time-end">{format(end, 'HH:mm')}</span>}
                      </div>
                      
                      <div className="visual-column">
                        <div className="line full-height"></div>
                        
                        <div className={`shape ${isShort ? 'circle' : 'pill-strip'}`} style={pillStyle}>
                           {checked ? <Check size={14} color="white"/> : <Briefcase size={16} color="white" strokeWidth={2.5} />}
                        </div>
                      </div>
                      
                      <div className="card-column">
                        <div className="event-card-transparent" onClick={()=>toggleTaskCompletion(e.id)}>
                          <div className="card-text">
                             {/* Petite info durée restante si en cours */}
                             {isCur && <span className="status-label">{Math.round(100-progress)}% restant</span>}
                             
                             <h3 style={{ textDecoration: checked ? 'line-through' : 'none', color: checked ? '#8E8E93' : '#1C1C1E' }}>
                               {e.summary}
                             </h3>
                             {e.location && !isShort && <p className="location">{e.location}</p>}
                          </div>
                          
                          <div className={`check-circle-outline ${checked ? 'checked' : ''}`} style={{borderColor: checked ? color : '#E5E5EA'}}></div>
                        </div>
                      </div>
                   </div>
                 );
               }) : (!isLoading && <div className="empty-state"><p>Rien de prévu ✨</p></div>)}
               
               <div className="spacer-bottom"></div>
             </div>
           ) : (
             <div className="login-screen"><h1>Bienvenue</h1><p>Connectez votre calendrier.</p><button onClick={handleLogin} className="login-btn-large">Connexion Google</button></div>
           )}
        </main>

        {isSignedIn && (
          <nav className="mobile-bottom-nav">
             <button className={`nav-item ${activeTab==='inbox'?'active':''}`} onClick={()=>setActiveTab('inbox')}><Inbox size={24} /><span>Inbox</span></button>
             <button className={`nav-item ${activeTab==='timeline'?'active':''}`} onClick={()=>setActiveTab('timeline')}><Layout size={24} /><span>Timeline</span></button>
             <div className="nav-add-container"><button className="nav-add-btn" onClick={()=>setShowAddModal(true)}><Plus size={28} color="white" /></button></div>
             <button className={`nav-item ${activeTab==='calendar'?'active':''}`} onClick={()=>setActiveTab('calendar')}><CalIcon size={24} /><span>Agenda</span></button>
             <button className="nav-item" onClick={()=>setShowCalMenu(!showCalMenu)}><Filter size={24} /><span>Filtres</span></button>
          </nav>
        )}
        
        {/* Modals inchangées */}
        {showCalMenu && <div className="modal-backdrop" onClick={()=>setShowCalMenu(false)}><div className="modal-sheet" onClick={e=>e.stopPropagation()}><div className="modal-header"><h2>Calendriers</h2><button className="close-icon" onClick={()=>setShowCalMenu(false)}><X size={24}/></button></div><div className="cal-list">{calendars.map(c=>(<div key={c.id} className="cal-item" onClick={()=>toggleCalendar(c.id)}><div className="dot-check" style={{background:c.backgroundColor}}>{selectedCalendarIds.includes(c.id)&&<Check size={12} color="white"/>}</div><span>{c.summary}</span></div>))}</div></div></div>}
        {showAddModal && <div className="modal-backdrop" onClick={()=>setShowAddModal(false)}><div className="modal-sheet" onClick={e=>e.stopPropagation()}><div className="modal-header"><h2>Nouvelle tâche</h2><button className="close-icon" onClick={()=>setShowAddModal(false)}><X size={20}/></button></div><div className="modal-content"><input type="text" placeholder="Titre..." className="input-title" value={newTaskTitle} onChange={e=>setNewTaskTitle(e.target.value)} /><div className="row-inputs"><div className="input-wrap"><label>Heure</label><input type="time" value={newTaskTime} onChange={e=>setNewTaskTime(e.target.value)} /></div><div className="input-wrap"><label>Durée (min)</label><input type="number" value={newTaskDuration} onChange={e=>setNewTaskDuration(e.target.value)} /></div></div><button className="btn-save" onClick={createEvent}>Ajouter</button></div></div></div>}
      </div>
    </div>
  );
}

export default App;