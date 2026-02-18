import React from 'react';
import Sidebar from '../components/desktop/Sidebar';

export default function DesktopLayout({ children, activeTab, setActiveTab }) {
  return (
    <div className="layout-wrapper desktop">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="desktop-main-content">
        {children}
      </main>
    </div>
  );
}