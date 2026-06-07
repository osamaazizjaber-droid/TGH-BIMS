import React, { useState } from 'react';
import tghLogo from '../assets/tgh_logo.jpg';

export default function Layout({ user, currentView, onViewChange, theme, onToggleTheme, onLogout, children }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Avatar initials helper
  const getInitials = (name) => {
    if (!name) return 'US';
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  const role = user ? user.role : 'Guest';

  // Role permissions checks
  const canSeeRegistrations = ['System Administrator', 'Project Manager', 'Data Entry Officer'].includes(role);
  const canSeeReports = ['System Administrator', 'Project Manager', 'MEAL Officer'].includes(role);
  const canSeeUsers = role === 'System Administrator';

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'bi-speedometer2', visible: true },
    { id: 'projects', label: 'Projects', icon: 'bi-folder2-open', visible: true },
    { id: 'activities', label: 'Activities', icon: 'bi-calendar-event', visible: true },
    { id: 'tracker', label: 'Activity Tracker', icon: 'bi-geo-alt-fill', visible: canSeeReports },
    { id: 'indicators', label: 'Project Indicators', icon: 'bi-clipboard-data', visible: canSeeReports },
    { id: 'registration', label: 'Registrations', icon: 'bi-person-add', visible: canSeeRegistrations },
    { id: 'reports', label: 'Reports & MEAL', icon: 'bi-bar-chart-line', visible: canSeeReports },
    { id: 'users', label: 'Users Registry', icon: 'bi-person-fill-gear', visible: canSeeUsers }
  ];

  const handleMenuClick = (viewId) => {
    onViewChange(viewId);
    setMobileMenuOpen(false);
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100vw' }}>
      
      {/* SIDEBAR NAVIGATION */}
      <aside className={`sidebar ${mobileMenuOpen ? 'active' : ''}`} id="app-sidebar">
        <div className="sidebar-brand">
          <div className="brand-logo" style={{ background: 'none', boxShadow: 'none' }}>
            <img src={tghLogo} alt="TGH" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '4px' }} />
          </div>
          <div className="brand-text">TGH BIMS</div>
        </div>
        
        <ul className="sidebar-menu">
          {menuItems.filter(item => item.visible).map(item => (
            <li 
              key={item.id} 
              className={`menu-item ${currentView === item.id ? 'active' : ''}`}
              onClick={() => handleMenuClick(item.id)}
            >
              <a href="#" onClick={(e) => e.preventDefault()}>
                <i className={`bi ${item.icon}`}></i>
                <span>{item.label}</span>
              </a>
            </li>
          ))}
          
          {/* Log Out Button */}
          <li className="menu-item mt-auto border-top border-secondary pt-2" onClick={onLogout}>
            <a href="#" className="text-danger" onClick={(e) => e.preventDefault()}>
              <i className="bi bi-box-arrow-left"></i>
              <span>Log Out</span>
            </a>
          </li>
        </ul>
        
        <div className="sidebar-footer">
          <div className="user-avatar">{getInitials(user?.name)}</div>
          <div className="user-info">
            <div className="user-name">{user?.name || 'Loading...'}</div>
            <div className="user-role text-warning">{role}</div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="app-container">
        
        {/* APP HEADER */}
        <header className="app-header">
          <div className="d-flex align-items-center gap-2">
            <button 
              className="btn-icon d-md-none" 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              title="Toggle Menu"
            >
              <i className="bi bi-list"></i>
            </button>
            <div className="header-title-wrap">
              <h2 className="fw-bold text-main">
                {currentView.charAt(0).toUpperCase() + currentView.slice(1).replace('-', ' ')} View
              </h2>
            </div>
          </div>
          
          <div className="header-actions">
            {/* Theme Toggle Button */}
            <button className="btn-icon" onClick={onToggleTheme} title="Toggle Dark Mode">
              <i className={`bi ${theme === 'light' ? 'bi-moon' : 'bi-sun'}`}></i>
            </button>
            
            <div className="d-flex align-items-center gap-2">
              <span className="small text-muted d-none d-md-inline">{user?.email}</span>
              <div className="user-avatar" style={{ width: '32px', height: '32px', fontSize: '0.8rem' }}>
                {getInitials(user?.name)}
              </div>
              <span className="badge bg-warning text-dark px-2 py-1 fw-bold">{role}</span>
            </div>
          </div>
        </header>

        {/* WORKSPACE CONTENT */}
        <main className="main-content">
          {children}
        </main>
      </div>

    </div>
  );
}
