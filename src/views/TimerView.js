import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Coffee, Brain, Settings, X, Check } from 'lucide-react';
import './TimerView.css';

export default function TimerView() {
  // Durées en minutes (par défaut 25 et 5)
  const [workDuration, setWorkDuration] = useState(25);
  const [breakDuration, setBreakDuration] = useState(5);
  
  const [timeLeft, setTimeLeft] = useState(workDuration * 60);
  const [isActive, setIsActive] = useState(false);
  const [isWorkMode, setIsWorkMode] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  
  const timerRef = useRef(null);


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
    const discordWebhookUrl = "https://discordapp.com/api/webhooks/1481244962103365795/admhCTVeKxs8F-j5H-r_v0OdaZOne5tEsHGwK-WxJfJszTTK1-EYiNrSewhozSjdj0zh"; // <-- Mets ton vrai lien ici !
    const discordMessage = isWorkMode 
      ? `🍅 **Pomodoro Terminé !**\nBravo, tu viens de boucler une session de focus de **${workDuration} minutes**.`
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
    <div className="timer-page">
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

            {/* ICI : On remplace Bell par Settings */}
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