import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [tasks, setTasks] = useState([
    { id: 1, time: "08:00", title: "Routine Matinale", desc: "Café & Yoga", color: "#FF9500" },
    { id: 2, time: "10:30", title: "Projet React", desc: "Coder l'interface", color: "#007AFF" },
    { id: 3, time: "12:30", title: "Déjeuner", desc: "Pause bien méritée", color: "#34C759" }
  ]);

  const requestNotif = () => {
    Notification.requestPermission();
  };

  return (
    <div className="app-container">
      <header>
        <div className="date-header">
          <p>{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1>Aujourd'hui</h1>
        </div>
        <button onClick={requestNotif} className="notif-btn">🔔</button>
      </header>

      <div className="timeline">
        {tasks.map(task => (
          <div key={task.id} className="task-row">
            <div className="time-column">{task.time}</div>
            <div className="task-card" style={{ borderLeft: `6px solid ${task.color}` }}>
              <div className="task-content">
                <b>{task.title}</b>
                <span>{task.desc}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <button className="add-btn">+</button>
    </div>
  );
}

export default App;