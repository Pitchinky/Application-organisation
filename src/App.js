/* global google */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { gapi } from 'gapi-script';
import { Check, X, AlertCircle } from 'lucide-react';
import './App.css';
import { format } from 'date-fns';

// IMPORTS ARCHITECTURE
import MobileLayout from './layouts/MobileLayout';
import DesktopLayout from './layouts/DesktopLayout';
import TimelineView from './views/TimelineView';
import InboxView from './views/InboxView';
import SettingsView from './views/SettingsView';

// COMPOSANTS
import AddTaskModal from './components/shared/AddTaskModal';
import RecurringChoiceModal from './components/shared/RecurringChoiceModal';
import DeleteModal from './components/shared/DeleteModal';
import { getDailySummary } from './utils/weatherLogic';

// FIREBASE
import { db } from './firebaseConfig';
import { doc, setDoc, getDoc, deleteDoc, updateDoc } from "firebase/firestore";

const CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;
const API_KEY = process.env.REACT_APP_GOOGLE_API_KEY;
const WEATHER_KEY = process.env.REACT_APP_WEATHER_API_KEY;
const SCOPES = "https://www.googleapis.com/auth/calendar.events";
const DISCOVERY_DOC = "https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest";

function App() {
  // ────────────────────────────────────────────────
  // ÉTATS
  // ────────────────────────────────────────────────
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
  const [needsReconnect, setNeedsReconnect] = useState(false);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth > 768);

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskTime, setNewTaskTime] = useState("12:00");
  const [newTaskDuration, setNewTaskDuration] = useState(60);
  const [tokenClient, setTokenClient] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);

  const [recModal, setRecModal] = useState({ isOpen: false, type: 'edit', data: null });
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, event: null });

  // Verrou pour éviter les refresh Google en boucle
  const isRefreshing = useRef(false);

  // ────────────────────────────────────────────────
  // FONCTIONS AUTH & PERSISTENCE
  // ────────────────────────────────────────────────
  const saveToken = useCallback((resp) => {
    if (!resp?.access_token) return;
    const expiry = Date.now() + (resp.expires_in || 3599) * 1000;
    localStorage.setItem('g_token', resp.access_token);
    localStorage.setItem('g_expiry', expiry);
    localStorage.setItem('isLoggedIn', 'true');
    gapi.client.setToken({ access_token: resp.access_token });
  }, []);

  const loadCalendars = useCallback(async () => {
    try {
      const r = await gapi.client.calendar.calendarList.list();
      const all = r.result.items || [];
      const primary = all.find(c => c.primary);
      if (primary) localStorage.setItem('user_email', primary.id);
      setCalendars(all);
      let ids = localStorage.getItem('selectedCalendars');
      setSelectedCalendarIds(ids ? JSON.parse(ids) : all.map(c => c.id));
    } catch (e) {
      if (e?.status === 401) setNeedsReconnect(true);
    }
  }, []);

  const fetchAllEvents = useCallback(async () => {
    if (selectedCalendarIds.length === 0 || !isSignedIn) return;
    setIsLoading(true);
    try {
      const start = new Date(currentDate); start.setHours(0,0,0,0);
      const end = new Date(currentDate); end.setHours(23,59,59,999);

      const promises = selectedCalendarIds.map(async (calId) => {
        const r = await gapi.client.calendar.events.list({
          calendarId: calId,
          timeMin: start.toISOString(),
          timeMax: end.toISOString(),
          singleEvents: true,
          orderBy: 'startTime'
        });
        const cal = calendars.find(c => c.id === calId);
        if (!r.result.items) return [];
        return await Promise.all(r.result.items.map(async (event) => {
          const docSnap = await getDoc(doc(db, "task_details", event.id));
          return { ...event, color: cal?.backgroundColor, calId, subtasks: docSnap.exists() ? docSnap.data().subtasks : [] };
        }));
      });

      const res = await Promise.all(promises);
      setEvents(res.flat().sort((a, b) => new Date(a.start.dateTime || a.start.date) - new Date(b.start.dateTime || b.start.date)));
    } catch (e) {
      if (e?.status === 401) setNeedsReconnect(true);
    } finally { setIsLoading(false); }
  }, [currentDate, selectedCalendarIds, calendars, isSignedIn]);

  // ────────────────────────────────────────────────
  // EFFETS (INITIALISATION)
  // ────────────────────────────────────────────────
  useEffect(() => {
    const initGoogle = async () => {
      try {
        await new Promise(r => gapi.load('client', r));
        await gapi.client.init({ apiKey: API_KEY, discoveryDocs: [DISCOVERY_DOC] });

        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPES,
          callback: (resp) => {
            isRefreshing.current = false;
            if (resp.error) {
              if (resp.error === 'interaction_required') setNeedsReconnect(true);
              return;
            }
            if (resp.access_token) {
              saveToken(resp);
              setIsSignedIn(true);
              setNeedsReconnect(false);
              loadCalendars();
            }
          }
        });
        setTokenClient(client);

        const token = localStorage.getItem('g_token');
        const expiry = localStorage.getItem('g_expiry');
        const email = localStorage.getItem('user_email');

        if (token && expiry && Date.now() < parseInt(expiry)) {
          gapi.client.setToken({ access_token: token });
          setIsSignedIn(true);
          loadCalendars();
        } else if (localStorage.getItem('isLoggedIn') === 'true' && client) {
          isRefreshing.current = true;
          client.requestAccessToken({ prompt: 'none', login_hint: email || undefined });
        }
      } catch (err) { console.error(err); }
    };
    initGoogle();
    const timer = setInterval(() => setNow(new Date()), 60000);
    const handleRes = () => setIsDesktop(window.innerWidth > 768);
    window.addEventListener('resize', handleRes);
    return () => { clearInterval(timer); window.removeEventListener('resize', handleRes); };
  }, [saveToken, loadCalendars]);

  // Rafraîchissement silencieux périodique
  useEffect(() => {
    if (!tokenClient || !isSignedIn) return;
    const interval = setInterval(() => {
      if (!isRefreshing.current) {
        const email = localStorage.getItem('user_email');
        isRefreshing.current = true;
        tokenClient.requestAccessToken({ prompt: 'none', login_hint: email || undefined });
      }
    }, 50 * 60 * 1000); 
    return () => clearInterval(interval);
  }, [tokenClient, isSignedIn]);

  useEffect(() => { if (isSignedIn) fetchAllEvents(); }, [isSignedIn, currentDate, fetchAllEvents]);

  // ────────────────────────────────────────────────
  // ACTIONS TÂCHES
  // ────────────────────────────────────────────────
  const handleLogin = () => { if (tokenClient) tokenClient.requestAccessToken({ prompt: 'select_account' }); };
  const handleLogout = () => { localStorage.clear(); window.location.reload(); };

  const handleEditEvent = (event) => {
    if (event.isNewFromGap) {
      setEditingEvent(null); setNewTaskTitle(""); 
      setNewTaskTime(event.startTime); setNewTaskDuration(event.gapDuration);
    } else {
      setEditingEvent(event); setNewTaskTitle(event.summary);
      const st = new Date(event.start.dateTime || event.start.date);
      setNewTaskTime(format(st, 'HH:mm'));
      const dur = Math.round((new Date(event.end.dateTime || event.end.date) - st) / 60000);
      setNewTaskDuration(dur);
    }
    setShowAddModal(true);
  };

  const handleDeleteRequest = (event) => {
    if (event.recurringEventId) setRecModal({ isOpen: true, type: 'delete', data: event });
    else setDeleteModal({ isOpen: true, event: event });
  };

  const deleteSingleEvent = async (id, modType = 'this') => {
    try {
      const event = events.find(e => e.id === id);
      const targetId = (modType === 'all' && event?.recurringEventId) ? event.recurringEventId : id;
      await gapi.client.calendar.events.delete({ calendarId: event.calId || 'primary', eventId: targetId });
      await deleteDoc(doc(db, "task_details", id));
      fetchAllEvents();
    } catch (e) { console.error(e); }
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

      if (editingEvent) {
        await gapi.client.calendar.events.patch({
          calendarId: editingEvent.calId || 'primary',
          eventId: (modType === 'all' && editingEvent.recurringEventId) ? editingEvent.recurringEventId : editingEvent.id,
          resource
        });
      } else {
        await gapi.client.calendar.events.insert({ calendarId: 'primary', resource });
      }
      setShowAddModal(false); setEditingEvent(null); fetchAllEvents();
    } catch (e) { console.error(e); }
  };

  const toggleTaskCompletion = (id) => {
    const n = { ...completedEvents, [id]: !completedEvents[id] };
    setCompletedEvents(n);
    localStorage.setItem('completed_tasks', JSON.stringify(n));
  };

  const handleToggleSubtask = async (googleEventId, currentSubtasks, subtaskId) => {
    const updated = currentSubtasks.map(sub => sub.id === subtaskId ? { ...sub, completed: !sub.completed } : sub);
    await updateDoc(doc(db, "task_details", googleEventId), { subtasks: updated });
    setEvents(prev => prev.map(ev => ev.id === googleEventId ? { ...ev, subtasks: updated } : ev));
  };

  // ────────────────────────────────────────────────
  // RENDU
  // ────────────────────────────────────────────────
  const todaySummary = getDailySummary(new Date(), forecast);
  const Layout = isDesktop ? DesktopLayout : MobileLayout;

  return (
    <>
      <Layout 
        activeTab={activeTab} setActiveTab={setActiveTab} 
        setShowAddModal={setShowAddModal} setShowCalMenu={setShowCalMenu} showCalMenu={showCalMenu}
      >
        {needsReconnect && (
          <div style={{ padding: 15, background: '#FF3B30', color: 'white', textAlign: 'center', cursor: 'pointer' }} onClick={handleLogin}>
            Session expirée. Cliquez pour reconnecter.
          </div>
        )}

        {!isSignedIn ? (
          /* TA PAGE DE CONNEXION AVEC LE BEAU BOUTON */
          <div style={{ height: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
            <h1>Bienvenue</h1>
            <p>Connecte ton Google Calendar pour voir tes événements</p>
            <button onClick={handleLogin} style={{ padding: '16px 40px', fontSize: 18, marginTop: 30, backgroundColor: '#4285F4', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold' }}>
              Connexion Google
            </button>
          </div>
        ) : activeTab === 'timeline' ? (
          <TimelineView
            forecast={forecast} events={events.filter(e => e.start?.dateTime)} currentDate={currentDate} setCurrentDate={setCurrentDate}
            now={now} completedEvents={completedEvents} toggleTaskCompletion={toggleTaskCompletion}
            isSignedIn={isSignedIn} handleLogin={handleLogin} isLoading={isLoading} todaySummary={todaySummary} calendars={calendars}
            showCalMenu={showCalMenu} setShowCalMenu={setShowCalMenu} setShowAddModal={setShowAddModal}
            onToggleSubtask={handleToggleSubtask} onDeleteEvent={handleDeleteRequest} onEditEvent={handleEditEvent} 
            allDayEvents={events.filter(e => !e.start?.dateTime)}
          />
        ) : activeTab === 'settings' ? (
          <SettingsView
            calendars={calendars} selectedCalendarIds={selectedCalendarIds}
            toggleCalendar={(id) => setSelectedCalendarIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])}
            handleLogout={handleLogout}
          />
        ) : null}
      </Layout>

      {showAddModal && (
        <AddTaskModal
          onClose={() => setShowAddModal(false)} currentDate={currentDate}
          newTaskTitle={newTaskTitle} setNewTaskTitle={setNewTaskTitle}
          newTaskTime={newTaskTime} setNewTaskTime={setNewTaskTime}
          newTaskDuration={newTaskDuration} setNewTaskDuration={setNewTaskDuration}
          onAdd={(data) => {
            if (editingEvent?.recurringEventId) setRecModal({ isOpen: true, type: 'edit', data: data });
            else createEvent(data, 'this');
          }}
          editingEvent={editingEvent}
        />
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
        onConfirm={() => { deleteSingleEvent(deleteModal.event.id, 'this'); setDeleteModal({ isOpen: false, event: null }); }}
      />
    </>
  );
}

export default App;