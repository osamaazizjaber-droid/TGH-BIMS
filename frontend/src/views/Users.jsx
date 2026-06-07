import React, { useState, useEffect } from 'react';
import api from '../api';

export default function Users({ user, showToast }) {
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [editingUser, setEditingUser] = useState({
    email: '',
    name: '',
    role: 'Data Entry Officer',
    assignedProjects: 'All',
    status: 'Active',
    password: ''
  });

  const [isEditMode, setIsEditMode] = useState(false);

  const fetchUsers = () => {
    setLoading(true);
    api.getUsers()
      .then(data => {
        setUsersList(data);
      })
      .catch(err => {
        showToast(err.message || 'Failed to load user list', 'danger');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    if (user?.role === 'System Administrator') {
      fetchUsers();
    }
  }, [user]);

  if (user?.role !== 'System Administrator') {
    return (
      <div className="glass-card text-center py-5 text-danger">
        <i className="bi bi-shield-exclamation fs-1"></i>
        <h4 className="fw-bold mt-3">Access Denied</h4>
        <p className="small">You do not have administrative permissions to access the BIMS user accounts registry.</p>
      </div>
    );
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditingUser(prev => ({ ...prev, [name]: value }));
  };

  const handleCreateNewClick = () => {
    setEditingUser({
      email: '',
      name: '',
      role: 'Data Entry Officer',
      assignedProjects: 'All',
      status: 'Active',
      password: ''
    });
    setIsEditMode(false);
    setShowModal(true);
  };

  const handleEditClick = (u) => {
    setEditingUser({
      email: u.email,
      name: u.name,
      role: u.role,
      assignedProjects: u.assignedProjects || 'All',
      status: u.status || 'Active',
      password: ''
    });
    setIsEditMode(true);
    setShowModal(true);
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    if (!editingUser.email || !editingUser.name) {
      return showToast('Please enter both name and email.', 'warning');
    }
    if (!isEditMode && !editingUser.password) {
      return showToast('Please enter a password for the new account.', 'warning');
    }

    setSubmitting(true);
    try {
      await api.saveUser(editingUser);
      showToast(`User ${editingUser.email} saved successfully!`, 'success');
      setShowModal(false);
      fetchUsers();
    } catch (err) {
      showToast(err.message || 'Failed to save user account.', 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (emailToDelete) => {
    if (emailToDelete.toLowerCase() === user.email.toLowerCase()) {
      return showToast('You cannot delete your own active administrator account!', 'warning');
    }
    if (!window.confirm(`Are you sure you want to delete user account ${emailToDelete}?`)) {
      return;
    }

    try {
      await api.deleteUser(emailToDelete);
      showToast(`User account ${emailToDelete} has been deleted.`, 'success');
      fetchUsers();
    } catch (err) {
      showToast(err.message || 'Failed to delete user account.', 'danger');
    }
  };

  return (
    <div className="container-fluid p-0">
      
      {/* HEADER CONTROLS */}
      <div className="glass-card mb-4 d-flex justify-content-between align-items-center">
        <h5 className="fw-bold mb-0 text-main"><i className="bi bi-people-fill text-primary"></i> User Registration Center</h5>
        <button className="btn btn-primary" onClick={handleCreateNewClick}>
          <i className="bi bi-person-plus-fill"></i> Add User Account
        </button>
      </div>

      {/* USER LIST DATAGRID */}
      <div className="glass-card">
        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-warning" role="status"></div>
            <h5 className="mt-3 text-muted">Retrieving Security Registries...</h5>
          </div>
        ) : usersList.length === 0 ? (
          <div className="text-center py-5 text-muted">
            <i className="bi bi-person-x fs-1"></i>
            <h5 className="mt-3">No users registered in system.</h5>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email Address</th>
                  <th>Role Profile</th>
                  <th>Assigned Project Codes</th>
                  <th>Account Status</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {usersList.map(u => (
                  <tr key={u.email}>
                    <td><strong>{u.name}</strong></td>
                    <td>{u.email}</td>
                    <td><span className="badge bg-secondary text-dark">{u.role}</span></td>
                    <td><code>{u.assignedProjects}</code></td>
                    <td>
                      <span className={`badge ${u.status === 'Active' ? 'badge-active' : 'badge-suspended'}`}>
                        {u.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div className="d-flex justify-content-center gap-2">
                        <button 
                          className="btn btn-sm btn-secondary py-1 px-2"
                          onClick={() => handleEditClick(u)}
                          title="Edit User Profile"
                        >
                          <i className="bi bi-pencil-square"></i> Edit
                        </button>
                        <button 
                          className="btn btn-sm btn-danger py-1 px-2"
                          onClick={() => handleDeleteUser(u.email)}
                          disabled={u.email.toLowerCase() === user.email.toLowerCase()}
                          title="Delete Account"
                        >
                          <i className="bi bi-trash"></i> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE/EDIT USER MODAL */}
      <div className={`modal-overlay ${showModal ? 'active' : ''}`}>
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="fw-bold">
              <i className={`bi ${isEditMode ? 'bi-pencil-square' : 'bi-person-plus-fill'} text-primary`}></i>
              {isEditMode ? ' Modify User Credentials' : ' Register New User Account'}
            </h5>
            <button className="btn-close" onClick={() => setShowModal(false)}></button>
          </div>
          
          <form onSubmit={handleSaveUser}>
            <div className="modal-body">
              <div className="form-group mb-3">
                <label className="form-label">Email Address *</label>
                <input 
                  type="email" 
                  name="email"
                  className="form-control" 
                  placeholder="name@tgh-bims.org"
                  value={editingUser.email}
                  onChange={handleInputChange}
                  required
                  disabled={isEditMode || submitting}
                />
              </div>

              <div className="form-group mb-3">
                <label className="form-label">Full Name *</label>
                <input 
                  type="text" 
                  name="name"
                  className="form-control" 
                  placeholder="e.g. John Doe"
                  value={editingUser.name}
                  onChange={handleInputChange}
                  required
                  disabled={submitting}
                />
              </div>

              <div className="form-group mb-3">
                <label className="form-label">System Role *</label>
                <select 
                  name="role"
                  className="form-select form-control"
                  value={editingUser.role}
                  onChange={handleInputChange}
                  disabled={submitting}
                >
                  <option value="System Administrator">System Administrator</option>
                  <option value="Project Manager">Project Manager</option>
                  <option value="Data Entry Officer">Data Entry Officer</option>
                  <option value="MEAL Officer">MEAL Officer</option>
                </select>
              </div>

              <div className="form-group mb-3">
                <label className="form-label">Assigned Project Scope *</label>
                <input 
                  type="text" 
                  name="assignedProjects"
                  className="form-control" 
                  placeholder="e.g. KU44, KU45 or 'All'"
                  value={editingUser.assignedProjects}
                  onChange={handleInputChange}
                  required
                  disabled={submitting}
                />
                <span className="small text-muted" style={{ fontSize: '0.75rem' }}>
                  Enter comma-separated project codes for Project Managers and Data Entry Officers, or "All".
                </span>
              </div>

              <div className="form-group mb-3">
                <label className="form-label">Password {isEditMode ? '(Leave blank to keep current)' : '*'}</label>
                <input 
                  type="password" 
                  name="password"
                  className="form-control" 
                  placeholder={isEditMode ? '••••••••' : 'Enter account password'}
                  value={editingUser.password || ''}
                  onChange={handleInputChange}
                  required={!isEditMode}
                  disabled={submitting}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Account Status</label>
                <select 
                  name="status"
                  className="form-select form-control"
                  value={editingUser.status}
                  onChange={handleInputChange}
                  disabled={submitting}
                >
                  <option value="Active">Active</option>
                  <option value="Suspended">Suspended</option>
                </select>
              </div>
            </div>

            <div className="modal-footer">
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setShowModal(false)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={submitting}
              >
                {submitting ? 'Saving Account...' : 'Save User Account'}
              </button>
            </div>
          </form>
        </div>
      </div>

    </div>
  );
}
