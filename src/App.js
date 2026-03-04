/* global google */
import React, { useState, useEffect } from 'react';
import { gapi } from 'gapi-script';
import { Check, X } from 'lucide-react';
import './App.css';
import { format } from 'date-fns';

// IMPORTS ARCHITECTURE
import MobileLayout from './layouts/MobileLayout';
import DesktopLayout from './layouts/DesktopLayout';
import TimelineView from './views/TimelineView';
import ListsView from './views/ListsView';
import InboxView from './views/InboxView';
import SettingsView from './views/SettingsView'

// COMPOSANTS PARTAGÉS
import AddTaskModal from './components/shared/AddTaskModal';
import RecurringChoiceModal from './components/shared/RecurringChoiceModal';
import DeleteModal from './components/shared/DeleteModal';
import { getDailySummary } from './utils/weatherLogic';

// FIREBASE
import { db, auth } from './firebaseConfig'; // AJOUT : import de auth
import { doc, setDoc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { requestForToken, onMessageListener } from './firebaseConfig';

const CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;
const API_KEY = process.env.REACT_APP_GOOGLE_API_KEY;
const WEATHER_KEY = process.env.REACT_APP_WEATHER_API_KEY;
const SCOPES = "https://www.googleapis.com/auth/calendar.events";
const DISCOVERY_DOC = "https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest";

function App() {
  // --- ÉTATS ---
  const [events, setEvents] = useState([]);
  const [calendars, setCalendars] = useState([]);
  const [selectedCalendarIds, setSelectedCalendarIds] = useState([]); 
  const [completedEvents, setCompletedEvents] = useState({});
  const [forecast, setForecast] = useState([]);
  const [activeTab, setActiveTab] = useState('timeline');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [now, setNow] = useState(new Date()); 
  const [isSignedIn, setIsSignedIn] = useState(localStorage.getItem('isLoggedIn') === 'true');
  const [isLoading, setIsLoading] = useState(false);
  const [showCalMenu, setShowCalMenu] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth > 768);
  
  // États Formulaire Ajout
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskTime, setNewTaskTime] = useState("12:00");
  const [newTaskDuration, setNewTaskDuration] = useState(60);
  const [tokenClient, setTokenClient] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);

  // ÉTAT POPUPS
  const [recModal, setRecModal] = useState({ isOpen: false, type: 'edit', data: null });
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, event: null });

  // --- INITIALISATION ---
  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth > 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // INITIALISATION GAPI ET TOKEN CLIENT (Modifié pour la persistance)
  useEffect(() => {
    const startGapi = async () => {
      await gapi.load("client", async () => {
        await gapi.client.init({ apiKey: API_KEY, discoveryDocs: [DISCOVERY_DOC] });
        
        // On vérifie d'abord le local
        let token = localStorage.getItem('g_token');
        let expiry = localStorage.getItem('g_expiry');
        
        // Si rien en local, on attend que Firebase Auth prenne le relais (voir useEffect plus bas)
        if (token && expiry && Date.now() < parseInt(expiry)) {
          gapi.client.setToken({ access_token: token });
          setIsSignedIn(true);
          loadData();
        }
      });
    };
    startGapi();

    const initIdentityServices = () => {
      if (window.google && window.google.accounts) {
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPES,
          callback: async (resp) => {
            if (resp.access_token) {
              const expiresIn = (resp.expires_in || 3599) * 1000;
              const expiryDate = Date.now() + expiresIn;

              localStorage.setItem('g_token', resp.access_token);
              localStorage.setItem('g_expiry', expiryDate);
              localStorage.setItem('isLoggedIn', 'true');

              // SAUVEGARDE DANS FIRESTORE pour la persistance longue durée
              if (auth.currentUser) {
                await setDoc(doc(db, "user_sessions", auth.currentUser.uid), {
                  g_token: resp.access_token,
                  g_expiry: expiryDate
                }, { merge: true });
              }

              gapi.client.setToken({ access_token: resp.access_token });
              setIsSignedIn(true);
              loadData();
            }
          },
        });
        setTokenClient(client);
      } else { 
        setTimeout(initIdentityServices, 500); 
      }
    };
    initIdentityServices();

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

  // NOUVEAU : SYNC AVEC FIREBASE AUTH (Pour récupérer le token sur iPhone)
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user && !isSignedIn) {
        const userDoc = await getDoc(doc(db, "user_sessions", user.uid));
        if (userDoc.exists()) {
          const { g_token, g_expiry } = userDoc.data();
          if (Date.now() < g_expiry) {
            localStorage.setItem('g_token', g_token);
            localStorage.setItem('g_expiry', g_expiry);
            localStorage.setItem('isLoggedIn', 'true');
            gapi.client.setToken({ access_token: g_token });
            setIsSignedIn(true);
            loadData();
          } else if (tokenClient) {
            tokenClient.requestAccessToken({ prompt: 'none' });
          }
        }
      }
    });
    return () => unsubscribe();
  }, [tokenClient, isSignedIn]);

  // NOUVEAU : GESTION DU REVEIL IPHONE (Quand on revient sur l'app)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isSignedIn && tokenClient) {
        const expiry = localStorage.getItem('g_expiry');
        if (expiry && Date.now() > parseInt(expiry) - 300000) { // 5 min avant fin
          tokenClient.requestAccessToken({ prompt: 'none' });
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [isSignedIn, tokenClient]);

  // RAFRAÎCHISSEMENT SILENCIEUX
  useEffect(() => {
    const checkAndRefreshToken = () => {
      const token = localStorage.getItem('g_token');
      const expiry = localStorage.getItem('g_expiry');
      if (token && expiry && tokenClient) {
        if (parseInt(expiry) - Date.now() < 600000) {
          tokenClient.requestAccessToken({ prompt: 'none' });
        }
      }
    };
    const interval = setInterval(checkAndRefreshToken, 60000);
    return () => clearInterval(interval);
  }, [tokenClient]);

  useEffect(() => { if (isSignedIn) fetchAllEvents(); }, [currentDate, selectedCalendarIds, isSignedIn]);

  // --- LOGIQUE API ---
  const loadData = async () => {
    try { 
      const r = await gapi.client.calendar.calendarList.list(); 
      setCalendars(r.result.items); 
      setSelectedCalendarIds(r.result.items.map(c => c.id));
    } catch(e) {
      if (e.status === 401) setIsSignedIn(false);
    } 
  };

  const fetchAllEvents = async () => {
    if (selectedCalendarIds.length === 0) { setEvents([]); return; }
    setIsLoading(true);
    try {
      const start = new Date(currentDate); start.setHours(0,0,0,0);
      const end = new Date(currentDate); end.setHours(23,59,59,999);
      const promises = selectedCalendarIds.map(async (calId) => {
        const r = await gapi.client.calendar.events.list({ 'calendarId': calId, 'timeMin': start.toISOString(), 'timeMax': end.toISOString(), 'singleEvents': true, 'orderBy': 'startTime' });
        const cal = calendars.find(c => c.id === calId);
        if (!r.result.items) return [];
        return await Promise.all(r.result.items.map(async (event) => {
          const docSnap = await getDoc(doc(db, "task_details", event.id));
          return { ...event, color: cal?.backgroundColor, calId: calId, subtasks: docSnap.exists() ? docSnap.data().subtasks : [] };
        }));
      });
      const res = await Promise.all(promises);
      setEvents(res.flat().sort((a, b) => new Date(a.start.dateTime || a.start.date) - new Date(b.start.dateTime || b.start.date)));
    } catch(e) {
      if (e.status === 401) {
        setIsSignedIn(false);
        localStorage.removeItem('isLoggedIn');
      }
    } finally { setIsLoading(false); }
  };

  // --- ACTIONS ---
  const handleToggleSubtask = async (eventId, subtasksArray, subtaskId) => {
    if (!subtasksArray) return;
    const newSubtasks = subtasksArray.map(sub => {
      if (sub.id === subtaskId) return { ...sub, completed: !sub.completed };
      return sub;
    });
    setEvents(prev => prev.map(ev => ev.id === eventId ? { ...ev, subtasks: newSubtasks } : ev));
    try {
      await updateDoc(doc(db, "task_details", eventId), { subtasks: newSubtasks });
    } catch (e) {}
  };

  const handleSaveRequest = (data) => {
    if (editingEvent?.recurringEventId) setRecModal({ isOpen: true, type: 'edit', data: data });
    else createEvent(data, 'this');
  };

  const handleDeleteRequest = (eventOrId) => {
    const event = typeof eventOrId === 'string' ? events.find(e => e.id === eventOrId) : eventOrId;
    if (!event) return;
    if (event.recurringEventId) setRecModal({ isOpen: true, type: 'delete', data: event });
    else setDeleteModal({ isOpen: true, event: event });
  };

  const createEvent = async (taskData, modType = 'this') => {
    try {
      let resource = {
        summary: taskData.title,
        recurrence: taskData.repeat && taskData.repeat !== 'none' ? [`RRULE:FREQ=${taskData.repeat.toUpperCase()}`] : []
      };
      if (taskData.allDay) {
        const ds = format(taskData.date, 'yyyy-MM-dd');
        resource.start = { date: ds }; resource.end = { date: ds };
      } else {
        const [h, m] = taskData.time.split(':');
        const s = new Date(taskData.date); s.setHours(parseInt(h), parseInt(m), 0);
        const e = new Date(s.getTime() + taskData.duration * 60000);
        resource.start = { dateTime: s.toISOString() }; resource.end = { dateTime: e.toISOString() };
      }

      let googleId;
      if (editingEvent) {
        const res = await gapi.client.calendar.events.patch({
          calendarId: editingEvent.calId || 'primary',
          eventId: (modType === 'all') ? editingEvent.recurringEventId : editingEvent.id,
          resource: resource
        });
        googleId = res.result.id;
      } else {
        const res = await gapi.client.calendar.events.insert({ calendarId: 'primary', resource: resource });
        googleId = res.result.id;
      }
      await setDoc(doc(db, "task_details", String(googleId)), { subtasks: taskData.subtasks || [] }, { merge: true });
      closeAddModal(); fetchAllEvents();
    } catch (e) { 
      if (e.status === 401) setIsSignedIn(false);
    }
  };

  const deleteSingleEvent = async (id, modType = 'this') => {
    try {
      const event = events.find(e => e.id === id);
      if (!event) return;
      const targetId = (modType === 'all' && event.recurringEventId) ? event.recurringEventId : id;
      await gapi.client.calendar.events.delete({ calendarId: event.calId || 'primary', eventId: targetId });
      await deleteDoc(doc(db, "task_details", id));
      fetchAllEvents();
    } catch (e) { 
      if (e.status === 401) setIsSignedIn(false);
    }
  };

  // --- UI UTILS ---
  const handleEditEvent = (event) => {
    if (event.isNewFromGap) {
      setEditingEvent(null); setNewTaskTitle(""); setNewTaskTime(event.startTime); setNewTaskDuration(event.gapDuration);
    } else {
      setEditingEvent(event); setNewTaskTitle(event.summary);
      const st = new Date(event.start.dateTime || event.start.date);
      setNewTaskTime(format(st, 'HH:mm'));
      setNewTaskDuration(Math.round((new Date(event.end.dateTime || event.end.date) - st) / 60000));
    }
    setShowAddModal(true);
  };

  const closeAddModal = () => { setShowAddModal(false); setEditingEvent(null); setNewTaskTitle(""); };
  const toggleTaskCompletion = (id) => { 
    const n = {...completedEvents, [id]:!completedEvents[id]}; 
    setCompletedEvents(n); localStorage.setItem('completed_tasks', JSON.stringify(n)); 
  };

  const todaySummary = getDailySummary(new Date(), forecast);
  const Layout = isDesktop ? DesktopLayout : MobileLayout;

  return (
    <>
      <Layout activeTab={activeTab} setActiveTab={setActiveTab} setShowAddModal={setShowAddModal} setShowCalMenu={setShowCalMenu} showCalMenu={showCalMenu}>
        {activeTab === 'timeline' ? (
          <TimelineView 
            forecast={forecast} events={events.filter(e => e.start?.dateTime)} currentDate={currentDate} setCurrentDate={setCurrentDate}
            now={now} completedEvents={completedEvents} toggleTaskCompletion={toggleTaskCompletion} 
            onToggleSubtask={handleToggleSubtask}
            isSignedIn={isSignedIn} handleLogin={()=>tokenClient?.requestAccessToken({ prompt: 'select_account' })} isLoading={isLoading} todaySummary={todaySummary} 
            calendars={calendars} showCalMenu={showCalMenu} setShowCalMenu={setShowCalMenu} setShowAddModal={setShowAddModal} 
            onDeleteEvent={handleDeleteRequest} onEditEvent={handleEditEvent} allDayEvents={events.filter(e => !e.start?.dateTime)} 
          />
        ) : activeTab === 'inbox' ? (
          <InboxView onPlanTask={(title) => { setNewTaskTitle(title); setShowAddModal(true); }} />
        ) : activeTab === 'lists' ? (
          <ListsView />
        ) : activeTab === 'settings' ? (
          <SettingsView calendars={calendars} selectedCalendarIds={selectedCalendarIds} toggleCalendar={(id)=>setSelectedCalendarIds(p=>p.includes(id)?p.filter(i=>i!==id):[...p,id])} handleLogout={()=>{localStorage.clear();window.location.reload();}} />
        ) : null}
      </Layout>

      {showAddModal && (
        <AddTaskModal onClose={closeAddModal} currentDate={currentDate} newTaskTitle={newTaskTitle} setNewTaskTitle={setNewTaskTitle} newTaskTime={newTaskTime} setNewTaskTime={setNewTaskTime} newTaskDuration={newTaskDuration} setNewTaskDuration={setNewTaskDuration} onAdd={handleSaveRequest} editingEvent={editingEvent} />
      )}

      <RecurringChoiceModal 
        isOpen={recModal.isOpen} actionType={recModal.type}
        onClose={() => setRecModal({ ...recModal, isOpen: false })}
        onSelect={(choice) => {
          if (recModal.type === 'edit') createEvent(recModal.data, choice);
          else deleteSingleEvent(recModal.data.id, choice);
          setRecModal({ ...recModal, isOpen: false });
        }}
      />

      <DeleteModal 
        isOpen={deleteModal.isOpen} taskTitle={deleteModal.event?.summary || ""}
        onClose={() => setDeleteModal({ isOpen: false, event: null })}
        onConfirm={() => {
          deleteSingleEvent(deleteModal.event.id, 'this');
          setDeleteModal({ isOpen: false, event: null });
        }}
      />

      {showCalMenu && (
        <div className="modal-backdrop" onClick={()=>setShowCalMenu(false)}>
          <div className="modal-sheet" onClick={e=>e.stopPropagation()}>
            <div className="modal-header"><h2>Calendriers</h2><button className="close-icon" onClick={()=>setShowCalMenu(false)}><X size={24}/></button></div>
            <div className="cal-list">
              {calendars.map(c => (
                <div key={c.id} className="cal-item" onClick={() => setSelectedCalendarIds(p => p.includes(c.id) ? p.filter(i => i !== c.id) : [...p, c.id])}>
                  <div className="dot-check" style={{background: c.backgroundColor}}>{selectedCalendarIds.includes(c.id) && <Check size={12} color="white"/>}</div>
                  <span>{c.summary}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default App;