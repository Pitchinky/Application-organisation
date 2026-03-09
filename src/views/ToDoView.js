import React, { useState, useEffect } from 'react';
import { 
  Star, Inbox, CheckCircle2, Circle, Hash, 
  AlertCircle, Calendar as CalendarIcon, ChevronRight, Plus, FolderInput, X, Trash2, AlertTriangle
} from 'lucide-react';
import { db } from '../firebaseConfig';
import { collection, onSnapshot, query, doc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import './TodoView.css'; 

export default function TodoView() {
  const [activeTab, setActiveTab] = useState('today');
  const [allLists, setAllLists] = useState([]);
  const [inboxTasks, setInboxTasks] = useState([]);
  const [newTaskText, setNewTaskText] = useState("");
  const [movingTask, setMovingTask] = useState(null); 
  const [taskToDelete, setTaskToDelete] = useState(null); // Tâche en attente de suppression

  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    const unsubLists = onSnapshot(collection(db, "lists"), (snap) => {
      setAllLists(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubInbox = onSnapshot(collection(db, "todos"), (snap) => {
      setInboxTasks(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => { unsubLists(); unsubInbox(); };
  }, []);

  // --- ACTIONS ---
  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;

    const id = Date.now().toString();
    const newTask = {
      id: id,
      text: newTaskText,
      completed: false,
      createdAt: new Date().toISOString(),
      dueDate: activeTab === 'today' ? todayStr : null 
    };

    await setDoc(doc(db, "todos", id), newTask);
    setNewTaskText("");
  };

  const handleToggleTask = async (task) => {
    if (task.isFromList) {
      const list = allLists.find(l => l.id === task.listId);
      const updatedItems = list.items.map(item => 
        item.id === task.id ? { ...item, completed: !item.completed } : item
      );
      await updateDoc(doc(db, "lists", task.listId), { items: updatedItems });
    } else {
      await updateDoc(doc(db, "todos", task.id), { completed: !task.completed });
    }
  };

  // Lance la demande de confirmation
  const requestDelete = (task) => {
    setTaskToDelete(task);
  };

  // Exécute la suppression réelle
  const confirmDelete = async () => {
    if (!taskToDelete) return;

    if (taskToDelete.isFromList) {
      const list = allLists.find(l => l.id === taskToDelete.listId);
      const updatedItems = list.items.filter(item => item.id !== taskToDelete.id);
      await updateDoc(doc(db, "lists", taskToDelete.listId), { items: updatedItems });
    } else {
      await deleteDoc(doc(db, "todos", taskToDelete.id));
    }
    setTaskToDelete(null);
  };

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
    const updatedItems = [...(targetList.items || []), newItem];
    await updateDoc(doc(db, "lists", listId), { items: updatedItems });
    await deleteDoc(doc(db, "todos", movingTask.id));
    setMovingTask(null);
  };

  const getAggregatedTasks = () => {
    let overdue = [];
    let today = [];
    allLists.forEach(list => {
      if (list.icon !== 'cart') {
        (list.items || []).forEach(item => {
          if (item.dueDate) {
            const task = { ...item, listId: list.id, listName: list.name, listColor: list.color, isFromList: true };
            if (item.dueDate < todayStr && !item.completed) overdue.push(task);
            else if (item.dueDate === todayStr || (item.dueDate < todayStr && item.completed)) today.push(task);
          }
        });
      }
    });
    inboxTasks.forEach(task => {
        const taskWithMeta = { ...task, listName: 'Inbox', listColor: '#007AFF', isFromList: false };
        if (task.dueDate === todayStr) today.push(taskWithMeta);
    });
    return { overdue, today };
  };

  const { overdue, today } = getAggregatedTasks();
  const inboxOnly = inboxTasks.filter(t => !t.dueDate);

  return (
    <div className="todo-page">
      <div className="todo-header-premium">
        <h1 className="todo-app-title">Focus</h1>
        <div className="segmented-picker">
          <button className={activeTab === 'today' ? 'active' : ''} onClick={() => setActiveTab('today')}>
            <Star size={16} fill={activeTab === 'today' ? "currentColor" : "none"} />
            <span>Aujourd'hui</span>
          </button>
          <button className={activeTab === 'inbox' ? 'active' : ''} onClick={() => setActiveTab('inbox')}>
            <Inbox size={16} fill={activeTab === 'inbox' ? "currentColor" : "none"} />
            <span>Inbox</span>
          </button>
        </div>
      </div>

      <div className="todo-scroll-area">
        {activeTab === 'today' ? (
          <div className="todo-sections-gap">
            {overdue.length > 0 && (
              <section>
                <div className="section-label overdue"><AlertCircle size={14} /> EN RETARD</div>
                {overdue.map(t => <TodoCard key={t.id} task={t} onToggle={() => handleToggleTask(t)} onDelete={() => requestDelete(t)} />)}
              </section>
            )}
            <section>
              <div className="section-label"><CalendarIcon size={14} /> AUJOURD'HUI</div>
              {today.length > 0 ? (
                today.map(t => <TodoCard key={t.id} task={t} onToggle={() => handleToggleTask(t)} onDelete={() => requestDelete(t)} />)
              ) : (
                <div className="todo-empty-card">Rien pour aujourd'hui</div>
              )}
            </section>
          </div>
        ) : (
          <section>
            <div className="section-label"><Inbox size={14} /> À CLASSER</div>
            {inboxOnly.map(t => (
              <TodoCard 
                key={t.id} 
                task={{...t, listName: 'Inbox', listColor: '#007AFF', isFromList: false}} 
                onToggle={() => handleToggleTask(t)}
                onDelete={() => requestDelete({...t, isFromList: false})}
                onMove={() => setMovingTask(t)}
              />
            ))}
          </section>
        )}
      </div>

      {/* MODAL DE SUPPRESSION (ALERTE) */}
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

      {/* MODAL DE DÉPLACEMENT */}
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
    </div>
  );
}

function TodoCard({ task, onToggle, onMove, onDelete }) {
  return (
    <div className={`todo-card ${task.completed ? 'is-done' : ''}`}>
      <div className="todo-card-left" onClick={onToggle}>
        <div className="custom-checkbox">
          {task.completed ? <CheckCircle2 color="#34C759" size={24} /> : <Circle color="#C7C7CC" size={24} />}
        </div>
        <div className="todo-card-info">
          <span className="todo-card-text">{task.text}</span>
          <div className="todo-card-meta">
            <span className="meta-tag" style={{ color: task.listColor }}>
              <Hash size={10} /> {task.listName}
            </span>
          </div>
        </div>
      </div>
      
      <div className="todo-card-actions">
        {onMove && !task.completed && (
          <button className="action-button move" onClick={(e) => {e.stopPropagation(); onMove();}}>
            <FolderInput size={18} color="#007AFF" />
          </button>
        )}
        <button className="action-button delete" onClick={(e) => {e.stopPropagation(); onDelete();}}>
          <Trash2 size={18} color="#FF3B30" />
        </button>
      </div>
    </div>
  );
}