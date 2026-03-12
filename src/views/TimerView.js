// --- 1. IMPORTATIONS ---
import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Coffee, Brain, Settings, X } from 'lucide-react';
import { db } from '../firebaseConfig';
import { collection, onSnapshot, doc, setDoc } from "firebase/firestore";
import { addDoc } from "firebase/firestore";
import './TimerView.css';

export default function TimerView({ events = [], userId }) {
  // --- 2. ÉTATS DU COMPOSANT (VARIABLES) ---
  
  // États du Minuteur
  const [workDuration, setWorkDuration] = useState(25);
  const [breakDuration, setBreakDuration] = useState(5);
  const [timeLeft, setTimeLeft] = useState(workDuration * 60);
  const [isActive, setIsActive] = useState(false);
  const [isWorkMode, setIsWorkMode] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  
  // États pour la To-Do list de la session
  const [sessionTasks, setSessionTasks] = useState([]); 
  const [taskInput, setTaskInput] = useState(""); 
  const [availableTasks, setAvailableTasks] = useState([]); 
  const [showTaskMenu, setShowTaskMenu] = useState(false); 

  const timerRef = useRef(null);

  // --- 3. EFFETS SECONDAIRES (useEffect) ---

  // --- SYNCHRONISATION DES TÂCHES (TODOS + LISTS + SUBTASKS) ---
  useEffect(() => {
    const todayString = new Date().toISOString().split('T')[0];
    let currentTodos = [];
    let currentListItems = [];

    const updateAvailableTasks = () => {
      // 1. Tâches Inbox et Listes
      const combinedFromDB = [...currentTodos, ...currentListItems];
      const dbTasks = combinedFromDB.filter(t => !t.completed && t.dueDate && t.dueDate <= todayString);

      // 2. Extraction des sous-tâches des événements passés en props
      const subTasksFromEvents = events.flatMap(event => 
        (event.subtasks || [])
          .filter(sub => !sub.completed)
          .map(sub => ({
            id: sub.id,
            text: sub.text,
            isSubtask: true,
            parentEvent: event.summary // On s'assure de récupérer le nom de l'événement
          }))
      );

      setAvailableTasks([...dbTasks, ...subTasksFromEvents]);
    };

    // Récupération de l'Inbox
    const unsubTodos = onSnapshot(collection(db, "todos"), (snap) => {
      currentTodos = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      updateAvailableTasks();
    });

    // Récupération des Listes
    const unsubLists = onSnapshot(collection(db, "lists"), (snap) => {
      const listsData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      currentListItems = [];
      listsData.forEach(list => {
        if (list.icon !== 'cart' && list.items) {
          // CORRECTION ICI : On injecte le nom de la liste dans chaque tâche
          const itemsWithSourceName = list.items.map(item => ({
            ...item,
            listName: list.title || list.name || "Liste" // On récupère le titre de la liste
          }));
          currentListItems.push(...itemsWithSourceName);
        }
      });
      updateAvailableTasks();
    });
    
    return () => { unsubTodos(); unsubLists(); };
  }, [events]);

  // Synchronisation au changement de réglages (Focus/Pause)
  useEffect(() => {
    if (!isActive) setTimeLeft(isWorkMode ? workDuration * 60 : breakDuration * 60);
  }, [workDuration, breakDuration, isWorkMode, isActive]);

  // Logique d'écoulement du temps du Timer
  useEffect(() => {
    if (isActive && timeLeft > 0) {
      timerRef.current = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    } else if (timeLeft === 0 && isActive) {
      handleTimerComplete();
    }
    return () => clearInterval(timerRef.current);
  }, [isActive, timeLeft]);


  // --- 4. FONCTIONS ET LOGIQUE MÉTIER ---

  // Action exécutée quand le chrono arrive à zéro
  const handleTimerComplete = () => {
    setIsActive(false);
    clearInterval(timerRef.current);
    sendNotifications();
    queueNotification();
    const nextMode = !isWorkMode;
    setIsWorkMode(nextMode);
    setTimeLeft(nextMode ? workDuration * 60 : breakDuration * 60);
  };

  // Ajout de la notification Push dans la file d'attente Firestore
  const queueNotification = async () => {
    if (!userId) return;
    
    // On calcule ce que tu as accompli pour personnaliser le message
    const completedTasks = sessionTasks.filter(t => t.completed).length;
    let pushTitle, pushBody;
    
    if (isWorkMode) {
      pushTitle = "🍅 Session Terminée !";
      pushBody = sessionTasks.length > 0 
        ? `Bravo ! Tu as accompli ${completedTasks} tâche(s). Prends ta pause de ${breakDuration} min.`
        : `Bravo ! Ton focus de ${workDuration} min est validé. Place à la pause.`;
    } else {
      pushTitle = "☕ Fin de la Pause";
      pushBody = "La récréation est finie. Prêt à tout déchirer ?";
    }

    await addDoc(collection(db, "notifications_queue"), {
      userId: userId,
      title: pushTitle,
      body: pushBody,
      scheduledTime: new Date().getTime(),
      status: "pending"
    });
  };

  // Envoi du résumé de session sur Discord
  const sendNotifications = async () => {
    const discordWebhookUrl = "https://discordapp.com/api/webhooks/1481244962103365795/admhCTVeKxs8F-j5H-r_v0OdaZOne5tEsHGwK-WxJfJszTTK1-EYiNrSewhozSjdj0zh";
    
    let embed;

    if (isWorkMode) {
      // Statistiques de la session
      const completedCount = sessionTasks.filter(t => t.completed).length;
      const totalCount = sessionTasks.length;
      
      const tasksFormatted = sessionTasks.length > 0 
        ? sessionTasks.map(t => `${t.completed ? '✅' : '⏳'} ${t.text}`).join('\n')
        : "🔹 *Focus Libre (Aucune tâche spécifique)*";

      // Construction du bloc visuel Discord
      embed = {
        title: "🍅 Session Focus Terminée !",
        description: "Un nouveau cycle vient de s'achever. Excellent travail !",
        color: 16733525, // Code couleur Rouge Pomodoro
        fields: [
          { name: "⏱️ Durée", value: `${workDuration} minutes`, inline: true },
          { name: "🎯 Progression", value: `${completedCount} sur ${totalCount} tâche(s)`, inline: true },
          { name: "📋 Bilan", value: tasksFormatted, inline: false }
        ],
        timestamp: new Date().toISOString()
      };
    } else {
      embed = {
        title: "☕ Fin de la Pause",
        description: "Il est temps de s'y remettre. Quel est ton prochain objectif ?",
        color: 3458905, // Code couleur Vert
        timestamp: new Date().toISOString()
      };
    }
    
    try {
      await fetch(discordWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds: [embed] }) // On envoie l'objet embed au lieu d'un simple texte
      });
    } catch (err) { console.error(err); }
  };

  // Vider la liste des tâches de la session actuelle
  const clearSessionTasks = () => {
    setSessionTasks([]);
  };

  // Ajouter une tâche (Localement + Firebase Inbox si nouvelle)
  const addSessionTask = async (text, isExisting = false) => {
    if (!text.trim()) return;

    // Ajout local pour le Pomodoro
    setSessionTasks([...sessionTasks, { text: text.trim(), completed: false }]);

    // Si c'est une nouvelle tâche, on la sauve dans l'Inbox Firebase
    if (!isExisting) {
      const id = Date.now().toString();
      try {
        await setDoc(doc(db, "todos", id), {
          id: id,
          text: text.trim(),
          completed: false,
          createdAt: new Date().toISOString(),
          dueDate: null 
        });
      } catch (error) { console.error("Firebase Error:", error); }
    }

    setTaskInput("");
    setShowTaskMenu(false);
  };

  // Cocher/Décocher une tâche de la session
  const toggleSessionTaskCompletion = (index) => {
    setSessionTasks(prev => prev.map((t, i) => i === index ? { ...t, completed: !t.completed } : t));
  };

  // Calculs pour l'animation du cercle SVG
  const percentage = (( (isWorkMode ? workDuration * 60 : breakDuration * 60) - timeLeft) / (isWorkMode ? workDuration * 60 : breakDuration * 60)) * 100;
  const strokeDashoffset = 440 - (440 * percentage) / 100;


  // --- 5. RENDU VISUEL (JSX) ---
  return (
    <div className="timer-page" onClick={() => setShowTaskMenu(false)}>
      
      {/* En-tête : Titre et Sélecteur Focus/Pause */}
      <div className="timer-header">
        <h1 className="timer-app-title">Pomodoro</h1>
        <div className="segmented-picker">
          <button className={isWorkMode ? 'active' : ''} onClick={() => {setIsActive(false); setIsWorkMode(true);}}>
            <Brain size={16} /> <span>Focus</span>
          </button>
          <button className={!isWorkMode ? 'active' : ''} onClick={() => {setIsActive(false); setIsWorkMode(false);}}>
            <Coffee size={16} /> <span>Pause</span>
          </button>
        </div>
      </div>

      {/* Conteneur principal (Tâches + Cercle + Contrôles) */}
      <div className="timer-container">
        
        {/* Zone des tâches (visible uniquement en mode Focus) */}
        {isWorkMode && (
          <div className="pomodoro-intention-section">
            <div className="pomodoro-input-container" onClick={e => e.stopPropagation()}>
              <input 
                type="text" 
                placeholder="Intention du moment..." 
                value={taskInput}
                onChange={(e) => setTaskInput(e.target.value)}
                onFocus={() => setShowTaskMenu(true)}
                onKeyDown={(e) => e.key === 'Enter' && addSessionTask(taskInput, false)}
              />
              
              {/* Menu déroulant des tâches suggérées */}
              {showTaskMenu && availableTasks.filter(t => !sessionTasks.some(st => st.text === t.text)).length > 0 && (
                <div className="pomodoro-task-menu">
                  {availableTasks
                    .filter(t => !sessionTasks.some(st => st.text === t.text)) /* <-- LE FILTRE MAGIQUE EST ICI */
                    .map(t => (
                    <div key={t.id} className="pomodoro-task-item" onClick={() => addSessionTask(t.text, true)}>
                      <span className="task-source-label">{t.parentEvent || t.listName || 'Inbox'}</span>
                      {t.text}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Liste des tâches sélectionnées pour la session */}
            {sessionTasks.length > 0 && (
  <>
    <div className="session-todo-list">
      {sessionTasks.map((task, index) => (
        <div key={index} className={`session-todo-item ${task.completed ? 'completed' : ''}`}>
          <div className="session-todo-content" onClick={() => toggleSessionTaskCompletion(index)}>
            <div className={`session-todo-checkbox ${task.completed ? 'checked' : ''}`} />
            <span className="session-todo-text">{task.text}</span>
          </div>
          <button className="session-todo-remove" onClick={() => setSessionTasks(prev => prev.filter((_, i) => i !== index))}>
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
    
                {/* Bouton pour vider la liste (visible si le chrono est arrêté) */}
                {!isActive && (
                  <button 
                    className="clear-session-btn" 
                    onClick={clearSessionTasks}
                    style={{
                      marginTop: '15px',
                      width: '100%',
                      padding: '10px',
                      borderRadius: '10px',
                      border: '1px dashed #8E8E93',
                      background: 'none',
                      color: '#8E8E93',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    Démarrer une nouvelle liste
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* Cercle d'affichage du temps restant */}
        <div className="timer-display">
          <svg className="timer-svg" viewBox="0 0 160 160">
            <circle className="timer-bg" cx="80" cy="80" r="70" />
            <circle className="timer-progress" cx="80" cy="80" r="70" style={{ strokeDashoffset, stroke: isWorkMode ? '#007AFF' : '#34C759' }} />
          </svg>
          <div className="timer-text">
            <span className="time">{Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}</span>
            <span className="mode-label">{isWorkMode ? 'FOCUS' : 'PAUSE'}</span>
          </div>
        </div>

        {/* Boutons de contrôle (Reset, Play/Pause, Réglages) */}
        <div className="timer-controls">
            <button className="control-btn secondary" onClick={() => {setIsActive(false); setTimeLeft(isWorkMode ? workDuration * 60 : breakDuration * 60);}}><RotateCcw size={24} /></button>
            <button className="control-btn play-pause" onClick={() => setIsActive(!isActive)}>{isActive ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" />}</button>
            <button className="control-btn secondary" onClick={() => setShowSettings(true)}><Settings size={24} /></button>
        </div>
      </div>

      {/* Modale des Réglages */}
      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2>Réglages</h2><button className="modal-close-btn" onClick={() => setShowSettings(false)}><X size={20} /></button></div>
            <div className="settings-body">
              <div className="setting-item">
                <div className="setting-info"><span>Focus</span><span>{workDuration} min</span></div>
                <input type="range" min="5" max="90" step="5" value={workDuration} onChange={(e) => setWorkDuration(parseInt(e.target.value))} />
              </div>
              <div className="setting-item">
                <div className="setting-info"><span>Pause</span><span>{breakDuration} min</span></div>
                <input type="range" min="1" max="30" step="1" value={breakDuration} onChange={(e) => setBreakDuration(parseInt(e.target.value))} />
              </div>
              <button className="settings-save-btn" onClick={() => setShowSettings(false)}>Terminé</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}