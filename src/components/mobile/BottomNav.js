import React from 'react';
import { Inbox, Layout, Calendar as CalIcon, Settings, Plus } from 'lucide-react';
import './BottomNav.css';

export default function BottomNav({ activeTab, setActiveTab, onAddClick, onFilterClick }) {
  return (
    <nav className="mobile-bottom-nav">
       <button className={`nav-item ${activeTab==='inbox'?'active':''}`} onClick={()=>setActiveTab('inbox')}>
         <Inbox size={24} /><span>Inbox</span>
       </button>
       <button className={`nav-item ${activeTab==='timeline'?'active':''}`} onClick={()=>setActiveTab('timeline')}>
         <Layout size={24} /><span>Timeline</span>
       </button>
       <div className="nav-add-container">
         <button className="nav-add-btn" onClick={onAddClick}>
           <Plus size={28} color="white" />
         </button>
       </div>
       <button className={`nav-item ${activeTab==='shopping'?'active':''}`} onClick={()=>setActiveTab('shopping')}>
         <CalIcon size={24} /><span>Courses</span>
       </button>
       <button className={`nav-item ${activeTab==='settings'?'active':''}`} onClick={()=>setActiveTab('settings')}>
          <Settings size={24} />
          <span>Réglages</span>
        </button>
    </nav>
  );
}