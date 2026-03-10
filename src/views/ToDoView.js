import React, { useState, useEffect } from 'react';
import { 
  Star, Inbox, CheckCircle2, Circle, Hash, 
  AlertCircle, Calendar as CalendarIcon, ChevronRight, Plus, FolderInput, X, Trash2, AlertTriangle,
  Calendar, CalendarClock, CalendarX, Link2
} from 'lucide-react';
import { Icon } from '@iconify/react';
import { db } from '../firebaseConfig';
import { collection, onSnapshot, query, doc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import './TodoView.css'; 
import { getCategoryData } from '../utils/categoryLogic';


export default function TodoView({ events = [], onToggleSubtask, onLinkTaskToEvent }) {

  // --- ÉTATS (STATES) : La mémoire locale de ton application ---
  const [activeTab, setActiveTab] = useState('today'); // 'today' (Étoile) ou 'inbox' (Boîte de réception)
  const [allLists, setAllLists] = useState([]);      // Stocke toutes tes catégories (Sport, Travail...)
  const [inboxTasks, setInboxTasks] = useState([]);   // Stocke les tâches "volantes" (non triées)
  const [newTaskText, setNewTaskText] = useState(""); // Ce que tu tapes dans la barre d'ajout
  const [movingTask, setMovingTask] = useState(null); // La tâche que tu es en train de déplacer
  const [taskToDelete, setTaskToDelete] = useState(null); // La tâche en attente de suppression
  const [schedulingTask, setSchedulingTask] = useState(null); // Tâche en cours de planification par date
  const [linkingTask, setLinkingTask] = useState(null); // Stocke la tâche qu'on veut lier

  // On récupère la date du jour au format YYYY-MM-DD 
  const todayStr = new Date().toISOString().split('T')[0];

  // --- SYNCHRONISATION FIREBASE (TEMPS RÉEL) ---
  useEffect(() => {
    // Écoute les changements dans la collection "lists"
    const unsubLists = onSnapshot(collection(db, "lists"), (snap) => {
      setAllLists(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    // Écoute les changements dans la collection "todos" (ton Inbox)
    const unsubInbox = onSnapshot(collection(db, "todos"), (snap) => {
      setInboxTasks(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => { unsubLists(); unsubInbox(); };
  }, []);

  // --- ACTIONS : Fonctions de gestion des données ---

  // AJOUTER UNE TÂCHE
  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTaskText.trim()) return; // Empêche d'ajouter du vide

    const id = Date.now().toString(); // Génère un ID unique basé sur le temps
    const newTask = {
      id: id,
      text: newTaskText,
      completed: false,
      createdAt: new Date().toISOString(),
      // Si on est dans l'onglet "Aujourd'hui", on met la date du jour direct
      dueDate: activeTab === 'today' ? todayStr : null 
    };

    await setDoc(doc(db, "todos", id), newTask);
    setNewTaskText(""); // Vide le champ après l'envoi
  };

  // COCHER / DÉCOCHER UNE TÂCHE
  const handleToggleTask = async (task) => {
    if (task.isSubtask) {
      onToggleSubtask(task.eventId, task.subtasksArray, task.id);
    } else if (task.isFromList) {
      // Cas où la tâche est dans une liste spécifique (Sport, etc.)
      const list = allLists.find(l => l.id === task.listId);
      const updatedItems = list.items.map(item => 
        item.id === task.id ? { ...item, completed: !item.completed } : item
      );
      await updateDoc(doc(db, "lists", task.listId), { items: updatedItems });
    } else {
      // Cas où la tâche est dans l'Inbox
      await updateDoc(doc(db, "todos", task.id), { completed: !task.completed });
    }
  };

  // SUPPRESSION (Étape 1 : Demander confirmation)
  const requestDelete = (task) => {
    setTaskToDelete(task);
  };

  // SUPPRESSION (Étape 2 : Exécution après clic sur "Supprimer")
  const confirmDelete = async () => {
    if (!taskToDelete) return;

    if (taskToDelete.isFromList) {
      const list = allLists.find(l => l.id === taskToDelete.listId);
      const updatedItems = list.items.filter(item => item.id !== taskToDelete.id);
      await updateDoc(doc(db, "lists", taskToDelete.listId), { items: updatedItems });
    } else {
      await deleteDoc(doc(db, "todos", taskToDelete.id));
    }
    setTaskToDelete(null); // Ferme la modal
  };

  // DÉPLACER UNE TÂCHE VERS UNE LISTE
  const moveTaskToList = async (listId) => {
    if (!movingTask) return;
    const targetList = allLists.find(l => l.id === listId);
    const newItem = {
      id: movingTask.id,
      text: movingTask.text,
      completed: movingTask.completed,
      createdAt: movingTask.createdAt,
      dueDate: null
    };
    // 1. Ajoute dans la nouvelle liste
    const updatedItems = [...(targetList.items || []), newItem];
    await updateDoc(doc(db, "lists", listId), { items: updatedItems });
    // 2. Supprime de l'Inbox
    await deleteDoc(doc(db, "todos", movingTask.id));
    setMovingTask(null); // Ferme la modal
  };

  // PLANIFIER POUR AUJOURD'HUI 
  const handlePlanForToday = async (task) => {
    if (task.isFromList) {
      const list = allLists.find(l => l.id === task.listId);
      const updatedItems = list.items.map(item => 
        item.id === task.id ? { ...item, dueDate: todayStr } : item
      );
      await updateDoc(doc(db, "lists", task.listId), { items: updatedItems });
    } else {
      await updateDoc(doc(db, "todos", task.id), { dueDate: todayStr });
    }
  };

  // DÉ-PLANIFIER (Enlever la date)
  const handleUnplan = async (task) => {
    if (task.isFromList) {
      const list = allLists.find(l => l.id === task.listId);
      const updatedItems = list.items.map(item => 
        item.id === task.id ? { ...item, dueDate: null } : item
      );
      await updateDoc(doc(db, "lists", task.listId), { items: updatedItems });
    } else {
      await updateDoc(doc(db, "todos", task.id), { dueDate: null });
    }
  };

  // PLANIFIER À UNE DATE PRÉCISE
  const handleSetCustomDate = async (task, date) => {
    if (task.isFromList) {
      const list = allLists.find(l => l.id === task.listId);
      const updatedItems = list.items.map(item => 
        item.id === task.id ? { ...item, dueDate: date } : item
      );
      await updateDoc(doc(db, "lists", task.listId), { items: updatedItems });
    } else {
      await updateDoc(doc(db, "todos", task.id), { dueDate: date });
    }
    setSchedulingTask(null);
  };

  // LOGIQUE DE TRI : Récupère toutes les tâches datées de toutes les listes
  const getAggregatedTasks = (events = []) => {
    let overdue = [];
    let today = [];
  
    // --- 1. RÉCUPÉRATION DES LISTES CLASSIQUES ---
    allLists.forEach(list => {
      // On ignore toujours la liste de courses
      if (list.icon !== 'cart') {
        (list.items || []).forEach(item => {
          if (item.dueDate) {
            const task = { 
              ...item, 
              listId: list.id, 
              listName: list.name, 
              listColor: list.color, 
              isFromList: true 
            };
  
            // EN RETARD : Toujours affiché si non complété
            if (item.dueDate < todayStr && !item.completed) {
              overdue.push(task);
            } 
            // AUJOURD'HUI : On l'ajoute UNIQUEMENT si elle n'est pas liée à un événement
            // (Si elle est liée, elle sera ajoutée plus bas via la boucle 'events')
            else if (item.dueDate === todayStr && !item.linkedEventId) {
              today.push(task);
            }
          }
        });
      }
    });
  
    // --- 2. RÉCUPÉRATION DE L'INBOX ---
    inboxTasks.forEach(task => {
      const taskWithMeta = { ...task, listName: 'Inbox', listColor: '#007AFF', isFromList: false };
      
      if (task.dueDate < todayStr && !task.completed) {
        overdue.push(taskWithMeta);
      } 
      // Même logique : on cache si c'est déjà lié à un événement
      else if (task.dueDate === todayStr && !task.linkedEventId) {
        today.push(taskWithMeta);
      }
    });
  
    // --- 3. RÉCUPÉRATION DES TÂCHES LIÉES AUX ÉVÉNEMENTS ---
    events.forEach(event => {
      if (event.subtasks && event.subtasks.length > 0) {
        // On récupère le style de l'événement (ex: Travail -> Bleu)
        const catData = getCategoryData(event.summary); 
  
        event.subtasks.forEach(sub => {
          // On essaie de retrouver la couleur originale de la liste (ex: Thales)
          const sourceList = allLists.find(l => l.id === sub.sourceListId);
  
          today.push({
            ...sub,
            isSubtask: true,         
            eventId: event.id,       
            subtasksArray: event.subtasks,
            
            // IDENTITÉ : On affiche le nom de la liste source (Thales)
            listName: sub.sourceListName || event.summary, 
            // LIEN : On garde le nom de l'événement pour l'afficher en badge (Travail)
            linkedEventSummary: event.summary, 
            
            // STYLE : On donne la priorité à la couleur de la liste source
            listColor: sourceList ? sourceList.color : catData.color,
            icon: catData.icon
          });
        });
      }
    });
  
    return { overdue, today };
  };

  // LOGIQUE de TRI : Récupère les tâches sans date, groupées par liste
  const getUnplannedTasksByList = () => {
    return allLists
      .filter(list => list.icon !== 'cart')
      .map(list => ({
        ...list,
        // On ne garde que les items qui n'ont PAS de dueDate
        unplannedItems: (list.items || []).filter(item => !item.dueDate)
      }))
      // On ne garde que les listes qui ont au moins une tâche à planifier
      .filter(list => list.unplannedItems.length > 0);
  };

  const unplannedLists = getUnplannedTasksByList();
  const { overdue, today } = getAggregatedTasks(events);
  const inboxOnly = inboxTasks.filter(t => !t.dueDate); // Tâches sans date pour l'onglet Inbox

  return (
    <div className="todo-page">

      {/* HEADER : Titre et Sélecteur (Tabs) */}
      <div className="todo-header-premium">
        <h1 className="todo-app-title">Focus</h1>
        <div className="segmented-picker">

          <button className={activeTab === 'today' ? 'active' : ''} onClick={() => setActiveTab('today')}>
            <Star size={16} fill={activeTab === 'today' ? "currentColor" : "none"} />
            <span>Aujourd'hui</span>
          </button>

          <button className={activeTab === 'planifier' ? 'active' : ''} onClick={() => setActiveTab('planifier')}>
            <Calendar size={16} fill={activeTab === 'planifier' ? "currentColor" : "none"} />
            <span>A Planifier</span>
          </button>

          <button className={activeTab === 'inbox' ? 'active' : ''} onClick={() => setActiveTab('inbox')}>
            <Inbox size={16} fill={activeTab === 'inbox' ? "currentColor" : "none"} />
            <span>Inbox</span>
          </button>

        </div>
      </div>

      {/* CORPS : Zone de défilement des tâches */}
      <div className="todo-scroll-area">

        {/* --- ONGLET TODAY --- */}
        {activeTab === 'today' && (
          <div className="todo-sections-gap">
            
            {/* Section En Retard */}
            {overdue.length > 0 && (
              <section>
                <div className="section-label overdue"><AlertCircle size={14} /> EN RETARD</div>
                {overdue.map(t => <TodoCard 
                key={t.id} 
                task={t} onToggle={() => handleToggleTask(t)} 
                onDelete={() => requestDelete(t)}
                onUnplan={() => handleUnplan(t)}
                onLink={setLinkingTask} />
                )}
              </section>
            )}

            {/* Section Aujourd'hui */}
            <section>
              <div className="section-label"><CalendarIcon size={14} /> AUJOURD'HUI</div>
              {today.length > 0 ? (
                today.map(t => <TodoCard 
                  key={t.id} 
                  task={t} 
                  onToggle={() => handleToggleTask(t)} 
                  onDelete={() => requestDelete(t)} 
                  onUnplan={() => handleUnplan(t)}
                  onLink={setLinkingTask}
                  />
                  
                )
              ) : (
                <div className="todo-empty-card">Rien pour aujourd'hui</div>
              )}
            </section>

          </div>

        )}

        {/* --- ONGLET À PLANIFIER --- */}
        {activeTab === 'planifier' && (
          <div className="todo-sections-gap">
            {unplannedLists.length > 0 ? (
              unplannedLists.map(list => (
                <section key={list.id}>
                  {/* Titre de la liste avec sa couleur */}
                  <div className="section-label" style={{ color: list.color }}>
                    <Hash size={14} /> {list.name.toUpperCase()}
                  </div>
                  {list.unplannedItems.map(t => (
                    <TodoCard 
                      key={t.id} 
                      task={{ ...t, listId: list.id, listName: list.name, listColor: list.color, isFromList: true }} 
                      onToggle={() => handleToggleTask({ ...t, listId: list.id, isFromList: true })} 
                      onDelete={() => requestDelete({ ...t, listId: list.id, isFromList: true })}
                      onPlan={() => handlePlanForToday({ ...t, listId: list.id, isFromList: true })} 
                      onCustomDate={() => setSchedulingTask({ ...t, listId: list.id, isFromList: true })}
                    />
                  ))}
                </section>
              ))
            ) : (
              <div className="todo-empty-card">Toutes les tâches sont planifiées !</div>
            )}
          </div>
        )}

        {/* --- ONGLET INBOX --- */}
        {activeTab === 'inbox' && (
          <section>

            <div className="section-label"><Inbox size={14} /> À CLASSER</div>
            {inboxOnly.map(t => (
              <TodoCard 
                key={t.id} 
                task={{...t, listName: 'Inbox', listColor: '#007AFF', isFromList: false}} 
                onToggle={() => handleToggleTask(t)}
                onDelete={() => requestDelete({...t, isFromList: false})}
                onMove={() => setMovingTask(t)}
                onPlan={() => handlePlanForToday(t)}
                onCustomDate={() => setSchedulingTask(t)}
                onLink={setLinkingTask}
              />
            ))}
          </section>
        )}
        

      </div>

      {/* MODAL DE SUPPRESSION (Style Alerte iOS) */}
      {taskToDelete && (
        <div className="confirm-modal-overlay" onClick={() => setTaskToDelete(null)}>
          <div className="confirm-modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="confirm-icon-wrapper">
              <AlertTriangle size={32} color="#FF3B30" />
            </div>
            <h3>Supprimer la tâche ?</h3>
            <p>Cette action est irréversible.</p>
            <div className="confirm-actions">
              <button className="confirm-btn-delete" onClick={confirmDelete}>Supprimer</button>
              <button className="confirm-btn-cancel" onClick={() => setTaskToDelete(null)}>Annuler</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE DÉPLACEMENT (Ranger dans une liste) */}
      {movingTask && (
        <div className="move-modal-overlay" onClick={() => setMovingTask(null)}>
          <div className="move-modal" onClick={e => e.stopPropagation()}>
            <div className="move-modal-header">
              <h3>Ranger dans...</h3>
              <button onClick={() => setMovingTask(null)}><X size={20} /></button>
            </div>
            <div className="move-list-options">
              {allLists.map(list => (
                <button key={list.id} onClick={() => moveTaskToList(list.id)} className="move-option">
                  <div className="move-option-icon" style={{backgroundColor: list.color + '20', color: list.color}}>
                    <Hash size={16} />
                  </div>
                  <span>{list.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL CALENDRIER (Choisir une date précise) */}
      {schedulingTask && (
        <div className="confirm-modal-overlay" onClick={() => setSchedulingTask(null)}>
          <div className="confirm-modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="confirm-icon-wrapper">
              <CalendarClock size={32} color="#5856D6" />
            </div>
            <h3>Planifier pour quand ?</h3>
            <input 
              type="date" 
              className="ios-date-input"
              onChange={(e) => handleSetCustomDate(schedulingTask, e.target.value)}
            />
            <div className="confirm-actions">
              <button className="confirm-btn-cancel" onClick={() => setSchedulingTask(null)}>Annuler</button>
            </div>
          </div>
        </div>
      )}

       {/* MODAL LINK (Lier à un évenement) */}
      {linkingTask && (
        <div className="move-modal-overlay" onClick={() => setLinkingTask(null)}>
          <div className="move-modal" onClick={e => e.stopPropagation()}>
            <div className="move-modal-header">
              <h3>Lier à un événement</h3>
              <button onClick={() => setLinkingTask(null)}><X size={20} /></button>
            </div>
            <div className="move-list-options">
              {events.filter(e => !e.allDay).map(event => {
                const cat = getCategoryData(event.summary);
                return (
                  <button 
                    key={event.id} 
                    className="move-option"
                    onClick={() => {
                      onLinkTaskToEvent(linkingTask, event.id);
                      setLinkingTask(null);
                    }}
                  >
                    <div className="move-option-icon" style={{backgroundColor: cat.color + '20', color: cat.color}}>
                      <Icon icon={cat.icon} />
                    </div>
                    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-start'}}>
                      <span style={{fontWeight: '600'}}>{event.summary}</span>
                    <span style={{fontSize: '12px', opacity: 0.6}}>
                      {new Date(event.start.dateTime || event.start.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* BARRE D'AJOUT RAPIDE (Fixe en bas) */}
      {(activeTab === 'today' || activeTab === 'inbox') && (
      <div className="todo-quick-add">
        <form onSubmit={handleAddTask} className="quick-add-form">
          <div className="add-icon-circle"><Plus size={20} color="white" /></div>
          <input 
            type="text" 
            placeholder={activeTab === 'today' ? "Ajouter à aujourd'hui..." : "Ajouter à l'inbox..."} 
            value={newTaskText}
            onChange={(e) => setNewTaskText(e.target.value)}
          />
        </form>
      </div>
      )}

    </div>
  );
}

// SOUS-COMPOSANT : La carte individuelle d'une tâche
function TodoCard({ task, onToggle, onMove, onDelete, onPlan, onCustomDate, onUnplan, onLink }) {

  const IconComponent = task.isSubtask ? <Icon icon={task.icon} /> : <Hash size={10} />;

  return (
    <div className={`todo-card ${task.completed ? 'is-done' : ''}`}>
      <div className="todo-card-left" onClick={onToggle}>
        <div className="custom-checkbox">
          {task.completed ? <CheckCircle2 color="#34C759" size={24} /> : <Circle color="#C7C7CC" size={24} />}
        </div>
        <div className="todo-card-info">
          <span className="todo-card-text">{task.text}</span>
          
          <div className="todo-card-meta">
            {/* 1. BADGE PRINCIPAL */}
            {/* Si c'est une subtask native (sans liste source), on affiche l'icône de catégorie */}
            {/* Sinon (tâche de liste ou liée), on affiche le Hash # */}
            <span className="meta-tag" style={{ color: task.listColor }}>
              {task.isSubtask && !task.sourceListId ? (
                <Icon icon={task.icon} />
              ) : (
                <Hash size={10} />
              )} 
              {task.listName}
            </span>
            
            {/* 2. BADGE SECONDAIRE (ÉVÉNEMENT) */}
            {/* On ne l'affiche QUE si la tâche provient d'une liste ET qu'elle est liée à un événement */}
            {task.sourceListId && task.linkedEventSummary && (
              <span className="meta-tag" style={{ color: '#8E8E93', opacity: 0.7 }}>
                <Calendar size={10} /> {task.linkedEventSummary}
              </span>
            )}
          </div>

        </div>
      </div>
      
      <div className="todo-card-actions">

        {/* BOUTON ÉTOILE : Planifier pour Aujourd'hui */}
        {onPlan && !task.completed && (
          <button className="action-button" onClick={(e) => {e.stopPropagation(); onPlan();}}>
            <Star size={18} color="#D1BE21" fill="#D1BE21" />
          </button>
        )}

        {/* BOUTON CALENDRIER : Choisir une date précise */}
        {onCustomDate && !task.completed && (
          <button className="action-button" onClick={(e) => {e.stopPropagation(); onCustomDate();}}>
            <CalendarIcon size={18} color="#5856D6" />
          </button>
        )}

        {/* BOUTON DÉ-PLANIFIER : Enlever d'aujourd'hui */}
        {onUnplan && !task.completed && (
          <button className="action-button" onClick={(e) => {e.stopPropagation(); onUnplan();}}>
            <CalendarX size={18} color="#FF9500" />
          </button>
        )}

        {/* On affiche le bouton de déplacement seulement si la tâche n'est pas finie et qu'on a la fonction onMove */}
        {onMove && !task.completed && (
          <button className="action-button move" onClick={(e) => {e.stopPropagation(); onMove();}}>
            <FolderInput size={18} color="#007AFF" />
          </button>
        )}

        {onLink && !task.isSubtask && !task.completed && (
          <button className="action-button" onClick={(e) => {e.stopPropagation(); onLink(task);}}>
            <Link2 size={18} color="#5856D6" />
          </button>
        )}

        <button className="action-button delete" onClick={(e) => {e.stopPropagation(); onDelete();}}>
          <Trash2 size={18} color="#FF3B30" />
        </button>

      </div>
    </div>
  );
}