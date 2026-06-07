import React, { useState, useEffect } from 'react';
import api from './api';
import Layout from './components/Layout';
import Toast from './components/Toast';

import Login from './views/Login';
import Dashboard from './views/Dashboard';
import Projects from './views/Projects';
import Activities from './views/Activities';
import Registration from './views/Registration';
import Reports from './views/Reports';
import Users from './views/Users';
import PublicRegistration from './views/PublicRegistration';
import Tracker from './views/Tracker';
import Indicators from './views/Indicators';

import './styles/global.css';

export default function App() {
  const [user, setUser] = useState(null);
  const [currentView, setCurrentView] = useState('dashboard');
  const [theme, setTheme] = useState('light');
  const [toasts, setToasts] = useState([]);
  
  // Shared params for transition navigation (e.g. Activity Table -> Enroll Form)
  const [regParams, setRegParams] = useState(null);

  // Check if we are rendering the public mobile registration form
  const isPublicRoute = new URLSearchParams(window.location.search).get('view') === 'public-register';

  // Load session and theme on mount
  useEffect(() => {
    // 1. Session check
    const storedUser = api.getCurrentUser();
    if (storedUser) {
      setUser(storedUser);
    }

    // 2. Theme check
    const storedTheme = localStorage.getItem('tgh-bims-theme') || 'light';
    setTheme(storedTheme);
    document.documentElement.setAttribute('data-theme', storedTheme);
  }, []);

  const handleToggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('tgh-bims-theme', nextTheme);
  };

  const showToast = (message, type = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    
    // Auto-remove toast after 4 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const handleLoginSuccess = (loggedInUser) => {
    setUser(loggedInUser);
    setCurrentView('dashboard');
  };

  const handleLogout = () => {
    api.logout();
    setUser(null);
    setCurrentView('dashboard');
    showToast('You have signed out successfully.', 'info');
  };

  // Render active view component
  const renderActiveView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard theme={theme} showToast={showToast} />;
      case 'projects':
        return <Projects user={user} showToast={showToast} />;
      case 'activities':
        return (
          <Activities 
            user={user} 
            onViewChange={setCurrentView} 
            setRegParams={setRegParams} 
            showToast={showToast} 
          />
        );
      case 'tracker':
        return <Tracker user={user} showToast={showToast} />;
      case 'indicators':
        return <Indicators user={user} showToast={showToast} />;
      case 'registration':
        return (
          <Registration 
            user={user} 
            regParams={regParams} 
            setRegParams={setRegParams} 
            showToast={showToast} 
          />
        );
      case 'reports':
        return <Reports user={user} showToast={showToast} />;
      case 'users':
        return <Users user={user} showToast={showToast} />;
      default:
        return <Dashboard theme={theme} showToast={showToast} />;
    }
  };

  return (
    <>
      {isPublicRoute ? (
        <PublicRegistration showToast={showToast} />
      ) : user ? (
        <Layout
          user={user}
          currentView={currentView}
          onViewChange={setCurrentView}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          onLogout={handleLogout}
        >
          {renderActiveView()}
        </Layout>
      ) : (
        <Login onLoginSuccess={handleLoginSuccess} showToast={showToast} />
      )}
      
      {/* Toast Notification Tray */}
      <Toast toasts={toasts} onRemove={removeToast} />
    </>
  );
}
