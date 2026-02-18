/* global google */
import React, { useState, useEffect } from 'react';
import { gapi } from 'gapi-script';
import { Check, X } from 'lucide-react';
import './App.css';

// IMPORTS ARCHITECTURE
import MobileLayout from './layouts/MobileLayout';
import DesktopLayout from './layouts/DesktopLayout';

import TimelineView from './views/TimelineView';
import InboxView from './views/InboxView';
import SettingsView from './views/SettingsView'

import AddTaskModal from './components/shared/AddTaskModal';
import { getDailySummary } from './utils/weatherLogic';

const CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;
const API_KEY = process.env.REACT_APP_GOOGLE_API_KEY;
const WEATHER_KEY = process.env.REACT_APP_WEATHER_API_KEY;
const SCOPES = "https://www.googleapis.com/auth/calendar.events";
const DISCOVERY_DOC = "https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest";

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
  const [isDesktop, setIsDesktop] = useState(window.innerWidth > 768);
  
  // États Formulaire Ajout
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskTime, setNewTaskTime] = useState("12:00");
  const [newTaskDuration, setNewTaskDuration] = useState(60);
  const [tokenClient, setTokenClient] = useState(null);

  // --- EFFETS ---
  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth > 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    gapi.load("client", async () => {
      await gapi.client.init({ apiKey: API_KEY, discoveryDocs: [DISCOVERY_DOC] });
      setCompletedEvents(JSON.parse(localStorage.getItem('completed_tasks') || '{}'));
      const token = localStorage.getItem('g_token');
      const expiry = localStorage.getItem('g_expiry');
      if (token && expiry && Date.now() < parseInt(expiry)) {
        gapi.client.setToken({ access_token: token });
        setIsSignedIn(true);
        loadData();
      }
    });
    
    const initClient = () => {
      if (window.google && window.google.accounts) {
        setTokenClient(window.google.accounts.oauth2.initTokenClient({
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
        }));
      } else { setTimeout(initClient, 500); }
    };
    initClient();

    if (WEATHER_KEY) {
       navigator.geolocation.getCurrentPosition(async (pos) => {
          try {
            const res = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&units=metric&lang=fr&appid=${WEATHER_KEY}`);
            const data = await res.json();
            if (data.list) setForecast(data.list);
          } catch (e) {}
       });
    }

    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => { if (isSignedIn) fetchAllEvents(); }, [currentDate, selectedCalendarIds, isSignedIn]);

  // --- LOGIQUE API ---
  const loadData = async () => await loadCalendars();
  const loadCalendars = async () => { 
    try { 
      const r = await gapi.client.calendar.calendarList.list(); 
      setCalendars(r.result.items); 
      setSelectedCalendarIds(r.result.items.map(c => c.id));
    } catch(e){} 
  };

  const fetchAllEvents = async () => {
    if (selectedCalendarIds.length === 0) { setEvents([]); return; }
    setEvents([]); setIsLoading(true);
    try {
      const start = new Date(currentDate); start.setHours(0,0,0,0);
      const end = new Date(currentDate); end.setHours(23,59,59,999);
      const promises = selectedCalendarIds.map(async (calId) => {
        const r = await gapi.client.calendar.events.list({ 'calendarId': calId, 'timeMin': start.toISOString(), 'timeMax': end.toISOString(), 'singleEvents': true, 'orderBy': 'startTime' });
        const cal = calendars.find(c => c.id === calId);
        return r.result.items.map(e => ({ ...e, color: cal?.backgroundColor, calId: calId }));
      });
      const res = await Promise.all(promises);
      const unique = new Map(); res.flat().forEach(e => unique.set(e.id, e));
      setEvents(Array.from(unique.values()).sort((a,b) => new Date(a.start.dateTime) - new Date(b.start.dateTime)));
    } catch(e) { if(e.status===401) { setIsSignedIn(false); localStorage.clear(); } } finally { setIsLoading(false); }
  };

  const toggleTaskCompletion = (id) => { 
    const n = {...completedEvents, [id]:!completedEvents[id]}; 
    setCompletedEvents(n); localStorage.setItem('completed_tasks', JSON.stringify(n)); 
  };

  const createEvent = async () => { 
    if(!newTaskTitle) return; 
    try { 
      const [h,m] = newTaskTime.split(':'); 
      const s = new Date(currentDate); s.setHours(parseInt(h),parseInt(m),0); 
      const e = new Date(s.getTime()+newTaskDuration*60000); 
      await gapi.client.calendar.events.insert({calendarId:'primary', resource:{summary:newTaskTitle, start:{dateTime:s.toISOString()}, end:{dateTime:e.toISOString()}}}); 
      setShowAddModal(false); setNewTaskTitle(""); setTimeout(fetchAllEvents, 500); 
    } catch(e){ alert("Erreur création"); } 
  };

  const toggleCalendar = (id) => setSelectedCalendarIds(p => p.includes(id) ? p.filter(i=>i!==id) : [...p, id]);

  const todaySummary = getDailySummary(new Date(), forecast);

  // --- RENDU ---
  const renderView = () => {
    switch(activeTab) {
      case 'timeline': 
        return (
          <TimelineView 
            forecast={forecast}
            events={events} currentDate={currentDate} setCurrentDate={setCurrentDate}
            now={now} completedEvents={completedEvents} toggleTaskCompletion={toggleTaskCompletion}
            isSignedIn={isSignedIn} handleLogin={()=>tokenClient?.requestAccessToken()}
            isLoading={isLoading} todaySummary={todaySummary} calendars={calendars}
            showCalMenu={showCalMenu} setShowCalMenu={setShowCalMenu} setShowAddModal={setShowAddModal}
          />
        );
      case 'settings': 
        return (
          <SettingsView 
            calendars={calendars} 
            selectedCalendarIds={selectedCalendarIds}
            toggleCalendar={toggleCalendar}
            handleLogout={() => { localStorage.clear(); window.location.reload(); }}
          />);
      case 'inbox': return <InboxView />;
      case 'shopping': return <div><h1>Courses</h1></div>;
      default: return null;
    }
  };

  const Layout = isDesktop ? DesktopLayout : MobileLayout;

  return (
    <Layout 
      activeTab={activeTab} 
      setActiveTab={setActiveTab} 
      setShowAddModal={setShowAddModal}
      setShowCalMenu={setShowCalMenu}
      showCalMenu={showCalMenu}
    >
      {renderView()}

      {/* Modales globales */}
      {showAddModal && (
        <AddTaskModal 
          onClose={()=>setShowAddModal(false)}
          setCurrentDate={setCurrentDate}
          newTaskTitle={newTaskTitle} setNewTaskTitle={setNewTaskTitle}
          newTaskTime={newTaskTime} setNewTaskTime={setNewTaskTime}
          newTaskDuration={newTaskDuration} setNewTaskDuration={setNewTaskDuration}
          onAdd={createEvent}
        />
      )}

      {showCalMenu && (
        <div className="modal-backdrop" onClick={()=>setShowCalMenu(false)}>
          <div className="modal-sheet" onClick={e=>e.stopPropagation()}>
            <div className="modal-header"><h2>Calendriers</h2><button className="close-icon" onClick={()=>setShowCalMenu(false)}><X size={24}/></button></div>
            <div className="cal-list">{calendars.map(c=>(<div key={c.id} className="cal-item" onClick={()=>toggleCalendar(c.id)}><div className="dot-check" style={{background:c.backgroundColor}}>{selectedCalendarIds.includes(c.id)&&<Check size={12} color="white"/>}</div><span>{c.summary}</span></div>))}</div>
          </div>
        </div>
      )}
    </Layout>
  );
}

export default App;