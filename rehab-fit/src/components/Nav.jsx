import React from 'react';

const LINKS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'live', label: 'Live Session' },
  { id: 'image', label: 'Analyze Image' },
  { id: 'history', label: 'History' },
];

export default function Nav({ currentPage, onNavigate }) {
  return (
    <nav className="nav" role="navigation" aria-label="Main navigation">
      <button
        className="nav-brand"
        onClick={() => onNavigate('dashboard')}
        aria-label="REHAB-FIT home"
      >
        <svg className="nav-logo" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <rect width="32" height="32" rx="8" fill="#0d1b2a"/>
          <circle cx="16" cy="8" r="3" fill="#00d4aa"/>
          <line x1="16" y1="11" x2="16" y2="20" stroke="#00d4aa" strokeWidth="2.5" strokeLinecap="round"/>
          <line x1="16" y1="14" x2="10" y2="18" stroke="#00d4aa" strokeWidth="2" strokeLinecap="round"/>
          <line x1="16" y1="14" x2="22" y2="18" stroke="#00d4aa" strokeWidth="2" strokeLinecap="round"/>
          <line x1="16" y1="20" x2="12" y2="27" stroke="#00d4aa" strokeWidth="2" strokeLinecap="round"/>
          <line x1="16" y1="20" x2="20" y2="27" stroke="#00d4aa" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        <span className="nav-brand-text">REHAB<span>-FIT</span></span>
      </button>

      <div className="nav-links" role="list">
        {LINKS.map(link => (
          <button
            key={link.id}
            role="listitem"
            className={`nav-link${currentPage === link.id ? ' active' : ''}`}
            onClick={() => onNavigate(link.id)}
            aria-current={currentPage === link.id ? 'page' : undefined}
          >
            {link.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
