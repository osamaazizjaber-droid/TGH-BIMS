import React, { useState, useEffect } from 'react';
import api from '../api';
import { getGovernorates, getDistricts, getSubdistricts } from '../utils/iraqiLocations';

export default function Projects({ user, showToast }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newProject, setNewProject] = useState({
    projectCode: '',
    projectName: '',
    donor: '',
    location: '',
    governorate: '',
    district: '',
    startDate: '',
    endDate: '',
    budget: '',
    implementingTeam: '',
    projectManager: ''
  });
  const [formLocations, setFormLocations] = useState([
    { governorate: '', district: '', subdistrict: '', districtsList: [], subdistrictsList: [] }
  ]);

  const addLocationSlot = () => {
    setFormLocations(prev => [
      ...prev,
      { governorate: '', district: '', subdistrict: '', districtsList: [], subdistrictsList: [] }
    ]);
  };

  const removeLocationSlot = (index) => {
    setFormLocations(prev => prev.filter((_, i) => i !== index));
  };

  const handleSlotGovChange = (index, gov) => {
    setFormLocations(prev => prev.map((slot, i) => {
      if (i === index) {
        return {
          ...slot,
          governorate: gov,
          district: '',
          subdistrict: '',
          districtsList: getDistricts(gov),
          subdistrictsList: []
        };
      }
      return slot;
    }));
  };

  const handleSlotDistrictChange = (index, dist) => {
    setFormLocations(prev => prev.map((slot, i) => {
      if (i === index) {
        return {
          ...slot,
          district: dist,
          subdistrict: '',
          subdistrictsList: getSubdistricts(slot.governorate, dist)
        };
      }
      return slot;
    }));
  };

  const handleSlotSubdistrictChange = (index, sub) => {
    setFormLocations(prev => prev.map((slot, i) => {
      if (i === index) {
        return {
          ...slot,
          subdistrict: sub
        };
      }
      return slot;
    }));
  };

  const fetchProjects = () => {
    setLoading(true);
    api.getProjects()
      .then(data => {
        setProjects(data);
      })
      .catch(err => {
        showToast(err.message || 'Failed to load projects list', 'danger');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewProject(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    
    // Simple validation
    if (!newProject.projectCode || !newProject.projectName || !newProject.donor) {
      return showToast('Please fill in all required fields.', 'warning');
    }

    // Validate locations
    const validLocations = formLocations.filter(loc => loc.governorate && loc.district);
    if (validLocations.length === 0) {
      return showToast('Please add at least one location (Governorate and District).', 'warning');
    }

    setSubmitting(true);
    try {
      const govs = validLocations.map(loc => loc.governorate).join(', ');
      const dists = validLocations.map(loc => loc.district).join(', ');
      const subs = validLocations.map(loc => loc.subdistrict || '-').join(', ');

      const projectPayload = {
        ...newProject,
        governorate: govs,
        district: dists,
        subdistrict: subs
      };

      await api.createProject(projectPayload);
      showToast(`Project ${newProject.projectCode.toUpperCase()} created successfully!`, 'success');
      setShowAddModal(false);
      // Reset form
      setNewProject({
        projectCode: '',
        projectName: '',
        donor: '',
        location: '',
        governorate: '',
        district: '',
        startDate: '',
        endDate: '',
        budget: '',
        implementingTeam: '',
        projectManager: ''
      });
      setFormLocations([
        { governorate: '', district: '', subdistrict: '', districtsList: [], subdistrictsList: [] }
      ]);
      fetchProjects();
    } catch (err) {
      showToast(err.message || 'Failed to create project.', 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchiveProject = async (code) => {
    if (!window.confirm(`Are you sure you want to archive project ${code}? This action is irreversible.`)) {
      return;
    }

    try {
      await api.archiveProject(code);
      showToast(`Project ${code} archived successfully.`, 'success');
      fetchProjects();
    } catch (err) {
      showToast(err.message || 'Failed to archive project.', 'danger');
    }
  };

  const filteredProjects = projects.filter(p => {
    const query = searchQuery.toLowerCase();
    return (p.projectCode || '').toLowerCase().includes(query) ||
           (p.projectName || '').toLowerCase().includes(query) ||
           (p.donor || '').toLowerCase().includes(query) ||
           (p.projectManager || '').toLowerCase().includes(query);
  });

  const isAdmin = user?.role === 'System Administrator';

  const formatCurrency = (num) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <div className="container-fluid p-0">
      
      {/* HEADER CONTROLS */}
      <div className="glass-card mb-4 d-flex flex-wrap justify-content-between align-items-center gap-3">
        <div className="d-flex align-items-center gap-2" style={{ flex: '1', minWidth: '250px' }}>
          <i className="bi bi-search text-muted"></i>
          <input 
            type="text" 
            className="form-control" 
            placeholder="Search projects by code, name, donor, manager..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        {isAdmin && (
          <button 
            className="btn btn-primary" 
            onClick={() => {
              setFormLocations([
                { governorate: '', district: '', subdistrict: '', districtsList: [], subdistrictsList: [] }
              ]);
              setShowAddModal(true);
            }}
          >
            <i className="bi bi-folder-plus"></i> Add New Project
          </button>
        )}
      </div>

      {/* PROJECTS TABLE */}
      <div className="glass-card">
        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-warning" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <h5 className="mt-3 text-muted">Retrieving Project Files...</h5>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="text-center py-5 text-muted">
            <i className="bi bi-folder2 fs-1"></i>
            <h5 className="mt-3">No projects found.</h5>
          </div>
        ) : (
          <div className="table-container-inner">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Project Name</th>
                  <th>Donor</th>
                  <th>Location</th>
                  <th>Duration</th>
                  <th>Budget</th>
                  <th>Project Manager</th>
                  <th>Status</th>
                  {isAdmin && <th style={{ textAlign: 'center' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map(p => (
                  <tr key={p.projectCode}>
                    <td><strong>{p.projectCode}</strong></td>
                    <td style={{ whiteSpace: 'normal', minWidth: '200px' }}>{p.projectName}</td>
                    <td>{p.donor}</td>
                    <td>{p.location} ({p.governorate} / {p.district} / {p.subdistrict || '-'})</td>
                    <td><span className="small text-muted">{formatDate(p.startDate)} - {formatDate(p.endDate)}</span></td>
                    <td>{formatCurrency(p.budget)}</td>
                    <td>{p.projectManager}</td>
                    <td>
                      <span className={`badge ${p.status === 'Active' ? 'badge-active' : 'badge-archived'}`}>
                        {p.status}
                      </span>
                    </td>
                    {isAdmin && (
                      <td style={{ textAlign: 'center' }}>
                        {p.status === 'Active' ? (
                          <button 
                            className="btn btn-sm btn-danger py-1 px-2"
                            onClick={() => handleArchiveProject(p.projectCode)}
                            title="Archive Project"
                          >
                            <i className="bi bi-archive"></i> Archive
                          </button>
                        ) : (
                          <span className="text-muted small">Archived</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE PROJECT MODAL */}
      <div className={`modal-overlay ${showAddModal ? 'active' : ''}`}>
        <div className="modal-content" style={{ maxWidth: '650px' }}>
          <div className="modal-header">
            <h5 className="fw-bold"><i className="bi bi-folder-plus text-primary"></i> Create Project Sheet</h5>
            <button className="btn-close" onClick={() => setShowAddModal(false)}></button>
          </div>
          
          <form onSubmit={handleCreateProject}>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Project Code *</label>
                  <input 
                    type="text" 
                    name="projectCode"
                    className="form-control" 
                    placeholder="e.g. KU44" 
                    value={newProject.projectCode}
                    onChange={(e) => setNewProject(prev => ({ ...prev, projectCode: e.target.value.toUpperCase().replace(/\s+/g, '') }))}
                    required 
                    disabled={submitting}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Project Name *</label>
                  <input 
                    type="text" 
                    name="projectName"
                    className="form-control" 
                    placeholder="Project Title" 
                    value={newProject.projectName}
                    onChange={handleInputChange}
                    required 
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className="form-grid mt-2">
                <div className="form-group">
                  <label className="form-label">Donor *</label>
                  <input 
                    type="text" 
                    name="donor"
                    className="form-control" 
                    placeholder="e.g. BHA, UNICEF" 
                    value={newProject.donor}
                    onChange={handleInputChange}
                    required 
                    disabled={submitting}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Base Location</label>
                  <input 
                    type="text" 
                    name="location"
                    className="form-control" 
                    placeholder="e.g. Mosul Center" 
                    value={newProject.location}
                    onChange={handleInputChange}
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className="mt-3 p-3 rounded" style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <span className="fw-bold text-main small" style={{ letterSpacing: '0.5px' }}>PROJECT LOCATIONS</span>
                  <button 
                    type="button" 
                    className="btn btn-sm btn-outline-warning"
                    onClick={addLocationSlot}
                    disabled={submitting}
                  >
                    <i className="bi bi-plus-circle me-1"></i> Add Another Location
                  </button>
                </div>

                {formLocations.map((slot, index) => (
                  <div key={index} className="p-3 mb-3 rounded position-relative" style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <span className="small fw-bold text-warning">Location #{index + 1}</span>
                      {formLocations.length > 1 && (
                        <button 
                          type="button" 
                          className="btn btn-sm text-danger border-0 p-0" 
                          onClick={() => removeLocationSlot(index)}
                          disabled={submitting}
                          title="Remove Location"
                          style={{ background: 'transparent' }}
                        >
                          <i className="bi bi-trash-fill fs-6"></i>
                        </button>
                      )}
                    </div>
                    <div className="form-grid">
                      <div className="form-group">
                        <label className="form-label">Governorate *</label>
                        <select 
                          className="form-select form-control" 
                          value={slot.governorate}
                          onChange={(e) => handleSlotGovChange(index, e.target.value)}
                          disabled={submitting}
                          required
                        >
                          <option value="">-- Choose Governorate --</option>
                          {getGovernorates().map(gov => (
                            <option key={gov} value={gov}>{gov}</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">District *</label>
                        <select 
                          className="form-select form-control" 
                          value={slot.district}
                          onChange={(e) => handleSlotDistrictChange(index, e.target.value)}
                          disabled={submitting || !slot.governorate}
                          required
                        >
                          <option value="">-- Choose District --</option>
                          {slot.districtsList.map(dist => (
                            <option key={dist} value={dist}>{dist}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="form-grid mt-2">
                      <div className="form-group">
                        <label className="form-label">Subdistrict</label>
                        <select 
                          className="form-select form-control" 
                          value={slot.subdistrict}
                          onChange={(e) => handleSlotSubdistrictChange(index, e.target.value)}
                          disabled={submitting || !slot.district}
                        >
                          <option value="">-- Choose Subdistrict --</option>
                          {slot.subdistrictsList.map(sub => (
                            <option key={sub} value={sub}>{sub}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="form-grid mt-2">
                <div className="form-group">
                  <label className="form-label">Start Date</label>
                  <input 
                    type="date" 
                    name="startDate"
                    className="form-control" 
                    value={newProject.startDate}
                    onChange={handleInputChange}
                    disabled={submitting}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">End Date</label>
                  <input 
                    type="date" 
                    name="endDate"
                    className="form-control" 
                    value={newProject.endDate}
                    onChange={handleInputChange}
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className="form-grid mt-2">
                <div className="form-group">
                  <label className="form-label">Project Budget (USD)</label>
                  <input 
                    type="number" 
                    name="budget"
                    className="form-control" 
                    placeholder="e.g. 150000" 
                    value={newProject.budget}
                    onChange={handleInputChange}
                    disabled={submitting}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Project Manager Email</label>
                  <input 
                    type="email" 
                    name="projectManager"
                    className="form-control" 
                    placeholder="pm@tgh-bims.org" 
                    value={newProject.projectManager}
                    onChange={handleInputChange}
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className="form-group mt-2">
                <label className="form-label">Implementing Field Teams</label>
                <input 
                  type="text" 
                  name="implementingTeam"
                  className="form-control" 
                  placeholder="e.g. Area Team A, Area Team B" 
                  value={newProject.implementingTeam}
                  onChange={handleInputChange}
                  disabled={submitting}
                />
              </div>

            </div>
            
            <div className="modal-footer">
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setShowAddModal(false)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Initializing Sheets...
                  </>
                ) : (
                  <>Create Project</>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

    </div>
  );
}
