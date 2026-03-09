import React from 'react';
import { Inbox, Layout, Calendar as CalIcon, Settings, Plus, Check } from 'lucide-react';
import './BottomNav.css';

export default function BottomNav({ activeTab, setActiveTab, onAddClick, onFilterClick }) {
  return (
    <nav className="mobile-bottom-nav">

       <button className={`nav-item ${activeTab==='to_do'?'active':''}`} onClick={()=>setActiveTab('to_do')}>
         <Check size={24} /><span>To do</span>
       </button>

       <button className={`nav-item ${activeTab==='timeline'?'active':''}`} onClick={()=>setActiveTab('timeline')}>
         <Layout size={24} /><span>Timeline</span>
       </button>

       <div className="nav-add-container">
         <button className="nav-add-btn" onClick={onAddClick}>
           <Plus size={28} color="white" />
         </button>

       </div>
       <button className={`nav-item ${activeTab==='lists'?'active':''}`} onClick={()=>setActiveTab('lists')}>
         <CalIcon size={24} /><span>Listes</span>
       </button>

       <button className={`sidebar-btn ${activeTab==='habit'?'active':''}`} onClick={()=>setActiveTab('habit')}>
           <CalIcon size={20} /> Habit
        </button>


       <button className={`nav-item ${activeTab==='settings'?'active':''}`} onClick={()=>setActiveTab('settings')}>
          <Settings size={24} />
          <span>Réglages</span>
        </button>


    </nav>
  );
}