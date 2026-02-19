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
import InboxView from './views/InboxView';
import SettingsView from './views/SettingsView'

import AddTaskModal from './components/shared/AddTaskModal';
import { getDailySummary } from './utils/weatherLogic';

import { db } from './firebaseConfig';
import { doc, setDoc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";

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
        
        // POUR CHAQUE ÉVÉNEMENT GOOGLE, ON TENTE DE RÉCUPÉRER LES SUBTASKS
        const eventsWithFirebase = await Promise.all(r.result.items.map(async (event) => {
          const docRef = doc(db, "task_details", event.id);
          const docSnap = await getDoc(docRef);
          
          return { 
            ...event, 
            color: cal?.backgroundColor, 
            calId: calId,
            // On ajoute les subtasks si elles existent dans Firebase
            subtasks: docSnap.exists() ? docSnap.data().subtasks : []
          };
        }));
        
        return eventsWithFirebase;
      });
  
      const res = await Promise.all(promises);
      const flatEvents = res.flat().sort((a,b) => new Date(a.start.dateTime) - new Date(b.start.dateTime));
      setEvents(flatEvents);
      
    } catch(e) { 
      if(e.status===401) { setIsSignedIn(false); localStorage.clear(); } 
      console.error("Erreur fetch:", e);
    } finally { 
      setIsLoading(false); 
    }
  };

  const toggleTaskCompletion = (id) => { 
    const n = {...completedEvents, [id]:!completedEvents[id]}; 
    setCompletedEvents(n); localStorage.setItem('completed_tasks', JSON.stringify(n)); 
  };

  
  const handleToggleSubtask = async (googleEventId, currentSubtasks, subtaskId) => {
    try {
      // 1. On crée le nouveau tableau avec la tâche inversée
      const updatedSubtasks = currentSubtasks.map(sub => 
        sub.id === subtaskId ? { ...sub, completed: !sub.completed } : sub
      );

      // 2. Mise à jour dans Firebase
      const docRef = doc(db, "task_details", googleEventId);
      await updateDoc(docRef, {
        subtasks: updatedSubtasks
      });

      // 3. Mise à jour locale de l'état pour un rendu instantané sans recharger
      setEvents(prevEvents => prevEvents.map(event => 
        event.id === googleEventId ? { ...event, subtasks: updatedSubtasks } : event
      ));
      
    } catch (error) {
      console.error("Erreur lors de la mise à jour de la sous-tâche:", error);
    }
  };

  const createEvent = async (taskData) => {
    if (!taskData.title) return;
  
    try {
      const [h, m] = newTaskTime.split(':');
      const start = new Date(currentDate);
      start.setHours(parseInt(h), parseInt(m), 0);
      const end = new Date(start.getTime() + newTaskDuration * 60000);
  
      const resource = {
        summary: taskData.title,
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() }
      };
  
      let googleId;
  
      if (editingEvent) {
        // MODE ÉDITION : On met à jour l'existant
        const response = await gapi.client.calendar.events.patch({
          calendarId: 'primary',
          eventId: editingEvent.id,
          resource: resource
        });
        googleId = editingEvent.id;
      } else {
        // MODE CRÉATION : On insère un nouveau
        const response = await gapi.client.calendar.events.insert({
          calendarId: 'primary',
          resource: resource
        });
        googleId = response.result.id;
      }
  
      // Mise à jour de Firebase (écrase ou crée les subtasks)
      await setDoc(doc(db, "task_details", googleId), {
        subtasks: taskData.subtasks,
        updatedAt: new Date().toISOString()
      });
  
      closeAddModal(); // Utilise la nouvelle fonction de fermeture
      setTimeout(fetchAllEvents, 500);
    } catch (e) {
      console.error(e);
      alert("Erreur lors de la sauvegarde");
    }
  };

  // SUPPRIMER UNE TÂCHE
  const handleDeleteEvent = async (eventId) => {
    if (!window.confirm("Supprimer cette tâche ?")) return;

    try {
      // 1. Supprimer sur Google Calendar
      await gapi.client.calendar.events.delete({
        calendarId: 'primary',
        eventId: eventId,
      });

      // 2. Supprimer les sous-tâches sur Firebase
      await deleteDoc(doc(db, "task_details", eventId));

      // 3. Rafraîchir l'interface
      fetchAllEvents();
    } catch (error) {
      console.error("Erreur suppression:", error);
    }
  };

  // MODIFIER UNE TÂCHE (Simplifié : on ouvre le modal avec les infos)
  const [editingEvent, setEditingEvent] = useState(null);

  // Fonction pour ouvrir le modal en mode édition
  const handleEditEvent = (event) => {
    setEditingEvent(event);
    setNewTaskTitle(event.summary);
    // On extrait l'heure du format ISO de Google
    const startTime = new Date(event.start.dateTime);
    setNewTaskTime(format(startTime, 'HH:mm'));
    setShowAddModal(true);
  };

  // Modifie aussi ton bouton "Fermer" ou "Ajouter" pour réinitialiser
  const closeAddModal = () => {
    setShowAddModal(false);
    setEditingEvent(null);
    setNewTaskTitle("");
    setNewTaskTime("12:00");
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
            onToggleSubtask={handleToggleSubtask} onDeleteEvent={handleDeleteEvent} onEditEvent={handleEditEvent}
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
        onClose={() => setShowAddModal(false)}
        currentDate={currentDate} 
        setCurrentDate={setCurrentDate}
        newTaskTitle={newTaskTitle} setNewTaskTitle={setNewTaskTitle}
        newTaskTime={newTaskTime} setNewTaskTime={setNewTaskTime}
        newTaskDuration={newTaskDuration} setNewTaskDuration={setNewTaskDuration}
        onAdd={(data) => createEvent(data)} 
        editingEvent={editingEvent}
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