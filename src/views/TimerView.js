import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Coffee, Brain, Settings, X } from 'lucide-react';
import { db } from '../firebaseConfig';
import { collection, onSnapshot, doc, setDoc } from "firebase/firestore";
import './TimerView.css';

export default function TimerView({ events = [] }) {
  // --- ÉTATS DU MINUTEUR ---
  const [workDuration, setWorkDuration] = useState(25);
  const [breakDuration, setBreakDuration] = useState(5);
  const [timeLeft, setTimeLeft] = useState(workDuration * 60);
  const [isActive, setIsActive] = useState(false);
  const [isWorkMode, setIsWorkMode] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  
  // --- ÉTATS POUR LA TO-DO LIST DE SESSION ---
  const [sessionTasks, setSessionTasks] = useState([]); 
  const [taskInput, setTaskInput] = useState(""); 
  const [availableTasks, setAvailableTasks] = useState([]); 
  const [showTaskMenu, setShowTaskMenu] = useState(false); 

  const timerRef = useRef(null);

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
            parentEvent: event.summary
          }))
      );

      setAvailableTasks([...dbTasks, ...subTasksFromEvents]);
    };

    const unsubTodos = onSnapshot(collection(db, "todos"), (snap) => {
      currentTodos = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      updateAvailableTasks();
    });

    const unsubLists = onSnapshot(collection(db, "lists"), (snap) => {
      const listsData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      currentListItems = [];
      listsData.forEach(list => {
        if (list.icon !== 'cart' && list.items) currentListItems.push(...list.items);
      });
      updateAvailableTasks();
    });
    
    return () => { unsubTodos(); unsubLists(); };
  }, [events]);

  // Synchronisation au changement de réglages
  useEffect(() => {
    if (!isActive) setTimeLeft(isWorkMode ? workDuration * 60 : breakDuration * 60);
  }, [workDuration, breakDuration, isWorkMode, isActive]);

  // Logique du Timer
  useEffect(() => {
    if (isActive && timeLeft > 0) {
      timerRef.current = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    } else if (timeLeft === 0 && isActive) {
      handleTimerComplete();
    }
    return () => clearInterval(timerRef.current);
  }, [isActive, timeLeft]);

  const handleTimerComplete = () => {
    setIsActive(false);
    clearInterval(timerRef.current);
    sendNotifications();
    const nextMode = !isWorkMode;
    setIsWorkMode(nextMode);
    setTimeLeft(nextMode ? workDuration * 60 : breakDuration * 60);
  };

  const sendNotifications = async () => {
    const discordWebhookUrl = "https://discordapp.com/api/webhooks/1481244962103365795/admhCTVeKxs8F-j5H-r_v0OdaZOne5tEsHGwK-WxJfJszTTK1-EYiNrSewhozSjdj0zh";
    const tasksFormatted = sessionTasks.length > 0 
      ? sessionTasks.map(t => `> ${t.completed ? '✅' : '❌'} ${t.text}`).join('\n')
      : `> 🔹 Mode Focus Libre`;

    const discordMessage = isWorkMode 
      ? `🍅 **Pomodoro Terminé ! (${workDuration} min)**\n**Bilan :**\n${tasksFormatted}`
      : `☕ **Pause Terminée !**`;
    
    try {
      await fetch(discordWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: discordMessage })
      });
      if (isWorkMode) setSessionTasks([]);
    } catch (err) { console.error(err); }
  };

  // --- AJOUTER UNE TÂCHE (LOCALE + FIREBASE INBOX) ---
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

  const toggleSessionTaskCompletion = (index) => {
    setSessionTasks(prev => prev.map((t, i) => i === index ? { ...t, completed: !t.completed } : t));
  };

  const percentage = (( (isWorkMode ? workDuration * 60 : breakDuration * 60) - timeLeft) / (isWorkMode ? workDuration * 60 : breakDuration * 60)) * 100;
  const strokeDashoffset = 440 - (440 * percentage) / 100;

  return (
    <div className="timer-page" onClick={() => setShowTaskMenu(false)}>
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

      <div className="timer-container">
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
              {showTaskMenu && availableTasks.length > 0 && (
                <div className="pomodoro-task-menu">
                  {availableTasks.map(t => (
                    <div key={t.id} className="pomodoro-task-item" onClick={() => addSessionTask(t.text, true)}>
                      <span className="task-source-label">{t.parentEvent || t.listName || 'Inbox'}</span>
                      {t.text}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {sessionTasks.length > 0 && (
              <div className="session-todo-list">
                {sessionTasks.map((task, index) => (
                  <div key={index} className={`session-todo-item ${task.completed ? 'completed' : ''}`}>
                    <div className="session-todo-content" onClick={() => toggleSessionTaskCompletion(index)}>
                      <div className={`session-todo-checkbox ${task.completed ? 'checked' : ''}`} />
                      <span className="session-todo-text">{task.text}</span>
                    </div>
                    <button className="session-todo-remove" onClick={() => setSessionTasks(prev => prev.filter((_, i) => i !== index))}><X size={16} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

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

        <div className="timer-controls">
            <button className="control-btn secondary" onClick={() => {setIsActive(false); setTimeLeft(isWorkMode ? workDuration * 60 : breakDuration * 60);}}><RotateCcw size={24} /></button>
            <button className="control-btn play-pause" onClick={() => setIsActive(!isActive)}>{isActive ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" />}</button>
            <button className="control-btn secondary" onClick={() => setShowSettings(true)}><Settings size={24} /></button>
        </div>
      </div>

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