/* global gapi, google */
import React, { useState, useEffect } from 'react';
import { 
  Plus, ShoppingCart, Inbox, List, CheckCircle2, Circle, Trash2, ChevronLeft, X,
  Heart, Star, Book, Coffee, Dumbbell, Briefcase, Music, Plane, Car, 
  Home, Pizza, Gift, Camera, Code, Smartphone, Wallet, Tent, Map, 
  GraduationCap, Palette, Utensils, Apple, Beef, Fish, Bath, Package, 
  Snowflake, CupSoda, Cookie
} from 'lucide-react';
import { db } from '../firebaseConfig';
import { collection, doc, setDoc, onSnapshot, query, deleteDoc } from "firebase/firestore";
import './ListsView.css';

const ICONS_MAP = {
  list: List, cart: ShoppingCart, inbox: Inbox, heart: Heart, star: Star,
  book: Book, coffee: Coffee, gym: Dumbbell, work: Briefcase, music: Music,
  travel: Plane, car: Car, home: Home, food: Pizza, gift: Gift,
  photo: Camera, code: Code, tech: Smartphone, money: Wallet, camp: Tent,
  map: Map, study: GraduationCap, art: Palette, restaurant: Utensils
};

const SHOPPING_SECTIONS = [
  { id: 'legumes', label: 'Légumes', icon: Apple, color: '#34C759' },
  { id: 'viande', label: 'Boucherie', icon: Beef, color: '#FF3B30' },
  { id: 'sec', label: 'Sec', icon: Cookie, color: '#FF9500' },
  { id: 'frais', label: 'Frais', icon: Package, color: '#007AFF' },
  { id: 'surgeles', label: 'Surgelés', icon: Snowflake, color: '#5AC8FA' },
  { id: 'boissons', label: 'Boissons', icon: CupSoda, color: '#FFCC00' },
  { id: 'hygiene', label: 'Hygiène', icon: Bath, color: '#AF52DE' },
  { id: 'autre', label: 'Autre', icon: List, color: '#8E8E93' }
];

const PRESET_COLORS = ["#FF3B30", "#FF9500", "#FFCC00", "#34C759", "#007AFF", "#5856D6", "#AF52DE"];

export default function ListsView() {
  const [lists, setLists] = useState([]);
  const [activeListId, setActiveListId] = useState(null);
  const [newItemText, setNewItemText] = useState("");
  const [selectedSection, setSelectedSection] = useState('autre');

  const [showModal, setShowModal] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newListColor, setNewListColor] = useState("#007AFF");
  const [newListIcon, setNewListIcon] = useState("list");

  useEffect(() => {
    const q = query(collection(db, "lists"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setLists(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const IconRenderer = ({ iconName, color, size = 24 }) => {
    const IconComponent = ICONS_MAP[iconName] || List;
    return <IconComponent color={color} size={size} />;
  };

  const handleCreateList = async () => {
    if (!newListName.trim()) return;
    const id = Date.now().toString();
    await setDoc(doc(db, "lists", id), {
      name: newListName,
      color: newListColor,
      icon: newListIcon,
      items: []
    });
    setNewListName("");
    setShowModal(false);
  };

  const handleDeleteList = async (id, e) => {
    e.stopPropagation();
    if (window.confirm("Supprimer cette liste définitivement ?")) {
      await deleteDoc(doc(db, "lists", id));
    }
  };

  const activeList = lists.find(l => l.id === activeListId);

  const getProgress = (items = []) => {
    if (items.length === 0) return 0;
    const completed = items.filter(i => i.completed).length;
    return (completed / items.length) * 100;
  };

  const addItem = async (e) => {
    e.preventDefault();
    if (!newItemText.trim() || !activeList) return;
    const newItem = { 
        id: Date.now(), 
        text: newItemText, 
        completed: false,
        section: activeList.icon === 'cart' ? selectedSection : null 
    };
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

  if (!activeListId) {
    return (
      <div className="lists-container">
        <h1 className="main-title">Mes Listes</h1>
        <div className="lists-grid">
          {lists.map(list => {
            const progress = getProgress(list.items);
            return (
              <div key={list.id} className="list-card" onClick={() => setActiveListId(list.id)}>
                <div className="list-card-top">
                  <div className="list-card-icon" style={{ backgroundColor: list.color + '20' }}>
                    <IconRenderer iconName={list.icon} color={list.color} />
                  </div>
                  <button className="delete-list-x" onClick={(e) => handleDeleteList(list.id, e)}>
                    <X size={14} color="#AEAEB2" />
                  </button>
                </div>
                <div className="list-card-info">
                  <span className="list-name">{list.name}</span>
                  <span className="list-count">{(list.items || []).length}</span>
                </div>
                <div className="progress-wrapper">
                  <div className="progress-fill" style={{ width: `${progress}%`, backgroundColor: list.color }} />
                </div>
              </div>
            );
          })}
          <div className="list-card add-new" onClick={() => setShowModal(true)}>
            <div className="plus-circle"><Plus color="#007AFF" /></div>
            <span>Nouvelle liste</span>
          </div>
        </div>

        {showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal-sheet" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <button className="modal-cancel" onClick={() => setShowModal(false)}>Annuler</button>
                <h2>Nouvelle liste</h2>
                <button className="modal-done" onClick={handleCreateList} disabled={!newListName.trim()}>OK</button>
              </div>
              <div className="modal-body scrollable">
                <div className="icon-preview" style={{ backgroundColor: newListColor }}>
                    <IconRenderer iconName={newListIcon} color="white" size={40} />
                </div>
                <input type="text" className="modal-input" placeholder="Nom de la liste" value={newListName} onChange={(e) => setNewListName(e.target.value)} autoFocus />
                <div className="selector-label">Couleur</div>
                <div className="color-selector">
                    {PRESET_COLORS.map(color => (
                        <div key={color} className={`color-dot ${newListColor === color ? 'active' : ''}`} style={{ backgroundColor: color }} onClick={() => setNewListColor(color)} />
                    ))}
                </div>
                <div className="selector-label">Icône</div>
                <div className="icon-library-grid">
                    {Object.keys(ICONS_MAP).map(iconKey => {
                        const IconComp = ICONS_MAP[iconKey];
                        return (
                          <div key={iconKey} className={`icon-item ${newListIcon === iconKey ? 'active' : ''}`} onClick={() => setNewListIcon(iconKey)} style={{ color: newListIcon === iconKey ? newListColor : '#8E8E93' }} >
                            <IconComp size={22} />
                          </div>
                        );
                    })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- RENDU D'UNE LIGNE D'ITEM ---
  const ItemRow = ({ item }) => (
    <div key={item.id} className={`list-item ${item.completed ? 'completed' : ''}`}>
      <div className="item-main" onClick={() => toggleItem(item.id)}>
        {item.completed ? <CheckCircle2 color={activeList.color} /> : <Circle color="#C7C7CC" />}
        <span>{item.text}</span>
      </div>
      <button className="delete-btn" onClick={() => deleteItem(item.id)}>
        <Trash2 size={18} color="#FF3B30" />
      </button>
    </div>
  );

  return (
    <div className="active-list-view">
      <div className="list-header">
        <button className="back-btn" onClick={() => setActiveListId(null)}>
          <ChevronLeft size={28} />
        </button>
        <div className="header-title-group">
            <IconRenderer iconName={activeList.icon} color={activeList.color} size={32} />
            <h1 style={{ color: activeList.color }}>{activeList.name}</h1>
        </div>
      </div>

      <div className="items-list">
        {activeList.icon === 'cart' ? (
          <>
            {SHOPPING_SECTIONS.map(sec => {
              const secItems = (activeList.items || []).filter(i => !i.completed && i.section === sec.id);
              if (secItems.length === 0) return null;
              return (
                <div key={sec.id} className="list-section">
                  <h3 className="list-section-title" style={{ color: sec.color }}>
                    <sec.icon size={14} style={{ marginRight: 8 }} />
                    {sec.label}
                  </h3>
                  {secItems.map(item => <ItemRow key={item.id} item={item} />)}
                </div>
              );
            })}
            {(activeList.items || []).some(i => i.completed) && (
              <div className="list-section completed-section">
                <h3 className="list-section-title">Déjà pris</h3>
                {(activeList.items || []).filter(i => i.completed).map(item => <ItemRow key={item.id} item={item} />)}
              </div>
            )}
          </>
        ) : (
          (activeList.items || []).map(item => <ItemRow key={item.id} item={item} />)
        )}
      </div>

      <div className="quick-add-container">
        {activeList.icon === 'cart' && (
          <div className="section-picker">
            {SHOPPING_SECTIONS.map(sec => (
              <button 
                key={sec.id} 
                className={`section-chip ${selectedSection === sec.id ? 'active' : ''}`}
                onClick={() => setSelectedSection(sec.id)}
                style={{ 
                  backgroundColor: selectedSection === sec.id ? sec.color : 'white',
                  color: selectedSection === sec.id ? 'white' : '#8E8E93'
                }}
              >
                <sec.icon size={14} />
                <span>{sec.label}</span>
              </button>
            ))}
          </div>
        )}
        <form className="quick-add-footer" onSubmit={addItem}>
          <input type="text" placeholder="Ajouter un élément..." value={newItemText} onChange={(e) => setNewItemText(e.target.value)} />
          <button type="submit" style={{ backgroundColor: activeList.color }}>
            <Plus color="white" />
          </button>
        </form>
      </div>
    </div>
  );
}