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
import { requestForToken, onMessageListener } from './firebaseConfig';

const CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;
const API_KEY = process.env.REACT_APP_GOOGLE_API_KEY;
const WEATHER_KEY = process.env.REACT_APP_WEATHER_API_KEY;
// Remplace l'ancienne ligne par celle-ci (on ajoute .readonly)
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




  // --- EFFETS ---
  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth > 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
  const handleResize = () => {
    document.documentElement.style.setProperty('--safe-bottom', `${window.visualViewport?.height ? '' : 'env(safe-area-inset-bottom, 0px)'}`);
  };
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
        localStorage.setItem('isLoggedIn', 'true');
        loadData();
      }
    });

    

    
    
    // Dans ton useEffect, remplace la fonction initClient par celle-ci :
    const initClient = () => {
      if (window.google && window.google.accounts) {
        setTokenClient(window.google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPES,
          // prompt: 'consent' <-- SUPPRIME CETTE LIGNE ou mets prompt: ''
          // access_type: 'offline' <-- Optionnel en SPA pure, mais ne gêne pas
          callback: (resp) => {
            if (resp.access_token) {
              saveToken(resp);
              setIsSignedIn(true);
              loadData();
            }
          },
        }));
      } else { setTimeout(initClient, 500); }
    };
    initClient();

    // Ajoute cette fonction utilitaire dans ton composant App
    const saveToken = (resp) => {
      const expiresIn = (resp.expires_in || 3599) * 1000;
      const expiryTime = Date.now() + expiresIn;
      
      localStorage.setItem('g_token', resp.access_token);
      localStorage.setItem('g_expiry', expiryTime);
      localStorage.setItem('isLoggedIn', 'true');
      
      // On injecte le token dans le client GAPI pour les appels suivants
      gapi.client.setToken({ access_token: resp.access_token });
    };

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

useEffect(() => {
    // TA LIGNE MAGIQUE : On annule tout si on n'est pas en HTTPS (réseau local)
    if (!('serviceWorker' in navigator)) {
      console.log("Service Worker non disponible (Réseau local bloqué par iOS)");
      return; 
    }

    // 1. Demander le token et l'ENREGISTRER
    requestForToken()
      .then(async (token) => {
        if (token) {
          try {
            await setDoc(doc(db, "users", "mon_profil"), {
              fcmToken: token,
              lastActive: new Date()
            }, { merge: true });
            console.log("Token sauvegardé en base !");
          } catch (error) {
            console.error("Erreur sauvegarde token :", error);
          }
        }
      })
      .catch(err => console.log("Erreur token :", err));
  
    // 2. Écouter les notifications
    onMessageListener()
      .then(payload => {
        alert(`${payload.notification.title}: ${payload.notification.body}`);
      })
      .catch(err => console.log('failed: ', err));
  }, []);

  useEffect(() => {
    const checkAndRefreshToken = () => {
      const token = localStorage.getItem('g_token');
      const expiry = localStorage.getItem('g_expiry');
  
      if (token && expiry) {
        const timeLeft = parseInt(expiry) - Date.now();
  
        // Si le token expire dans moins de 5 minutes (300 000 ms)
        if (timeLeft < 300000) {
          console.log("Token sur le point d'expirer, rafraîchissement silencieux...");
          if (tokenClient) {
            // La magie est là : prompt: 'none' demande le token sans popup
            tokenClient.requestAccessToken({ prompt: 'none' });
          }
        }
      }
    };
  
    // On vérifie toutes les 5 minutes
    const interval = setInterval(checkAndRefreshToken, 300000);
    return () => clearInterval(interval);
  }, [tokenClient]);

  useEffect(() => {
    const checkInterval = setInterval(() => {
      const now = new Date();
      
      // On boucle sur tes événements de la timeline
      events.forEach(event => {
        if (event.start && event.start.dateTime) {
          const eventDate = new Date(event.start.dateTime);
          const diffInMinutes = Math.floor((eventDate - now) / 60000);
  
          // Si l'événement commence dans pile 10 minutes
          if (diffInMinutes === 10) {
            new Notification("⏰ Prochain événement", {
              body: `"${event.summary}" commence dans 10 minutes !`,
              icon: "/logo192.png",
              silent: false
            });
          }
        }
      });
    }, 60000); // On vérifie toutes les minutes
  
    return () => clearInterval(checkInterval);
  }, [events]); // On relance si la liste d'événements change

  useEffect(() => { if (isSignedIn) fetchAllEvents(); }, [currentDate, selectedCalendarIds, isSignedIn]);

  useEffect(() => {
    const morningSummary = setInterval(() => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
  
      // On cible 08h00 du matin
      if (hours === 7 && minutes === 0) {
        
        // On filtre les événements "All Day" (ceux qui n'ont pas de dateTime)
        const allDayTasks = events.filter(e => !e.start.dateTime);
        
        if (allDayTasks.length > 0) {
          const taskCount = allDayTasks.length;
          const taskList = allDayTasks.map(t => t.summary).join(', ');
  
          new Notification("☀️ Bonjour !", {
            body: `Tu as ${taskCount} objectifs aujourd'hui : ${taskList}`,
            icon: "/logo192.png"
          });
        }
      }
    }, 60000); // Vérifie chaque minute
  
    return () => clearInterval(morningSummary);
  }, [events]);

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
        try {
          const r = await gapi.client.calendar.events.list({ 
            'calendarId': calId, 
            'timeMin': start.toISOString(), 
            'timeMax': end.toISOString(), 
            'singleEvents': true, 
            'orderBy': 'startTime' 
          });
      
          const cal = calendars.find(c => c.id === calId);
          
          // Si pas d'items, on retourne un tableau vide pour ce calendrier
          if (!r.result.items) return [];
      
          const eventsWithFirebase = await Promise.all(r.result.items.map(async (event) => {
            // SÉCURITÉ : On vérifie que l'event possède bien un ID
            if (!event.id) return { ...event, color: cal?.backgroundColor, calId, subtasks: [] };
      
            try {
              const docRef = doc(db, "task_details", event.id);
              const docSnap = await getDoc(docRef);
              
              return { 
                ...event, 
                color: cal?.backgroundColor, 
                calId: calId,
                subtasks: docSnap.exists() ? docSnap.data().subtasks : []
              };
            } catch (firestoreErr) {
              console.warn(`Impossible de lire Firebase pour l'event ${event.id}`, firestoreErr);
              return { ...event, color: cal?.backgroundColor, calId, subtasks: [] };
            }
          }));
          
          return eventsWithFirebase;
        } catch (apiErr) {
          console.error(`Erreur sur le calendrier ${calId}:`, apiErr);
          return []; // On retourne vide pour ce calendrier précis sans tout faire planter
        }
      });
  
      const res = await Promise.all(promises);

      // Tri corrigé : gère dateTime (heure) ET date (toute la journée)
      const flatEvents = res.flat().sort((a, b) => {
        const startA = new Date(a.start.dateTime || a.start.date);
        const startB = new Date(b.start.dateTime || b.start.date);
        
        // Si c'est la même heure (ex: deux All Day), on trie par titre
        if (startA.getTime() === startB.getTime()) {
          return a.summary.localeCompare(b.summary);
        }
        
        return startA - startB;
      });

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
      let start, end, resource;
  
      if (taskData.allDay) {
        // --- CAS ALL DAY ---
        // On formate la date en YYYY-MM-DD (format requis par Google pour All Day)
        const dateString = format(taskData.date, 'yyyy-MM-dd');
        
        resource = {
          summary: taskData.title,
          start: { date: dateString },
          end: { date: dateString } // Pour une seule journée, start et end sont identiques
        };
      } else {
        // --- CAS CHRONOLOGIQUE (Heure précise) ---
        const [h, m] = taskData.time.split(':');
        const startDate = new Date(taskData.date);
        startDate.setHours(parseInt(h), parseInt(m), 0);
        const endDate = new Date(startDate.getTime() + taskData.duration * 60000);
  
        resource = {
          summary: taskData.title,
          start: { dateTime: startDate.toISOString() },
          end: { dateTime: endDate.toISOString() }
        };
      }
  
      let googleId;
      // Dans createEvent ou ta fonction de modification
      if (editingEvent) {
        await gapi.client.calendar.events.patch({
          calendarId: editingEvent.calId || 'primary',
          eventId: editingEvent.id,
          resource: resource
        });
        googleId = editingEvent.id;
      } else {
        const response = await gapi.client.calendar.events.insert({
          calendarId: 'primary',
          resource: resource
        });
        // SÉCURITÉ : On vérifie l'existence de l'ID renvoyé par Google
        googleId = response.result.id;
      }
  
      // --- LA CORRECTION EST ICI ---
      if (!googleId) {
        throw new Error("L'ID Google n'a pas pu être généré.");
      }
  
      // On utilise une constante propre pour Firebase
      const docRef = doc(db, "task_details", String(googleId)); 
      
      await setDoc(docRef, {
        subtasks: taskData.subtasks || [],
        updatedAt: new Date().toISOString()
      });
  
      closeAddModal();
      setTimeout(fetchAllEvents, 500);
    } catch (e) {
      console.error("Erreur détaillée :", e);
      alert("Erreur lors de la sauvegarde : " + e.message);
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
    if (event.isNewFromGap) {
      setEditingEvent(null); // Ce n'est pas une édition, c'est un nouveau
      setNewTaskTitle("");
      setNewTaskTime(event.startTime); // ON FORCE L'HEURE DU TROU
      setNewTaskDuration(event.gapDuration);
    } else {
      // ... ta logique d'édition habituelle ...
      setEditingEvent(event);
      setNewTaskTitle(event.summary);
      const startTime = new Date(event.start.dateTime || event.start.date);
      setNewTaskTime(format(startTime, 'HH:mm'));

      const endTime = new Date(event.end.dateTime || event.end.date);
      const diff = Math.round((endTime - startTime) / 60000);
      setNewTaskDuration(diff);
    }
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

  // Exemple de tri à faire avant le rendu
  const allDayEvents = events.filter(e => e.start.date && !e.start.dateTime);
  const timelineEvents = events.filter(e => e.start.dateTime);

  const todaySummary = getDailySummary(new Date(), forecast);

  // --- RENDU ---
  const renderView = () => {
    switch(activeTab) {
      case 'timeline': 
        return (
          <TimelineView 
            forecast={forecast}
            events={timelineEvents} currentDate={currentDate} setCurrentDate={setCurrentDate}
            now={now} completedEvents={completedEvents} toggleTaskCompletion={toggleTaskCompletion}
            isSignedIn={isSignedIn} handleLogin={()=>tokenClient?.requestAccessToken()}
            isLoading={isLoading} todaySummary={todaySummary} calendars={calendars}
            showCalMenu={showCalMenu} setShowCalMenu={setShowCalMenu} setShowAddModal={setShowAddModal}
            onToggleSubtask={handleToggleSubtask} onDeleteEvent={handleDeleteEvent} onEditEvent={handleEditEvent} allDayEvents={allDayEvents}
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
    <>
      <Layout 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        setShowAddModal={setShowAddModal}
        setShowCalMenu={setShowCalMenu}
        showCalMenu={showCalMenu}
      >
        {renderView()}
      </Layout>

      {/* --- C'EST ICI LA MAGIE : Les modales sont en DEHORS du Layout --- */}
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
    </>
  );
}

export default App;