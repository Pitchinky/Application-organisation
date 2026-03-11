import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Coffee, Brain, Settings, X } from 'lucide-react';
import { db } from '../firebaseConfig';
import { collection, onSnapshot } from "firebase/firestore";
import './TimerView.css';

export default function TimerView() {
  // --- ÉTATS DU MINUTEUR ---
  const [workDuration, setWorkDuration] = useState(25);
  const [breakDuration, setBreakDuration] = useState(5);
  
  const [timeLeft, setTimeLeft] = useState(workDuration * 60);
  const [isActive, setIsActive] = useState(false);
  const [isWorkMode, setIsWorkMode] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  
  // --- NOUVEAUX ÉTATS POUR LES TÂCHES (INTENTION) ---
  const [sessionTasks, setSessionTasks] = useState([]); 
  const [taskInput, setTaskInput] = useState(""); 
  const [availableTasks, setAvailableTasks] = useState([]); 
  const [showTaskMenu, setShowTaskMenu] = useState(false); 

  const timerRef = useRef(null);

  // --- SYNCHRONISATION FIREBASE (TÂCHES DU JOUR) ---
  useEffect(() => {
    // On génère la date d'aujourd'hui (YYYY-MM-DD)
    const todayString = new Date().toISOString().split('T')[0];
    
    let currentTodos = [];
    let currentListItems = [];

    // Fonction pour fusionner et filtrer "Aujourd'hui" et "En retard"
    const updateAvailableTasks = () => {
      const combinedTasks = [...currentTodos, ...currentListItems];
      const todayTasks = combinedTasks.filter(t => 
        !t.completed && 
        t.dueDate && 
        t.dueDate <= todayString // <= permet de prendre aujourd'hui ET les tâches en retard
      );
      setAvailableTasks(todayTasks);
    };

    // 1. Écouter l'Inbox
    const unsubTodos = onSnapshot(collection(db, "todos"), (snap) => {
      currentTodos = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      updateAvailableTasks();
    });

    // 2. Écouter les listes personnalisées (Sport, Travail, etc.)
    const unsubLists = onSnapshot(collection(db, "lists"), (snap) => {
      const listsData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      currentListItems = [];
      listsData.forEach(list => {
        // On ignore la liste de courses
        if (list.icon !== 'cart' && list.items) {
          currentListItems.push(...list.items);
        }
      });
      updateAvailableTasks();
    });
    
    return () => {
      unsubTodos();
      unsubLists();
    };
  }, []);

  // Synchroniser le temps restant quand on change les réglages (si le timer est arrêté)
  useEffect(() => {
    if (!isActive) {
      setTimeLeft(isWorkMode ? workDuration * 60 : breakDuration * 60);
    }
  }, [workDuration, breakDuration, isWorkMode, isActive]);

  // LOGIQUE DU TIMER
  useEffect(() => {
    if (isActive && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isActive) {
      handleTimerComplete();
    }
    return () => clearInterval(timerRef.current);
  }, [isActive, timeLeft]);

  const handleTimerComplete = () => {
    setIsActive(false);
    clearInterval(timerRef.current);
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    
    sendNotifications();

    const nextMode = !isWorkMode;
    setIsWorkMode(nextMode);
    setTimeLeft(nextMode ? workDuration * 60 : breakDuration * 60);
  };

  const sendNotifications = async () => {
    // --- 1. CONFIGURATION NTFY (Téléphone) ---
    const ntfyTitle = isWorkMode ? "Session Terminee" : "Pause Terminee";
    const ntfyMessage = isWorkMode 
      ? `Bravo ! Tu as fini ${workDuration}min de focus.`
      : "La pause est finie. Prêt à repartir ?";
    const iconEmoji = isWorkMode ? '🧠' : '☕️';
    const ntfyIconUrl = `https://emojicdn.elk.sh/${encodeURIComponent(iconEmoji)}`;

    // --- 2. CONFIGURATION DISCORD (2ème Cerveau) ---
    const discordWebhookUrl = "https://discordapp.com/api/webhooks/1481244962103365795/admhCTVeKxs8F-j5H-r_v0OdaZOne5tEsHGwK-WxJfJszTTK1-EYiNrSewhozSjdj0zh";
    
    // On formate la liste des tâches avec des petits tirets
    const tasksFormatted = sessionTasks.length > 0 
      ? sessionTasks.map(tache => `> 🔹 ${tache}`).join('\n')
      : `> 🔹 Mode Focus Libre`;

    const discordMessage = isWorkMode 
      ? `🍅 **Session Terminée ! (${workDuration} min)**\n**Objectifs accomplis :**\n${tasksFormatted}`
      : `☕ **Pause Terminée !**\nC'est l'heure de s'y remettre.`;
    
    // --- 3. ENVOI DES DEUX ALERTES ---
    try {
      // Envoi vers le téléphone (ntfy)
      await fetch('https://ntfy.sh/mon_application_organisation', {
        method: 'POST',
        body: ntfyMessage, 
        headers: { 
          'Title': ntfyTitle, 
          'Tags': isWorkMode ? 'brain,tada' : 'coffee,battery', 
          'Priority': 'high',
          'Icon': ntfyIconUrl 
        }
      });
      console.log("✅ Notification Ntfy envoyée sur le téléphone !");

      // Envoi vers Discord
      await fetch(discordWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: discordMessage })
      });
      console.log("✅ Message archivé dans Discord !");

      // 🧹 ON VIDE LA LISTE POUR LE PROCHAIN POMODORO !
      if (isWorkMode) {
        setSessionTasks([]);
      }

    } catch (err) {
      console.error("❌ Erreur d'envoi (Ntfy ou Discord):", err);
    }
  };

  const toggleTimer = () => setIsActive(!isActive);

  const resetTimer = () => {
    setIsActive(false);
    setTimeLeft(isWorkMode ? workDuration * 60 : breakDuration * 60);
  };

  const switchMode = (mode) => {
    setIsActive(false);
    setIsWorkMode(mode === 'work');
  };

  // Calcul du cercle SVG
  const totalTime = isWorkMode ? workDuration * 60 : breakDuration * 60;
  const percentage = ((totalTime - timeLeft) / totalTime) * 100;
  const strokeDashoffset = 440 - (440 * percentage) / 100;

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="timer-page" onClick={() => setShowTaskMenu(false)}>
      <div className="timer-header">
        <h1 className="timer-app-title">Pomodoro</h1>
        <div className="segmented-picker">
          <button className={isWorkMode ? 'active' : ''} onClick={() => switchMode('work')}>
            <Brain size={16} /> <span>Focus</span>
          </button>
          <button className={!isWorkMode ? 'active' : ''} onClick={() => switchMode('break')}>
            <Coffee size={16} /> <span>Pause</span>
          </button>
        </div>
      </div>

      <div className="timer-container">
        
        {/* --- ZONE D'INTENTION DU POMODORO --- */}
        {isWorkMode && (
          <div className="pomodoro-intention-section" style={{ marginBottom: '30px', textAlign: 'center', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            
            {/* Champ de saisie */}
            <div style={{ position: 'relative', width: '100%', maxWidth: '300px' }} onClick={e => e.stopPropagation()}>
              <input 
                type="text" 
                placeholder="Sur quoi vas-tu travailler ?" 
                value={taskInput}
                onChange={(e) => setTaskInput(e.target.value)}
                onFocus={() => setShowTaskMenu(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && taskInput.trim()) {
                    setSessionTasks([...sessionTasks, taskInput]);
                    setTaskInput("");
                    setShowTaskMenu(false);
                  }
                }}
                style={{ 
                  width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #E5E5EA',
                  backgroundColor: '#F2F2F7', fontSize: '15px', color: '#1C1C1E', outline: 'none'
                }}
              />
              
              {/* Menu déroulant avec tes vraies tâches du jour */}
              {showTaskMenu && availableTasks.length > 0 && (
                <div style={{ 
                  position: 'absolute', top: '110%', left: 0, right: 0, background: 'white', 
                  border: '1px solid #E5E5EA', borderRadius: '12px', zIndex: 10, 
                  maxHeight: '200px', overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' 
                }}>
                  {availableTasks.map(t => (
                    <div 
                      key={t.id} 
                      onClick={() => {
                        setSessionTasks([...sessionTasks, t.text]);
                        setTaskInput("");
                        setShowTaskMenu(false);
                      }}
                      style={{ 
                        padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #F2F2F7', 
                        textAlign: 'left', color: '#1C1C1E', fontSize: '15px' 
                      }}
                    >
                      {t.text}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Affichage des tâches sélectionnées pour ce chrono */}
            {sessionTasks.length > 0 && (
              <div style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', maxWidth: '300px' }}>
                {sessionTasks.map((t, index) => (
                  <span key={index} style={{ 
                    background: '#5856D6', color: 'white', padding: '6px 12px', 
                    borderRadius: '20px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' 
                  }}>
                    {t}
                    <button 
                      onClick={() => setSessionTasks(sessionTasks.filter((_, i) => i !== index))} 
                      style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: 0, display: 'flex' }}
                    >
                      <X size={14} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
        {/* --- FIN ZONE D'INTENTION --- */}

        <div className="timer-display">
          <svg className="timer-svg" viewBox="0 0 160 160">
            <circle className="timer-bg" cx="80" cy="80" r="70" />
            <circle 
              className="timer-progress" 
              cx="80" cy="80" r="70" 
              style={{ 
                strokeDashoffset, 
                stroke: isWorkMode ? '#007AFF' : '#34C759' 
              }} 
            />
          </svg>
          <div className="timer-text">
            <span className="time">{formatTime(timeLeft)}</span>
            <span className="mode-label">{isWorkMode ? 'FOCUS' : 'PAUSE'}</span>
          </div>
        </div>

        <div className="timer-controls">
            <button className="control-btn secondary" onClick={resetTimer}>
                <RotateCcw size={24} />
            </button>
            
            <button className={`control-btn play-pause ${isActive ? 'active' : ''}`} onClick={toggleTimer}>
                {isActive ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" style={{ marginLeft: '4px' }} />}
            </button>

            <button className="control-btn secondary" onClick={() => setShowSettings(true)}>
                <Settings size={24} />
            </button>
        </div>
      </div>

      {/* MODAL DE RÉGLAGES PERSONNALISÉS */}
      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal-sheet settings-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Réglages</h2>
              <button className="modal-close-btn" onClick={() => setShowSettings(false)}><X size={20} /></button>
            </div>
            
            <div className="settings-body">
              <div className="setting-item">
                <div className="setting-info">
                  <span className="setting-label">Durée du Focus</span>
                  <span className="setting-value">{workDuration} min</span>
                </div>
                <input 
                  type="range" min="5" max="90" step="5" 
                  value={workDuration} 
                  onChange={(e) => setWorkDuration(parseInt(e.target.value))}
                  style={{ accentColor: '#007AFF' }}
                />
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <span className="setting-label">Durée de la Pause</span>
                  <span className="setting-value">{breakDuration} min</span>
                </div>
                <input 
                  type="range" min="1" max="30" step="1" 
                  value={breakDuration} 
                  onChange={(e) => setBreakDuration(parseInt(e.target.value))}
                  style={{ accentColor: '#34C759' }}
                />
              </div>

              <button className="settings-save-btn" onClick={() => setShowSettings(false)}>
                Terminé
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}