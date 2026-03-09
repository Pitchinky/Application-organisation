import React from 'react';
import { Layout, Settings, Plus, Check, List, Target, Timer } from 'lucide-react';
import './BottomNav.css';

export default function BottomNav({ activeTab, setActiveTab, onAddClick }) {
  return (
    <nav className="mobile-bottom-nav">

       {/* --- 3 ONGLETS À GAUCHE --- */}
       <button className={`nav-item ${activeTab === 'to_do' ? 'active' : ''}`} onClick={() => setActiveTab('to_do')}>
         <Check size={24} />
         <span>Focus</span>
       </button>

       <button className={`nav-item ${activeTab === 'timeline' ? 'active' : ''}`} onClick={() => setActiveTab('timeline')}>
         <Layout size={24} />
         <span>Timeline</span>
       </button>

       <button className={`nav-item ${activeTab === 'pomodoro' ? 'active' : ''}`} onClick={() => setActiveTab('pomodoro')}>
         <Timer size={24} />
         <span>Pomodoro</span>
       </button>


       {/* --- BOUTON CENTRAL D'AJOUT --- */}
       <div className="nav-add-container">
         <button className="nav-add-btn" onClick={onAddClick}>
           <Plus size={28} color="white" />
         </button>
       </div>


       {/* --- 3 ONGLETS À DROITE --- */}
       <button className={`nav-item ${activeTab === 'lists' ? 'active' : ''}`} onClick={() => setActiveTab('lists')}>
         <List size={24} />
         <span>Listes</span>
       </button>

       <button className={`nav-item ${activeTab === 'habit' ? 'active' : ''}`} onClick={() => setActiveTab('habit')}>
          <Target size={24} /> 
          <span>Habitudes</span>
        </button>

       <button className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
          <Settings size={24} />
          <span>Réglages</span>
        </button>

    </nav>
  );
}