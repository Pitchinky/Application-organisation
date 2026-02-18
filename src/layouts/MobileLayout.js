import React from 'react';
import BottomNav from '../components/mobile/BottomNav';

export default function MobileLayout({ children, activeTab, setActiveTab, setShowAddModal, setShowCalMenu, showCalMenu }) {
  return (
    <div className="layout-wrapper mobile">
      <div className="mobile-content-container">
        {children}
      </div>
      <BottomNav 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onAddClick={() => setShowAddModal(true)}
        onFilterClick={() => setShowCalMenu(!showCalMenu)}
      />
    </div>
  );
}