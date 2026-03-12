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
import ToDoView from './views/ToDoView';
import SettingsView from './views/SettingsView';
import HabitView from './views/HabitView';
import TimerView from './views/TimerView';

// COMPOSANTS PARTAGÉS
import AddTaskModal from './components/shared/AddTaskModal';
import RecurringChoiceModal from './components/shared/RecurringChoiceModal';
import DeleteModal from './components/shared/DeleteModal';
import { getDailySummary } from './utils/weatherLogic';
import { requestForToken } from './utils/pushNotifications';

// FIREBASE
import { db, auth, provider } from './firebaseConfig';
import { doc, setDoc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { signInWithPopup, onAuthStateChanged, GoogleAuthProvider, signInWithCredential } from "firebase/auth";

const CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;
const API_KEY = process.env.REACT_APP_GOOGLE_API_KEY;
const WEATHER_KEY = process.env.REACT_APP_WEATHER_API_KEY;
const SCOPES = "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events";
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
  const [todayEvents, setTodayEvents] = useState([]);
  const [userId, setUserId] = useState(null);

  // États Formulaire/Google
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskTime, setNewTaskTime] = useState("12:00");
  const [newTaskDuration, setNewTaskDuration] = useState(60);
  const [editingEvent, setEditingEvent] = useState(null);
  const [gapiReady, setGapiReady] = useState(false);
  const [tokenClient, setTokenClient] = useState(null);

  // ÉTAT POPUPS
  const [recModal, setRecModal] = useState({ isOpen: false, type: 'edit', data: null });
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, event: null });

  // --- LOGIQUE DE CONNEXION ET PERSISTANCE CORRIGÉE ---

  // 1. Initialisation GAPI et TokenClient
  useEffect(() => {
    const startGapi = async () => {
      await gapi.load("client", async () => {
        try {
          await gapi.client.init({ apiKey: API_KEY, discoveryDocs: [DISCOVERY_DOC] });
          await gapi.client.load('calendar', 'v3');
          setGapiReady(true);
        } catch (e) { console.error("GAPI Init Error:", e); }
      });
    };
    startGapi();

    if (window.google && window.google.accounts) {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: async (resp) => {
          if (resp.error) {
            console.error('Erreur OAuth Google:', resp.error, resp.error_subtype);
            // Fallback : Si silent refresh échoue (ex. multi-comptes ou expiration), re-prompt l'utilisateur
            if (resp.error === 'access_denied' || resp.error === 'immediate_failed' || resp.error === 'popup_closed') {
              // Utilisez l'email stocké pour hint, et forcez un prompt
              const email = localStorage.getItem('user_email');
              tokenClient.requestAccessToken({ 
                prompt: 'consent',  // Ou 'select_account' si besoin de choisir compte
                login_hint: email 
              });
            }
            // Optionnel : Affichez un toast UI comme "Veuillez réautoriser l'accès Google"
            return;
          }
          if (resp.access_token) {
            const expiry = Date.now() + (resp.expires_in * 1000);
            
            // Sauvegarde locale
            localStorage.setItem('g_token', resp.access_token);
            localStorage.setItem('g_expiry', expiry);

            // Sync avec Firebase Auth si nécessaire
            if (!auth.currentUser) {
              const credential = GoogleAuthProvider.credential(null, resp.access_token);
              await signInWithCredential(auth, credential);
            }

            // Sauvegarde Firestore pour la persistance long-terme (iPhone/PWA)
            if (auth.currentUser) {
              await setDoc(doc(db, "user_sessions", auth.currentUser.uid), {
                g_token: resp.access_token,
                g_expiry: expiry,
                email: auth.currentUser.email,
                updatedAt: new Date()
              }, { merge: true });
            }

            gapi.client.setToken({ access_token: resp.access_token });
            setIsSignedIn(true);
            loadData();
          }
        },
      });
      setTokenClient(client);
    }

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

  // 2. Gestion de la session Firebase (Restauration automatique multi-comptes)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid);
        requestForToken(user.uid);

        // On récupère TOUJOURS depuis Firestore pour être sûr (plus fiable que localStorage sur iPhone)
        const docSnap = await getDoc(doc(db, "user_sessions", user.uid));
        if (docSnap.exists()) {
          const data = docSnap.data();
          const token = data.g_token;
          const expiry = data.g_expiry;

          // Si le token est encore valide
          if (token && expiry && Date.now() < parseInt(expiry)) {
            if (gapiReady) {
              gapi.client.setToken({ access_token: token });
              setIsSignedIn(true);
              // On recharge les données immédiatement
              loadData(); 
            }
          } else {
            // Token expiré : on tente un rafraîchissement silencieux
            if (tokenClient && data.email) {
              tokenClient.requestAccessToken({ prompt: 'none', login_hint: data.email });
            }
          }
        }
      } else {
        setIsSignedIn(false);
      }
    });
    return () => unsubscribe();
  }, [gapiReady, tokenClient]); // Ajoute tokenClient ici

  // 3. Bouton de Connexion (Correction multi-comptes avec sauvegarde email)
  const handleLogin = async () => {
    try {
      // Étape 1 : Connexion Firebase pour obtenir l'email précis de l'utilisateur
      const result = await signInWithPopup(auth, provider);
      if (result.user && result.user.email) {
        localStorage.setItem('user_email', result.user.email);
        
        // Étape 2 : Lancement du Token Google
        if (tokenClient) {
          // On passe l'email pour s'assurer que Google choisit le bon compte
          tokenClient.requestAccessToken({ 
            prompt: 'select_account',
            login_hint: result.user.email 
          });
        }
      }
    } catch (error) {
      console.error("Erreur login Google:", error);
    }
  };

  // 4. Rafraîchissement automatique SILENCIEUX (Spécial PWA iPhone)
  useEffect(() => {
    const checkAndRefreshToken = () => {
      const expiry = localStorage.getItem('g_expiry');
      const email = localStorage.getItem('user_email');

      if (expiry && email && isSignedIn && tokenClient) {
        const timeLeft = parseInt(expiry) - Date.now();
        
        // Si moins de 5 minutes restantes, on demande un nouveau jeton sans popup
        // L'utilisation de login_hint est CRUCIALE quand on a plusieurs comptes
        if (timeLeft < 300000) {
          console.log("Rafraîchissement automatique pour :", email);
          tokenClient.requestAccessToken({ 
            prompt: 'none',
            login_hint: email 
          });
        }
      }
    };

    // Vérifie au réveil de l'écran (iPhone) ou toutes les minutes
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') checkAndRefreshToken();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    const interval = setInterval(checkAndRefreshToken, 60000);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      clearInterval(interval);
    };
  }, [isSignedIn, tokenClient]);


  // --- LOGIQUE API ---
  const loadData = async () => {
    try { 
      const r = await gapi.client.calendar.calendarList.list(); 
      setCalendars(r.result.items); 
      setSelectedCalendarIds(r.result.items.map(c => c.id));
    } catch(e) { if (e.status === 401) setIsSignedIn(false); } 
  };

  const fetchAllEvents = useCallback(async () => {
    if (selectedCalendarIds.length === 0 || !isSignedIn) { setEvents([]); return; }
    setIsLoading(true);
    try {
      const start = new Date(currentDate); start.setHours(0,0,0,0);
      const end = new Date(currentDate); end.setHours(23,59,59,999);
      const promises = selectedCalendarIds.map(async (calId) => {
        const r = await gapi.client.calendar.events.list({ 
          'calendarId': calId, 'timeMin': start.toISOString(), 'timeMax': end.toISOString(), 
          'singleEvents': true, 'orderBy': 'startTime' 
        });
        const cal = calendars.find(c => c.id === calId);
        if (!r.result.items) return [];
        return await Promise.all(r.result.items.map(async (event) => {
          const docSnap = await getDoc(doc(db, "task_details", event.id));
          return { ...event, color: cal?.backgroundColor, calId: calId, subtasks: docSnap.exists() ? docSnap.data().subtasks : [] };
        }));
      });
      const res = await Promise.all(promises);
      setEvents(res.flat().sort((a, b) => new Date(a.start.dateTime || a.start.date) - new Date(b.start.dateTime || b.start.date)));
    } catch(e) { if (e.status === 401) setIsSignedIn(false); } finally { setIsLoading(false); }
  }, [currentDate, selectedCalendarIds, isSignedIn, calendars]);

 

  // --- LOGIQUE ACTIONS (Subtasks, Edit, Delete, etc.) ---
  const handleToggleSubtask = async (eventId, subtasksArray, subtaskId) => {
    if (!subtasksArray) return;
    const newSubtasks = subtasksArray.map(sub => 
      sub.id === subtaskId ? { ...sub, completed: !sub.completed } : sub
    );
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
    } catch (e) { console.error(e); }
  };

  const deleteSingleEvent = async (id, modType = 'this') => {
    try {
      const event = events.find(e => e.id === id);
      if (!event) return;
      await gapi.client.calendar.events.delete({ 
        calendarId: event.calId || 'primary', 
        eventId: (modType === 'all' && event.recurringEventId) ? event.recurringEventId : id 
      });
      fetchAllEvents();
    } catch (e) { console.error(e); }
  };

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
    const n = {...completedEvents, [id]:!completedEvents[id]}; setCompletedEvents(n); 
    localStorage.setItem('completed_tasks', JSON.stringify(n)); 
  };

  const handleLinkTaskToEvent = async (task, eventId) => {
    const targetEvent = events.find(e => e.id === eventId);
    if (!targetEvent) return;

    const newSubtask = {
      id: task.id,
      text: task.text,
      completed: task.completed || false,
      sourceListId: task.listId || null,
      sourceListName: task.listName || 'Inbox'
    };

    try {
      // 1. Mise à jour des sous-tâches de l'événement
      const eventRef = doc(db, "task_details", eventId);
      const updatedSubtasks = [...(targetEvent.subtasks || []), newSubtask];
      await setDoc(eventRef, { subtasks: updatedSubtasks }, { merge: true });

      // 2. Mise à jour de la tâche originale (SANS allLists)
      if (task.isFromList) {
        const listRef = doc(db, "lists", task.listId);
        const listSnap = await getDoc(listRef); // On récupère la liste en direct de Firestore
        
        if (listSnap.exists()) {
          const listData = listSnap.data();
          const updatedItems = listData.items.map(item => 
            item.id === task.id ? { ...item, linkedEventId: eventId, linkedEventSummary: targetEvent.summary } : item
          );
          await updateDoc(listRef, { items: updatedItems });
        }
      } else {
        // Pour l'Inbox
        await updateDoc(doc(db, "todos", task.id), { 
          linkedEventId: eventId, 
          linkedEventSummary: targetEvent.summary 
        });
      }

      // 3. Mise à jour locale pour l'affichage immédiat
      setEvents(prev => prev.map(ev => 
        ev.id === eventId ? { ...ev, subtasks: updatedSubtasks } : ev
      ));

    } catch (error) {
      console.error("Erreur liaison :", error);
    }
  };

  // App.js - À placer après fetchAllEvents
  const fetchTodayOnly = useCallback(async () => {
    if (selectedCalendarIds.length === 0 || !isSignedIn) return;
    try {
      const today = new Date();
      const start = new Date(today); start.setHours(0,0,0,0);
      const end = new Date(today); end.setHours(23,59,59,999);
      
      const promises = selectedCalendarIds.map(async (calId) => {
        const r = await gapi.client.calendar.events.list({ 
          'calendarId': calId, 'timeMin': start.toISOString(), 'timeMax': end.toISOString(), 
          'singleEvents': true 
        });
        if (!r.result.items) return [];
        return await Promise.all(r.result.items.map(async (event) => {
          const docSnap = await getDoc(doc(db, "task_details", event.id));
          return { ...event, subtasks: docSnap.exists() ? docSnap.data().subtasks : [] };
        }));
      });
      const res = await Promise.all(promises);
      setTodayEvents(res.flat());
    } catch(e) { console.error(e); }
  }, [selectedCalendarIds, isSignedIn]);

  // App.js - Vers la ligne 400
useEffect(() => { 
  if (isSignedIn && gapiReady) {
    fetchAllEvents();  // Pour la Timeline
    fetchTodayOnly();  // AJOUTE CECI pour l'onglet Focus
  } 
}, [fetchAllEvents, fetchTodayOnly, isSignedIn, gapiReady]);





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
        ) : activeTab === 'to_do' ? (
          <ToDoView 
          events={todayEvents} 
          onToggleSubtask={handleToggleSubtask}
          onLinkTaskToEvent={handleLinkTaskToEvent}
          refreshEvents={fetchAllEvents}
          />
        ) : activeTab === 'lists' ? (
          <ListsView />

        ) : activeTab === 'habit' ? (
          <HabitView />

        ) : activeTab === 'timer' ? (
          <TimerView 
          events={todayEvents}
          userId={userId}
          />

        ) : activeTab === 'settings' ? (
          <SettingsView calendars={calendars} selectedCalendarIds={selectedCalendarIds} toggleCalendar={(id)=>setSelectedCalendarIds(p=>p.includes(id)?p.filter(i=>i!==id):[...p,id])} handleLogout={()=>{auth.signOut(); localStorage.clear(); window.location.reload();}} />
        ) : null}
      </Layout>

      {showAddModal && (
        <AddTaskModal onClose={closeAddModal} currentDate={currentDate} newTaskTitle={newTaskTitle} setNewTaskTitle={setNewTaskTitle} newTaskTime={newTaskTime} setNewTaskTime={setNewTaskTime} newTaskDuration={newTaskDuration} setNewTaskDuration={setNewTaskDuration} onAdd={handleSaveRequest} editingEvent={editingEvent} />
      )}

      <RecurringChoiceModal 
        isOpen={recModal.isOpen} actionType={recModal.type} onClose={() => setRecModal({ ...recModal, isOpen: false })}
        onSelect={(choice) => {
          if (recModal.type === 'edit') createEvent(recModal.data, choice);
          else deleteSingleEvent(recModal.data.id, choice);
          setRecModal({ ...recModal, isOpen: false });
        }}
      />

      <DeleteModal 
        isOpen={deleteModal.isOpen} taskTitle={deleteModal.event?.summary || ""}
        onClose={() => setDeleteModal({ isOpen: false, event: null })}
        onConfirm={() => { deleteSingleEvent(deleteModal.event.id, 'this'); setDeleteModal({ isOpen: false, event: null }); }}
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