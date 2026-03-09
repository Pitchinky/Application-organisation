import React from 'react';
import { 
  Layout, 
  Settings, 
  Check, 
  List, 
  Target, 
  Timer, 
  User 
} from 'lucide-react';
import './Sidebar.css';

export default function Sidebar({ activeTab, setActiveTab }) {
  return (
    <nav className="desktop-sidebar">
      {/* Logo ou Initiale */}
      <div className="sidebar-logo">S</div>

      <div className="sidebar-menu">
        {/* FOCUS (Anciennement To do) */}
        <button 
          className={`sidebar-btn ${activeTab === 'to_do' ? 'active' : ''}`} 
          onClick={() => setActiveTab('to_do')}
        >
          <Check size={20} /> <span>Focus</span>
        </button>

        {/* TIMELINE */}
        <button 
          className={`sidebar-btn ${activeTab === 'timeline' ? 'active' : ''}`} 
          onClick={() => setActiveTab('timeline')}
        >
          <Layout size={20} /> <span>Timeline</span>
        </button>

        {/* POMODORO */}
        <button 
          className={`sidebar-btn ${activeTab === 'timer' ? 'active' : ''}`} 
          onClick={() => setActiveTab('timer')}
        >
          <Timer size={20} /> <span>Pomodoro</span>
        </button>

        {/* LISTES */}
        <button 
          className={`sidebar-btn ${activeTab === 'lists' ? 'active' : ''}`} 
          onClick={() => setActiveTab('lists')}
        >
          <List size={20} /> <span>Listes</span>
        </button>

        {/* HABITUDES */}
        <button 
          className={`sidebar-btn ${activeTab === 'habit' ? 'active' : ''}`} 
          onClick={() => setActiveTab('habit')}
        >
          <Target size={20} /> <span>Habitudes</span>
        </button>
      </div>

      {/* SECTION DU BAS : RÉGLAGES / PROFIL */}
      <div className="sidebar-bottom">
        <button 
          className={`sidebar-btn ${activeTab === 'settings' ? 'active' : ''}`} 
          onClick={() => setActiveTab('settings')}
        >
          <Settings size={20} /> <span>Réglages</span>
        </button>
        
        {/* On peut imaginer un bouton profil ici plus tard */}
        <button className="sidebar-btn profile">
          <User size={20} />
        </button>
      </div>
    </nav>
  );
}