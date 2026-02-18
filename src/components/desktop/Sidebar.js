import React from 'react';
import { Inbox, Layout, Calendar as CalIcon, Settings } from 'lucide-react';

import './Sidebar.css';

export default function Sidebar({ activeTab, setActiveTab }) {
  return (
    <nav className="desktop-sidebar">
      <div className="sidebar-logo">S</div>
      <div className="sidebar-menu">
        <button className={`sidebar-btn ${activeTab==='timeline'?'active':''}`} onClick={()=>setActiveTab('timeline')}>
          <Layout size={20} /> Timeline
        </button>
        <button className={`sidebar-btn ${activeTab==='inbox'?'active':''}`} onClick={()=>setActiveTab('inbox')}>
          <Inbox size={20} /> Inbox
        </button>
        <button className={`sidebar-btn ${activeTab==='shopping'?'active':''}`} onClick={()=>setActiveTab('shopping')}>
           <CalIcon size={20} /> Courses
        </button>

        <button className={`sidebar-btn ${activeTab==='settings'?'active':''}`} onClick={()=>setActiveTab('settings')}>
           <Settings size={20} /> Réglages
        </button>
        
      </div>
      <div className="sidebar-bottom">
        <button className="sidebar-btn"><Settings size={20} /></button>
      </div>
    </nav>
  );
}