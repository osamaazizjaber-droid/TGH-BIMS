import React, { useState } from 'react';
import api from '../api';
import tghLogo from '../assets/tgh_logo.jpg';

export default function Login({ onLoginSuccess, showToast }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    try {
      const user = await api.login(email, password);
      showToast(`Welcome back, ${user.name}!`, 'success');
      onLoginSuccess(user);
    } catch (err) {
      showToast(err.message || 'Invalid email or password credentials.', 'danger');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-view-container">
      <div className="login-card">
        <div className="text-center mb-4">
          <div className="brand-logo mx-auto mb-2" style={{ width: '50px', height: '50px', background: 'none', boxShadow: 'none' }}>
            <img src={tghLogo} alt="TGH" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '4px' }} />
          </div>
          <h4 className="fw-bold text-white mb-1">TGH BIMS Portal</h4>
          <p className="small text-muted">Beneficiary Information Management System</p>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group mb-3">
            <label className="form-label text-light small" htmlFor="login-email">Registered Email Address</label>
            <input 
              type="email" 
              id="login-email" 
              className="form-control" 
              placeholder="yourname@tgh.org" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required 
            />
          </div>
          
          <div className="form-group mb-3">
            <label className="form-label text-light small" htmlFor="login-password">Password</label>
            <input 
              type="password" 
              id="login-password" 
              className="form-control" 
              placeholder="••••••••" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required 
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary w-100 py-2 mt-2 fw-bold"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Signing In...
              </>
            ) : (
              <>
                <i className="bi bi-box-arrow-in-right"></i> Sign In
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
