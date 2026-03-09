import React, { useState, useEffect } from 'react';
import { 
  Flame, Plus, Check, Calendar as CalendarIcon, 
  BarChart2, X, Target, Award
} from 'lucide-react';
import { db } from '../firebaseConfig';
import { collection, doc, setDoc, onSnapshot, updateDoc, deleteDoc } from "firebase/firestore";
import './HabitView.css';

const PRESET_COLORS = ["#FF3B30", "#FF9500", "#FFCC00", "#34C759", "#007AFF", "#AF52DE", "#FF2D55"];

export default function HabitView() {
  const [activeTab, setActiveTab] = useState('week'); // 'week' ou 'stats'
  const [habits, setHabits] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [newHabitName, setNewHabitName] = useState("");
  const [newHabitColor, setNewHabitColor] = useState("#007AFF");

  const todayStr = new Date().toISOString().split('T')[0];

  // Générer les 7 derniers jours pour l'affichage
  const getLast7Days = () => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().split('T')[0]);
    }
    return days;
  };
  const weekDays = getLast7Days();

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "habits"), (snap) => {
      setHabits(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  const addHabit = async (e) => {
    e.preventDefault();
    if (!newHabitName.trim()) return;
    
    const id = Date.now().toString();
    await setDoc(doc(db, "habits", id), {
      name: newHabitName,
      color: newHabitColor,
      createdAt: new Date().toISOString(),
      completedDates: [] // Tableau des dates "YYYY-MM-DD"
    });
    setNewHabitName("");
    setShowModal(false);
  };

  const toggleHabit = async (habit, dateStr) => {
    const dates = habit.completedDates || [];
    const isCompleted = dates.includes(dateStr);
    
    let newDates;
    if (isCompleted) {
      newDates = dates.filter(d => d !== dateStr);
    } else {
      newDates = [...dates, dateStr];
    }
    
    await updateDoc(doc(db, "habits", habit.id), { completedDates: newDates });
  };

  const deleteHabit = async (id) => {
    if(window.confirm("Supprimer cette habitude ?")) {
      await deleteDoc(doc(db, "habits", id));
    }
  };

  // Calcul du Streak (Série en cours)
  const calculateStreak = (dates) => {
    if (!dates || dates.length === 0) return 0;
    let streak = 0;
    let currentDate = new Date();
    
    // Si on n'a pas validé aujourd'hui, on commence à compter depuis hier
    if (!dates.includes(todayStr)) {
      currentDate.setDate(currentDate.getDate() - 1);
    }

    while (true) {
      const dateString = currentDate.toISOString().split('T')[0];
      if (dates.includes(dateString)) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  };

  return (
    <div className="habit-page">
      <div className="habit-header-premium">
        <h1 className="habit-app-title">Habitudes</h1>
        <div className="segmented-picker">
          <button className={activeTab === 'week' ? 'active' : ''} onClick={() => setActiveTab('week')}>
            <CalendarIcon size={16} fill={activeTab === 'week' ? "currentColor" : "none"} />
            <span>Semaine</span>
          </button>
          <button className={activeTab === 'stats' ? 'active' : ''} onClick={() => setActiveTab('stats')}>
            <BarChart2 size={16} fill={activeTab === 'stats' ? "currentColor" : "none"} />
            <span>Statistiques</span>
          </button>
        </div>
      </div>

      <div className="habit-scroll-area">
        {activeTab === 'week' ? (
          <div className="habits-list">
            {habits.length === 0 && (
              <div className="habit-empty-state">
                <Target size={48} color="#C7C7CC" />
                <p>Commencez à construire de bonnes habitudes aujourd'hui.</p>
              </div>
            )}
            
            {habits.map(habit => {
              const streak = calculateStreak(habit.completedDates);
              const isTodayDone = (habit.completedDates || []).includes(todayStr);

              return (
                <div key={habit.id} className="habit-card">
                  <div className="habit-card-header">
                    <div className="habit-info">
                      <div className="habit-icon" style={{ backgroundColor: habit.color + '20', color: habit.color }}>
                        <Target size={20} />
                      </div>
                      <div>
                        <h3 className="habit-name">{habit.name}</h3>
                        <div className="habit-streak">
                          <Flame size={14} color={streak > 0 ? "#FF9500" : "#C7C7CC"} fill={streak > 0 ? "#FF9500" : "none"} />
                          <span style={{ color: streak > 0 ? '#FF9500' : '#8E8E93' }}>{streak} jours</span>
                        </div>
                      </div>
                    </div>
                    <button 
                      className={`habit-check-btn ${isTodayDone ? 'done' : ''}`}
                      style={{ backgroundColor: isTodayDone ? habit.color : '#F2F2F7', borderColor: isTodayDone ? habit.color : '#E5E5EA' }}
                      onClick={() => toggleHabit(habit, todayStr)}
                    >
                      <Check size={20} color={isTodayDone ? 'white' : '#C7C7CC'} strokeWidth={3} />
                    </button>
                  </div>

                  {/* LA JAUGE DES 7 JOURS */}
                  <div className="habit-week-tracker">
                    {weekDays.map(date => {
                      const isDone = (habit.completedDates || []).includes(date);
                      const isToday = date === todayStr;
                      const dayName = new Date(date).toLocaleDateString('fr-FR', { weekday: 'narrow' });
                      
                      return (
                        <div key={date} className="day-column" onClick={() => toggleHabit(habit, date)}>
                          <span className={`day-label ${isToday ? 'is-today' : ''}`}>{dayName}</span>
                          <div 
                            className={`day-circle ${isDone ? 'filled' : ''} ${isToday ? 'today-circle' : ''}`}
                            style={{ backgroundColor: isDone ? habit.color : '#F2F2F7' }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="habits-stats-grid">
            {habits.map(habit => (
              <div key={habit.id} className="stat-card">
                <button className="delete-habit-btn" onClick={() => deleteHabit(habit.id)}><X size={14} /></button>
                <div className="stat-icon" style={{ color: habit.color }}><Award size={28} /></div>
                <h3>{habit.name}</h3>
                <div className="stat-numbers">
                  <div className="stat-box">
                    <span className="stat-val">{habit.completedDates?.length || 0}</span>
                    <span className="stat-lbl">Total</span>
                  </div>
                  <div className="stat-box">
                    <span className="stat-val">{calculateStreak(habit.completedDates)}</span>
                    <span className="stat-lbl">Série en cours</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="habit-quick-add">
         <button className="new-habit-btn" onClick={() => setShowModal(true)}>
            <Plus size={20} /> Créer une habitude
         </button>
      </div>

      {/* MODAL CRÉATION */}
      {showModal && (
        <div className="habit-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="habit-modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="habit-modal-header">
              <button className="modal-cancel" onClick={() => setShowModal(false)}>Annuler</button>
              <h2>Nouvelle habitude</h2>
              <button className="modal-done" onClick={addHabit} disabled={!newHabitName.trim()}>OK</button>
            </div>
            <div className="modal-body">
              <input type="text" className="modal-input" placeholder="Ex: Lire 10 pages, Méditer..." value={newHabitName} onChange={(e) => setNewHabitName(e.target.value)} autoFocus />
              <div className="selector-label">Couleur</div>
              <div className="color-selector">
                  {PRESET_COLORS.map(color => (
                      <div key={color} className={`color-dot ${newHabitColor === color ? 'active' : ''}`} style={{ backgroundColor: color }} onClick={() => setNewHabitColor(color)} />
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}