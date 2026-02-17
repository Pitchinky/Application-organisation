/* global google */
import React, { useState, useEffect } from 'react';
import { gapi } from 'gapi-script';
import { 
  Settings, ChevronLeft, ChevronRight, Check, Circle, 
  Menu, Plus, Clock, Filter, X, 
  Cloud, Sun, CloudRain, Snowflake, CloudLightning, Wind, Umbrella 
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
  // --- ÉTATS ---
  const [events, setEvents] = useState([]);
  const [calendars, setCalendars] = useState([]);
  const [selectedCalendarIds, setSelectedCalendarIds] = useState(['primary']);
  const [completedEvents, setCompletedEvents] = useState({});
  const [forecast, setForecast] = useState([]); // Liste des prévisions 5 jours
  
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
    const initClient = () => {
      if (window.google && window.google.accounts) {
        const client = window.google.accounts.oauth2.initTokenClient({
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
      } else { setTimeout(initClient, 500); }
    };
    initClient();
  }, []);

  // 3. Charger les Prévisions Météo (Forecast 5 jours / 3h)
  useEffect(() => {
    if (!WEATHER_KEY) return;
    navigator.geolocation.getCurrentPosition(async (position) => {
      try {
        const { latitude, longitude } = position.coords;
        const res = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${latitude}&lon=${longitude}&units=metric&lang=fr&appid=${WEATHER_KEY}`);
        const data = await res.json();
        if (data.list) setForecast(data.list);
      } catch (error) { console.error("Erreur Météo", error); }
    });
  }, []);

  // Timer minuteur
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Chargement events au changement de date
  useEffect(() => {
    if (isSignedIn) fetchAllEvents();
  }, [currentDate, selectedCalendarIds, isSignedIn]);

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

  // --- LOGIQUE MÉTÉO INTELLIGENTE ---
  // Analyse toute la journée pour trouver le pire scénario (pluie max)
  const getDailySummary = (date) => {
    if (forecast.length === 0) return null;
    const dateStr = format(date, 'yyyy-MM-dd');
    
    // 1. Tous les créneaux de cette journée
    const daySlots = forecast.filter(item => item.dt_txt.includes(dateStr));
    if (daySlots.length === 0) return null;

    // 2. Risque max de pluie sur la journée (0 à 1)
    const maxPop = Math.max(...daySlots.map(slot => slot.pop));

    // 3. Icône la plus "grave" (Pluie/Orage > Nuage > Soleil)
    const worstSlot = daySlots.find(slot => slot.weather[0].id < 700) 
                   || daySlots.find(slot => slot.weather[0].id < 800) 
                   || daySlots[Math.floor(daySlots.length / 2)];

    return {
      pop: maxPop,
      weather: worstSlot.weather,
      temp: daySlots[Math.floor(daySlots.length / 2)].main.temp // Température moyenne (midi)
    };
  };

  const getWeatherIcon = (code, size=16) => {
    if (code >= 200 && code < 300) return <CloudLightning size={size} />;
    if (code >= 300 && code < 600) return <CloudRain size={size} />;
    if (code >= 600 && code < 700) return <Snowflake size={size} />;
    if (code === 800) return <Sun size={size} />;
    if (code > 800) return <Cloud size={size} />;
    return <Wind size={size} />;
  };

  // --- HELPERS ---
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

  // Météo Header : Aujourd'hui (résumé)
  const todaySummary = getDailySummary(new Date());

  return (
    <div className="structured-web-layout">
      {/* HEADER */}
      <header className="main-header">
        <div className="header-left">
          <div className="date-title">
            <h1 className="month-title">{format(currentDate, 'MMMM yyyy', { locale: fr })}</h1>
            
            {/* WIDGET MÉTÉO HEADER */}
            {todaySummary && (
              <div className="weather-badge">
                {getWeatherIcon(todaySummary.weather[0].id)}
                <span className="weather-temp">{Math.round(todaySummary.temp)}°</span>
              </div>
            )}
            
            <div className="nav-arrows">
              <button onClick={() => setCurrentDate(subDays(currentDate, 1))}><ChevronLeft size={16}/></button>
              <button onClick={() => setCurrentDate(addDays(currentDate, 1))}><ChevronRight size={16}/></button>
              <button onClick={() => setCurrentDate(new Date())} className="today-btn">Auj.</button>
            </div>
          </div>
        </div>
        <div className="header-right">
          <div className="relative-container">
            <button className={`view-btn ${showCalMenu?'active':''}`} onClick={()=>setShowCalMenu(!showCalMenu)}><Filter size={14}/> Agendas</button>
            {showCalMenu && <div className="dropdown-menu">{calendars.map(c=>(<div key={c.id} className="dropdown-item" onClick={()=>toggleCalendar(c.id)}><div className="dot-check" style={{background:c.backgroundColor}}>{selectedCalendarIds.includes(c.id)&&<Check size={12} color="white"/>}</div><span>{c.summaryOverride||c.summary}</span></div>))}</div>}
          </div>
          {!isSignedIn && <button onClick={handleLogin} className="login-btn">Connexion</button>}
        </div>
      </header>

      {/* DAY STRIP (Avec Risque Pluie Global) */}
      <div className="day-strip">
        {weekDays.map((day, i) => {
          const isSelected = isSameDay(day, currentDate);
          const isToday = isSameDay(day, new Date());
          const summary = getDailySummary(day);
          const rainChance = summary ? Math.round(summary.pop * 100) : 0;

          return (
            <div key={i} className={`day-cell ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`} onClick={() => setCurrentDate(day)}>
              <span className="day-name">{format(day, 'EEE', { locale: fr })}</span>
              <span className="day-num">{format(day, 'd')}</span>
              
              {/* INDICATEUR PLUIE */}
              {summary && (
                <div className="day-weather-info">
                   {/* Si risque > 20% sur la journée, on affiche le parapluie */}
                   {rainChance >= 20 ? (
                     <div className="rain-indicator" style={{
                        color: rainChance > 60 ? '#FF3B30' : '#007AFF', // Rouge si fort risque
                        background: rainChance > 60 ? 'rgba(255, 59, 48, 0.1)' : 'rgba(0, 122, 255, 0.1)'
                     }}>
                       <Umbrella size={10} color="currentColor" />
                       <span>{rainChance}%</span>
                     </div>
                   ) : (
                     <div className="weather-icon-mini">
                       {getWeatherIcon(summary.weather[0].id, 12)}
                     </div>
                   )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* TIMELINE */}
      <div className="timeline-scroll-area" onClick={()=>setShowCalMenu(false)}>
        <div className="timeline-container">
          {isSignedIn ? (
            <>
              {isLoading && <div className="loading-spinner-container"><div className="spinner"></div></div>}
              {!isLoading && events.length>0 ? events.map(e => {
                 const isAllDay=!e.start.dateTime; const start=isAllDay?null:parseISO(e.start.dateTime); const end=isAllDay?null:parseISO(e.end.dateTime);
                 const color=e.color||'#34C759'; const checked=completedEvents[e.id];
                 const {status,progress}=isAllDay?{status:'future',progress:0}:getEventStatus(e); const isCur=status==='current';
                 return (
                  <div key={e.id} className={`timeline-row ${checked||status==='past'?'dimmed':''}`}>
                    <div className="time-col"><span className="time-text">{start?format(start,'HH:mm'):'Jour'}</span>{start&&<span className="time-sub">{format(end,'HH:mm')}</span>}</div>
                    <div className="visual-col">
                      <div className="vertical-line"></div>
                      <div className={`capsule-pill ${isCur?'active-pulse':''}`} style={{background:isCur?`linear-gradient(to bottom, ${color} ${progress}%, #F2F2F7 ${progress}%)`:(status==='past'||checked?'#E5E5EA':'#F2F2F7'), border:`2px solid ${status==='past'?'#E5E5EA':color}`, color:isCur&&progress>50?'white':color}}>
                        {checked?<Check size={14} color={status==='past'?"#999":color}/>:isCur?<Clock size={14} color="inherit"/>:<div className="bullet-dot" style={{background:color}}></div>}
                      </div>
                    </div>
                    <div className="card-col">
                      <div className="structured-card">
                        <div className="card-content">
                          <h3 className="event-title" style={{textDecoration:checked?'line-through':'none'}}>{e.summary}</h3>
                          <span className="event-range">{start&&end?`${differenceInMinutes(end,start)} min`:'Toute la journée'}</span>
                        </div>
                        <div className="card-actions"><button className="check-btn" onClick={()=>toggleTaskCompletion(e.id)}>{checked?<div className="checked-circle"><Check size={14} color="white"/></div>:<Circle size={24} color="#E5E5EA" strokeWidth={2}/>}</button></div>
                      </div>
                    </div>
                  </div>
                 );
              }) : (!isLoading && <div className="empty-state"><p>Rien de prévu 🎉</p></div>)}
            </>
          ) : <div className="welcome-box"><button onClick={handleLogin} className="primary-btn">Synchroniser Google</button></div>}
          <div style={{height:'100px'}}></div>
        </div>
      </div>
      
      {/* MODAL & FAB */}
      {isSignedIn&&<button className="fab-btn" onClick={()=>setShowAddModal(true)}><Plus size={28} color="white"/></button>}
      {showAddModal && <div className="modal-overlay"><div className="modal-card"><div className="modal-header"><h2>Nouvelle Tâche</h2><button className="close-btn" onClick={()=>setShowAddModal(false)}><X size={20}/></button></div><div className="modal-body"><input className="task-input" value={newTaskTitle} onChange={e=>setNewTaskTitle(e.target.value)} placeholder="Titre..." autoFocus/><div className="time-inputs"><div className="input-group"><label>Heure</label><input type="time" value={newTaskTime} onChange={e=>setNewTaskTime(e.target.value)}/></div><div className="input-group"><label>Durée</label><input type="number" value={newTaskDuration} onChange={e=>setNewTaskDuration(e.target.value)}/></div></div></div><div className="modal-footer"><button className="save-btn" onClick={createEvent}>Créer</button></div></div></div>}
    </div>
  );
}

export default App;