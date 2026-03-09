import React, { useState, useEffect } from 'react';
import { 
  Plus, Minus, Check, Target, Flame, BarChart2, 
  Calendar, X, MoreVertical, Award, Trash2, ChevronLeft, ChevronRight 
} from 'lucide-react';
import { db } from '../firebaseConfig';
import { collection, doc, onSnapshot, updateDoc, addDoc, deleteDoc } from "firebase/firestore";
import './HabitView.css';

const PRESET_COLORS = ["#FF3B30", "#FF9500", "#FFCC00", "#34C759", "#007AFF", "#AF52DE", "#FF2D55"];
const EMOJIS = ["🎯", "💧", "🏃‍♂️", "🧘", "📖", "🍎", "💪", "😴", "💊", "🚶"];
const DAYS = [
  { id: 1, label: 'L' }, { id: 2, label: 'M' }, { id: 3, label: 'M' },
  { id: 4, label: 'J' }, { id: 5, label: 'V' }, { id: 6, label: 'S' }, { id: 0, label: 'D' }
];

export default function HabitView() {
  const [habits, setHabits] = useState([]);
  const [activeTab, setActiveTab] = useState('week'); 
  
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [weekOffset, setWeekOffset] = useState(0); 
  
  const [showModal, setShowModal] = useState(false);
  const [activeMenu, setActiveMenu] = useState(null);

  // Formulaire nouvelle habitude
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("🎯");
  const [color, setColor] = useState("#007AFF");
  const [type, setType] = useState('binary'); // 'binary' (simple) ou 'counter' (compteur)
  const [target, setTarget] = useState(1);
  const [unit, setUnit] = useState("");
  const [freq, setFreq] = useState([1, 2, 3, 4, 5, 6, 0]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "habits"), (snap) => {
      setHabits(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  const getWeekDays = () => {
    return [...Array(7)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (3 - i) + (weekOffset * 7));
      return d.toISOString().split('T')[0];
    });
  };

  const getDayProductivity = (date) => {
    if (habits.length === 0) return 0;
    const completed = habits.filter(h => (h.progress?.[date] || 0) >= h.target).length;
    return (completed / habits.length) * 100;
  };

  const updateProgress = async (habit, val) => {
    const current = habit.progress?.[selectedDate] || 0;
    await updateDoc(doc(db, "habits", habit.id), {
      [`progress.${selectedDate}`]: Math.max(0, current + val)
    });
  };

  const handleAdd = async () => {
    if (!name) return;
    await addDoc(collection(db, "habits"), {
      name, icon, color, type,
      target: type === 'counter' ? Number(target) : 1, 
      unit: type === 'counter' ? unit : "", 
      frequency: freq, 
      progress: {}
    });
    
    // Reset du formulaire
    setShowModal(false);
    setName(""); setTarget(1); setUnit(""); setType('binary'); setIcon("🎯");
  };

  const calculateStreak = (habit) => {
    const prog = habit.progress || {};
    let currentStreak = 0;
    let checkDate = new Date(todayStr);

    if ((prog[todayStr] || 0) < habit.target) {
      checkDate.setDate(checkDate.getDate() - 1);
    }

    while (true) {
      const dStr = checkDate.toISOString().split('T')[0];
      if ((prog[dStr] || 0) >= habit.target) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else { break; }
    }
    return currentStreak;
  };

  const changeWeek = (direction) => {
    const newOffset = weekOffset + direction;
    setWeekOffset(newOffset);
    const d = new Date();
    d.setDate(d.getDate() + (newOffset * 7));
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const isCurrentWeek = weekOffset === 0;
  const selectedDateObj = new Date(selectedDate);
  const monthLabel = selectedDateObj.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const formattedMonth = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  return (
    <div className="habit-container">
      <header className="habit-header">
        <div className="header-top">
          <div className="title-area">
            <div className="title-block">
              <h1 className="title">Habitudes</h1>
              {activeTab === 'week' && <span className="month-subtitle">{formattedMonth}</span>}
            </div>
            {activeTab === 'week' && (
              <div className="week-nav">
                <button onClick={() => changeWeek(-1)}><ChevronLeft size={20} /></button>
                <button onClick={() => changeWeek(1)} disabled={isCurrentWeek} style={{ opacity: isCurrentWeek ? 0.3 : 1 }}><ChevronRight size={20} /></button>
              </div>
            )}
          </div>
          <div className="tab-picker">
            <button className={activeTab === 'week' ? 'active' : ''} onClick={() => setActiveTab('week')}><Calendar size={18}/></button>
            <button className={activeTab === 'stats' ? 'active' : ''} onClick={() => setActiveTab('stats')}><BarChart2 size={18}/></button>
          </div>
        </div>

        {activeTab === 'week' && (
          <div className="week-strip">
            {getWeekDays().map(date => {
              const isSel = date === selectedDate;
              const prod = getDayProductivity(date);
              const d = new Date(date);
              const circ = 2 * Math.PI * 16;
              const isToday = date === todayStr;

              return (
                <button key={date} className={`day-btn ${isSel ? 'sel' : ''}`} onClick={() => setSelectedDate(date)}>
                  <span className="label" style={{ color: isToday ? '#007AFF' : '#8E8E93' }}>{d.toLocaleDateString('fr', {weekday: 'narrow'})}</span>
                  <div className="ring">
                    <svg width="40" height="40">
                      <circle cx="20" cy="20" r="16" className="bg"/>
                      <circle cx="20" cy="20" r="16" className="prog" style={{strokeDasharray: circ, strokeDashoffset: circ - (prod/100)*circ, stroke: prod === 100 ? '#34C759' : '#007AFF'}}/>
                    </svg>
                    <span className="num" style={{ color: isToday ? '#007AFF' : '' }}>{d.getDate()}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </header>

      <main className="habit-content">
        {activeTab === 'week' ? (
          <div className="habit-grid">
            {habits.map(h => {
              const val = h.progress?.[selectedDate] || 0;
              // Rétrocompatibilité : Si pas de type, on devine selon target/unit
              const habitType = h.type || (h.target > 1 || h.unit ? 'counter' : 'binary');
              const perc = Math.min((val / h.target) * 100, 100);
              const isDone = val >= h.target;

              return (
                <div key={h.id} className="habit-card">
                  <div className="card-bg" style={{ width: `${perc}%`, backgroundColor: h.color + '20' }} />
                  <div className="card-inner">
                    <div className="info">
                      <span className="icon-box" style={{backgroundColor: h.color + '15', color: h.color}}>{h.icon}</span>
                      <div>
                        <p className="name">{h.name}</p>
                        <p className="meta">
                          {habitType === 'counter' ? `${val} / ${h.target} ${h.unit}` : (isDone ? 'Complété' : 'À faire')}
                        </p>
                      </div>
                    </div>
                    <div className="actions">
                      {habitType === 'counter' ? (
                        <>
                          <button onClick={() => updateProgress(h, -1)} className="btn-s"><Minus size={16}/></button>
                          <button onClick={() => updateProgress(h, 1)} className="btn-s plus" style={{background: h.color}}><Plus size={16} color="white"/></button>
                        </>
                      ) : (
                        <button 
                          onClick={() => updateProgress(h, isDone ? -1 : 1)} 
                          className="btn-s" 
                          style={{background: isDone ? h.color : '#F2F2F7', color: isDone ? '#FFF' : '#1C1C1E'}}
                        >
                          <Check size={18} color={isDone ? "#FFF" : "#C7C7CC"} strokeWidth={3} />
                        </button>
                      )}
                      <button className="btn-more" onClick={() => setActiveMenu(activeMenu === h.id ? null : h.id)}><MoreVertical size={16}/></button>
                      
                      {activeMenu === h.id && (
                        <div className="menu-drop">
                          <button onClick={() => deleteDoc(doc(db, 'habits', h.id))} className="del"><Trash2 size={14}/> Supprimer</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="stats-grid">
            {habits.map(h => {
              const currentStreak = calculateStreak(h);
              const totalDone = Object.keys(h.progress || {}).filter(d => h.progress[d] >= h.target).length;
              return (
                <div key={h.id} className="stat-card" style={{borderColor: h.color + '30'}}>
                  <div className="stat-header"><span className="stat-icon" style={{color: h.color}}>{h.icon}</span><h3>{h.name}</h3></div>
                  <div className="stat-metrics">
                     <div className="stat-box"><span className="stat-val">{currentStreak}</span><span className="stat-lbl">Série (j)</span><Flame size={20} className="bg-icon" color="#FF9500" /></div>
                     <div className="stat-box"><span className="stat-val">{currentStreak}</span><span className="stat-lbl">Record</span><Award size={20} className="bg-icon" color="#AF52DE" /></div>
                     <div className="stat-box"><span className="stat-val">{totalDone}</span><span className="stat-lbl">Validés</span><Check size={20} className="bg-icon" color="#34C759" /></div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <button className="fab" onClick={() => setShowModal(true)}><Plus size={24}/></button>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-head"><h3>Nouvelle Habitude</h3> <button className="close-btn" onClick={() => setShowModal(false)}><X size={20}/></button></div>
            <div className="modal-body">
              
              <div className="row"><span className="emoji-p">{icon}</span><input placeholder="Nom (Ex: Lire, Eau...)" value={name} onChange={e => setName(e.target.value)}/></div>
              
              <div className="emoji-list">{EMOJIS.map(e => <button key={e} onClick={() => setIcon(e)} className={icon===e?'active':''}>{e}</button>)}</div>
              
              {/* SÉLECTEUR DE TYPE */}
              <div className="type-selector-ios">
                <button className={type === 'binary' ? 'active' : ''} onClick={() => setType('binary')}>Simple (Oui/Non)</button>
                <button className={type === 'counter' ? 'active' : ''} onClick={() => setType('counter')}>Compteur</button>
              </div>

              {/* N'AFFICHER OBJECTIF/UNITÉ QUE SI "COMPTEUR" EST CHOISI */}
              {type === 'counter' && (
                <div className="input-group">
                  <div className="field"><span>Objectif</span><input type="number" value={target} onChange={e=>setTarget(e.target.value)}/></div>
                  <div className="field"><span>Unité</span><input placeholder="pas, ml..." value={unit} onChange={e=>setUnit(e.target.value)}/></div>
                </div>
              )}

              <div className="freq-list">{DAYS.map(d => <button key={d.id} className={freq.includes(d.id)?'active':''} onClick={() => setFreq(freq.includes(d.id)?freq.filter(x=>x!==d.id):[...freq, d.id])}>{d.label}</button>)}</div>
              <div className="color-list">{PRESET_COLORS.map(c => <button key={c} className={color===c?'active':''} style={{background:c}} onClick={()=>setColor(c)}/>)}</div>
              <button className="btn-create" onClick={handleAdd}>Créer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}