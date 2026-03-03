/* global google */
import React, { useState, useEffect, useCallback } from 'react';
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
import SettingsView from './views/SettingsView';

// COMPOSANTS PARTAGÉS
import AddTaskModal from './components/shared/AddTaskModal';
import RecurringChoiceModal from './components/shared/RecurringChoiceModal';
import DeleteModal from './components/shared/DeleteModal';
import { getDailySummary } from './utils/weatherLogic';

// FIREBASE
import { db, auth, provider } from './firebaseConfig';
import { doc, setDoc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { signInWithPopup, onAuthStateChanged, GoogleAuthProvider } from "firebase/auth";

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
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showCalMenu, setShowCalMenu] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth > 768);
  
  // États Formulaire/Google
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskTime, setNewTaskTime] = useState("12:00");
  const [newTaskDuration, setNewTaskDuration] = useState(60);
  const [editingEvent, setEditingEvent] = useState(null);
  const [gapiReady, setGapiReady] = useState(false);

  // ÉTAT POPUPS
  const [recModal, setRecModal] = useState({ isOpen: false, type: 'edit', data: null });
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, event: null });

  // --- CONNEXION GOOGLE CORRIGÉE ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setIsSignedIn(true);
        
        // 1. ON NE PREND PAS user.accessToken ici !
        // On récupère le "vrai" jeton Google qu'on a stocké lors du login
        const savedToken = localStorage.getItem('g_token');
        
        if (savedToken) {
          gapi.client.setToken({ access_token: savedToken });
          if (gapiReady) loadData();
        }
      } else {
        setIsSignedIn(false);
        localStorage.removeItem('g_token');
      }
    });
    return () => unsubscribe();
  }, [gapiReady]);

  const handleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential.accessToken;

      if (token) {
        localStorage.setItem('g_token', token);
        gapi.client.setToken({ access_token: token });
        setIsSignedIn(true);
        loadData();
      }
    } catch (error) {
      console.error("Erreur login Google:", error);
    }
  };

  // --- INITIALISATION GAPI ---
  useEffect(() => {
    const startGapi = async () => {
      await gapi.load("client", async () => {
        try {
          await gapi.client.init({ 
            apiKey: API_KEY, 
            clientId: CLIENT_ID,
            discoveryDocs: [DISCOVERY_DOC],
            scope: SCOPES 
          });
          await gapi.client.load('calendar', 'v3');   // ← Important
          setGapiReady(true);
        } catch (e) {
          console.error("Erreur GAPI Init:", e);
        }
      });
    };
    startGapi();

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

  // --- LOGIQUE API (inchangée sauf sécurité token) ---
  const loadData = async () => {
    const token = localStorage.getItem('g_token');
    if (!token) return;

    gapi.client.setToken({ access_token: token });

    try { 
      const r = await gapi.client.calendar.calendarList.list(); 
      setCalendars(r.result.items); 
      setSelectedCalendarIds(r.result.items.map(c => c.id));
    } catch(e) {
      console.error("Erreur calendrier:", e);
      if (e.status === 401 || e.status === 403) {
        setIsSignedIn(false);
      }
    } 
  };

  const fetchAllEvents = useCallback(async () => {
    if (selectedCalendarIds.length === 0 || !isSignedIn) { 
      setEvents([]); 
      return; 
    }
    setIsLoading(true);
    try {
      const start = new Date(currentDate); start.setHours(0,0,0,0);
      const end = new Date(currentDate); end.setHours(23,59,59,999);
      
      const promises = selectedCalendarIds.map(async (calId) => {
        const r = await gapi.client.calendar.events.list({ 
          'calendarId': calId, 
          'timeMin': start.toISOString(), 
          'timeMax': end.toISOString(), 
          'singleEvents': true, 
          'orderBy': 'startTime' 
        });
        const cal = calendars.find(c => c.id === calId);
        if (!r.result.items) return [];
        return await Promise.all(r.result.items.map(async (event) => {
          const docSnap = await getDoc(doc(db, "task_details", event.id));
          return { 
            ...event, 
            color: cal?.backgroundColor, 
            calId: calId, 
            subtasks: docSnap.exists() ? docSnap.data().subtasks : [] 
          };
        }));
      });
      const res = await Promise.all(promises);
      setEvents(res.flat().sort((a, b) => 
        new Date(a.start.dateTime || a.start.date) - new Date(b.start.dateTime || b.start.date)
      ));
    } catch(e) {
      console.error(e);
      if (e.status === 401) setIsSignedIn(false);
    } finally { 
      setIsLoading(false); 
    }
  }, [currentDate, selectedCalendarIds, isSignedIn, calendars]);

  useEffect(() => { 
    if (isSignedIn && gapiReady) fetchAllEvents(); 
  }, [fetchAllEvents, isSignedIn, gapiReady]);

  // --- TOUTES TES AUTRES FONCTIONS (inchangées) ---
  const handleToggleSubtask = async (eventId, subtasksArray, subtaskId) => {
    if (!subtasksArray) return;
    const newSubtasks = subtasksArray.map(sub => 
      sub.id === subtaskId ? { ...sub, completed: !sub.completed } : sub
    );
    
    setEvents(prev => prev.map(ev => 
      ev.id === eventId ? { ...ev, subtasks: newSubtasks } : ev
    ));

    try {
      const taskRef = doc(db, "task_details", eventId);
      await updateDoc(taskRef, { subtasks: newSubtasks });
    } catch (e) {
      console.error("Erreur Firebase sous-tâche:", e);
    }
  };

  const handleSaveRequest = (data) => {
    if (editingEvent?.recurringEventId) {
      setRecModal({ isOpen: true, type: 'edit', data: data });
    } else {
      createEvent(data, 'this');
    }
  };

  const handleDeleteRequest = (eventOrId) => {
    const event = typeof eventOrId === 'string' ? events.find(e => e.id === eventOrId) : eventOrId;
    if (!event) return;
    if (event.recurringEventId) {
      setRecModal({ isOpen: true, type: 'delete', data: event });
    } else {
      setDeleteModal({ isOpen: true, event: event });
    }
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
      closeAddModal(); 
      fetchAllEvents();
    } catch (e) { 
      console.error(e); 
    }
  };

  const deleteSingleEvent = async (id, modType = 'this') => {
    try {
      const event = events.find(e => e.id === id);
      if (!event) return;
      const calendarId = event.calId || 'primary';
      const targetId = (modType === 'all' && event.recurringEventId) ? event.recurringEventId : id;
      await gapi.client.calendar.events.delete({ calendarId: calendarId, eventId: targetId });
      fetchAllEvents();
    } catch (e) { 
      console.error(e); 
    }
  };

  const handleEditEvent = (event) => {
    if (event.isNewFromGap) {
      setEditingEvent(null);
      setNewTaskTitle("");
      setNewTaskTime(event.startTime);
      setNewTaskDuration(event.gapDuration);
    } else {
      setEditingEvent(event);
      setNewTaskTitle(event.summary);
      const st = new Date(event.start.dateTime || event.start.date);
      setNewTaskTime(format(st, 'HH:mm'));
      setNewTaskDuration(Math.round((new Date(event.end.dateTime || event.end.date) - st) / 60000));
    }
    setShowAddModal(true);
  };

  const closeAddModal = () => { 
    setShowAddModal(false); 
    setEditingEvent(null); 
    setNewTaskTitle(""); 
  };

  const toggleTaskCompletion = (id) => { 
    const n = {...completedEvents, [id]:!completedEvents[id]}; 
    setCompletedEvents(n); 
    localStorage.setItem('completed_tasks', JSON.stringify(n)); 
  };

  const todaySummary = getDailySummary(new Date(), forecast);
  const Layout = isDesktop ? DesktopLayout : MobileLayout;

  return (
    <>
      <Layout activeTab={activeTab} setActiveTab={setActiveTab} setShowAddModal={setShowAddModal} setShowCalMenu={setShowCalMenu} showCalMenu={showCalMenu}>
        {activeTab === 'timeline' ? (
          <TimelineView 
            forecast={forecast} 
            events={events.filter(e => e.start?.dateTime)} 
            currentDate={currentDate} 
            setCurrentDate={setCurrentDate}
            now={now} 
            completedEvents={completedEvents} 
            toggleTaskCompletion={toggleTaskCompletion} 
            onToggleSubtask={handleToggleSubtask}
            isSignedIn={isSignedIn} 
            handleLogin={handleLogin} 
            isLoading={isLoading} 
            todaySummary={todaySummary} 
            calendars={calendars} 
            showCalMenu={showCalMenu} 
            setShowCalMenu={setShowCalMenu} 
            setShowAddModal={setShowAddModal} 
            onDeleteEvent={handleDeleteRequest} 
            onEditEvent={handleEditEvent} 
            allDayEvents={events.filter(e => !e.start?.dateTime)} 
          />
        ) : activeTab === 'inbox' ? (
          <InboxView onPlanTask={(title) => {
            setNewTaskTitle(title);
            setShowAddModal(true);
          }} />
        ) : activeTab === 'lists' ? (
          <ListsView />
        ) : activeTab === 'settings' ? (
          <SettingsView 
            calendars={calendars} 
            selectedCalendarIds={selectedCalendarIds} 
            toggleCalendar={(id)=>setSelectedCalendarIds(p=>p.includes(id)?p.filter(i=>i!==id):[...p,id])} 
            handleLogout={()=>{localStorage.clear();window.location.reload();}} 
          />
        ) : null}
      </Layout>

      {showAddModal && (
        <AddTaskModal 
          onClose={closeAddModal} 
          currentDate={currentDate} 
          newTaskTitle={newTaskTitle} 
          setNewTaskTitle={setNewTaskTitle} 
          newTaskTime={newTaskTime} 
          setNewTaskTime={setNewTaskTime} 
          newTaskDuration={newTaskDuration} 
          setNewTaskDuration={setNewTaskDuration} 
          onAdd={handleSaveRequest} 
          editingEvent={editingEvent} 
        />
      )}

      <RecurringChoiceModal 
        isOpen={recModal.isOpen}
        actionType={recModal.type}
        onClose={() => setRecModal({ ...recModal, isOpen: false })}
        onSelect={(choice) => {
          if (recModal.type === 'edit') createEvent(recModal.data, choice);
          else deleteSingleEvent(recModal.data.id, choice);
          setRecModal({ ...recModal, isOpen: false });
        }}
      />

      <DeleteModal 
        isOpen={deleteModal.isOpen}
        taskTitle={deleteModal.event?.summary || ""}
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