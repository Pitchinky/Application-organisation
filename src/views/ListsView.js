import React, { useState, useEffect } from 'react';
// On remplace Tray par Inbox ici
import { Plus, ShoppingCart, Inbox, List, CheckCircle2, Circle, Trash2, ChevronLeft } from 'lucide-react';
import { db } from '../firebaseConfig';
import { collection, doc, setDoc, onSnapshot, query } from "firebase/firestore";
import './ListsView.css';

export default function ListsView() {
  const [lists, setLists] = useState([]);
  const [activeListId, setActiveListId] = useState(null); // null = menu principal
  const [newItemText, setNewItemText] = useState("");

  // 1. Charger toutes les listes
  useEffect(() => {
    const q = query(collection(db, "lists"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Initialisation si la base est vide
      if (data.length === 0) {
        setupInitialLists();
      } else {
        setLists(data);
      }
    });
    return () => unsubscribe();
  }, []);

  const setupInitialLists = async () => {
    // Création de l'Inbox (Tâches non plannifiées)
    // On utilise l'icône "inbox"
    await setDoc(doc(db, "lists", "inbox"), { 
      name: "Inbox", 
      icon: "inbox", 
      items: [], 
      color: "#007AFF" 
    });
    // Création de la liste de Courses
    await setDoc(doc(db, "lists", "courses"), { 
      name: "Courses", 
      icon: "cart", 
      items: [], 
      color: "#34C759" 
    });
  };

  const activeList = lists.find(l => l.id === activeListId);

  // 2. Gestion des items
  const addItem = async (e) => {
    e.preventDefault();
    if (!newItemText.trim() || !activeList) return;
    const newItem = { id: Date.now(), text: newItemText, completed: false };
    const updatedItems = [...(activeList.items || []), newItem];
    await setDoc(doc(db, "lists", activeListId), { ...activeList, items: updatedItems });
    setNewItemText("");
  };

  const toggleItem = async (itemId) => {
    const updatedItems = activeList.items.map(item => 
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );
    await setDoc(doc(db, "lists", activeListId), { ...activeList, items: updatedItems });
  };

  const deleteItem = async (itemId) => {
    const updatedItems = activeList.items.filter(item => item.id !== itemId);
    await setDoc(doc(db, "lists", activeListId), { ...activeList, items: updatedItems });
  };

  // 3. Rendu du menu principal
  if (!activeListId) {
    return (
      <div className="lists-container">
        <h1 className="main-title">Mes Listes</h1>
        <div className="lists-grid">
          {lists.map(list => (
            <div key={list.id} className="list-card" onClick={() => setActiveListId(list.id)}>
              <div className="list-card-icon" style={{ backgroundColor: list.color + '20' }}>
                {/* Correction de l'icône ici : Inbox au lieu de Tray */}
                {list.icon === 'inbox' ? <Inbox color={list.color} /> : 
                 list.icon === 'cart' ? <ShoppingCart color={list.color} /> : 
                 <List color={list.color} />}
              </div>
              <div className="list-card-info">
                <span className="list-name">{list.name}</span>
                <span className="list-count">{(list.items || []).length}</span>
              </div>
            </div>
          ))}
          <div className="list-card add-new">
            <Plus color="#8E8E93" />
            <span>Nouvelle liste</span>
          </div>
        </div>
      </div>
    );
  }

  // 4. Rendu d'une liste spécifique
  return (
    <div className="active-list-view">
      <div className="list-header">
        <button className="back-btn" onClick={() => setActiveListId(null)}>
          <ChevronLeft size={28} />
        </button>
        <h1 style={{ color: activeList.color }}>{activeList.name}</h1>
      </div>

      <div className="items-list">
        {(activeList.items || []).map(item => (
          <div key={item.id} className={`list-item ${item.completed ? 'completed' : ''}`}>
            <div className="item-main" onClick={() => toggleItem(item.id)}>
              {item.completed ? <CheckCircle2 color={activeList.color} /> : <Circle color="#C7C7CC" />}
              <span>{item.text}</span>
            </div>
            <button className="delete-btn" onClick={() => deleteItem(item.id)}>
              <Trash2 size={18} color="#FF3B30" />
            </button>
          </div>
        ))}
      </div>

      <form className="quick-add-footer" onSubmit={addItem}>
        <input 
          type="text" 
          placeholder="Ajouter un élément..." 
          value={newItemText}
          onChange={(e) => setNewItemText(e.target.value)}
        />
        <button type="submit" style={{ backgroundColor: activeList.color }}>
          <Plus color="white" />
        </button>
      </form>
    </div>
  );
}