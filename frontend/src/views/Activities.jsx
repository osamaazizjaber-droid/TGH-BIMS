import React, { useState, useEffect } from 'react';
import api from '../api';
import { getGovernorates, getDistricts, getSubdistricts } from '../utils/iraqiLocations';
import tghLogo from '../assets/tgh_logo.jpg';

export default function Activities({ user, onViewChange, setRegParams, showToast }) {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [activities, setActivities] = useState([]);
  const [templates, setTemplates] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  // Modal State for New Activity
  const [showAddActivityModal, setShowAddActivityModal] = useState(false);
  const [activitySubmitting, setActivitySubmitting] = useState(false);
  const [newActivity, setNewActivity] = useState({
    activityCode: '',
    activityName: '',
    activityType: '',
    location: '',
    governorate: '',
    district: '',
    subdistrict: '',
    locationDetails: '',
    implementationDate: '',
    responsibleStaff: '',
    targetParticipants: ''
  });
  const [districtsList, setDistrictsList] = useState([]);
  const [subdistrictsList, setSubdistrictsList] = useState([]);

  // QR Code Modal State
  const [showQRCodeModal, setShowQRCodeModal] = useState(false);
  const [qrCodeActivity, setQrCodeActivity] = useState(null);

  const handleQRCodeClick = (act) => {
    setQrCodeActivity(act);
    setShowQRCodeModal(true);
  };

  const handleGovChange = (e) => {
    const gov = e.target.value;
    setNewActivity(prev => ({
      ...prev,
      governorate: gov,
      district: '',
      subdistrict: ''
    }));
    setDistrictsList(getDistricts(gov));
    setSubdistrictsList([]);
  };

  const handleDistrictChange = (e) => {
    const dist = e.target.value;
    setNewActivity(prev => ({
      ...prev,
      district: dist,
      subdistrict: ''
    }));
    setSubdistrictsList(getSubdistricts(newActivity.governorate, dist));
  };

  // Template Canvas state (Admin only)
  const [activeTab, setActiveTab] = useState('activities'); // 'activities' or 'templates'
  const [editingTemplate, setEditingTemplate] = useState({
    templateName: '',
    description: '',
    fields: []
  });
  const [newField, setNewField] = useState({
    name: '',
    label: '',
    type: 'Text',
    optionsString: '',
    required: false
  });
  const [templateSubmitting, setTemplateSubmitting] = useState(false);
  const [templateSearch, setTemplateSearch] = useState('');
  const [expandedTemplate, setExpandedTemplate] = useState(null);
  const [editingFieldIdx, setEditingFieldIdx] = useState(null);
  const [isKeyManuallyEdited, setIsKeyManuallyEdited] = useState(false);

  useEffect(() => {
    // Fetch projects first
    api.getProjects()
      .then(data => {
        setProjects(data);
        if (data.length > 0) {
          setSelectedProject(data[0].projectCode);
        }
      })
      .catch(err => {
        showToast(err.message || 'Failed to load projects list', 'danger');
      });

    // Fetch templates
    fetchTemplatesList();
  }, []);

  const fetchTemplatesList = () => {
    setLoadingTemplates(true);
    api.getTemplates()
      .then(data => {
        setTemplates(data);
      })
      .catch(err => {
        showToast(err.message || 'Failed to load templates', 'danger');
      })
      .finally(() => {
        setLoadingTemplates(false);
      });
  };

  const fetchActivities = (pCode) => {
    if (!pCode) return;
    setLoading(true);
    api.getActivities(pCode)
      .then(data => {
        setActivities(data);
      })
      .catch(err => {
        showToast(err.message || 'Failed to load activities', 'danger');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    if (selectedProject) {
      fetchActivities(selectedProject);
    }
  }, [selectedProject]);

  const handleCreateActivity = async (e) => {
    e.preventDefault();
    if (!newActivity.activityCode || !newActivity.activityName || !newActivity.activityType) {
      return showToast('Please fill in all required fields.', 'warning');
    }

    setActivitySubmitting(true);
    try {
      const combinedLocation = `${newActivity.governorate} / ${newActivity.district}${newActivity.subdistrict ? ` / ${newActivity.subdistrict}` : ''}${newActivity.locationDetails ? ` (${newActivity.locationDetails})` : ''}`;
      
      await api.createActivity(selectedProject, {
        ...newActivity,
        location: combinedLocation
      });
      showToast(`Activity ${newActivity.activityCode.toUpperCase()} created successfully!`, 'success');
      setShowAddActivityModal(false);
      setNewActivity({
        activityCode: '',
        activityName: '',
        activityType: '',
        location: '',
        governorate: '',
        district: '',
        subdistrict: '',
        locationDetails: '',
        implementationDate: '',
        responsibleStaff: '',
        targetParticipants: ''
      });
      setDistrictsList([]);
      setSubdistrictsList([]);
      fetchActivities(selectedProject);
    } catch (err) {
      showToast(err.message || 'Failed to create activity.', 'danger');
    } finally {
      setActivitySubmitting(false);
    }
  };

  // Template Builder logic
  const handleLoadFieldForEdit = (idx) => {
    const field = editingTemplate.fields[idx];
    setEditingFieldIdx(idx);
    setNewField({
      name: field.name,
      label: field.label,
      type: field.type,
      optionsString: field.options ? field.options.join(', ') : '',
      required: !!field.required
    });
    setIsKeyManuallyEdited(true); // Prevent auto-overwriting loaded key
  };

  const handleMoveField = (index, direction) => {
    const fields = [...editingTemplate.fields];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= fields.length) return;
    
    // Swap fields
    const temp = fields[index];
    fields[index] = fields[targetIndex];
    fields[targetIndex] = temp;

    setEditingTemplate(prev => ({
      ...prev,
      fields
    }));
  };

  const handleAddField = () => {
    if (!newField.name || !newField.label) {
      return showToast('Please enter field key and field label.', 'warning');
    }
    
    // Normalize field key
    const fieldKey = newField.name.toLowerCase().trim().replace(/[^a-z0-9_]/g, '');
    
    // Check uniqueness excluding the index being edited
    const isDuplicate = editingTemplate.fields.some((f, i) => f.name === fieldKey && i !== editingFieldIdx);
    if (isDuplicate) {
      return showToast('Field key must be unique.', 'warning');
    }

    if (newField.type === 'Dropdown' && (!newField.optionsString || newField.optionsString.trim() === '')) {
      return showToast('Please enter options for the Dropdown field.', 'warning');
    }

    const fieldObj = {
      name: fieldKey,
      label: newField.label.trim(),
      type: newField.type,
      required: newField.required,
      ...(newField.type === 'Dropdown' ? { 
        options: newField.optionsString.split(',').map(o => o.trim()).filter(o => o !== '') 
      } : {})
    };

    setEditingTemplate(prev => {
      const updatedFields = [...prev.fields];
      if (editingFieldIdx !== null && editingFieldIdx !== undefined) {
        updatedFields[editingFieldIdx] = fieldObj;
      } else {
        updatedFields.push(fieldObj);
      }
      return {
        ...prev,
        fields: updatedFields
      };
    });

    // Reset field builder inputs
    setNewField({
      name: '',
      label: '',
      type: 'Text',
      optionsString: '',
      required: false
    });
    setEditingFieldIdx(null);
    setIsKeyManuallyEdited(false);
  };

  const handleRemoveField = (idx) => {
    setEditingTemplate(prev => ({
      ...prev,
      fields: prev.fields.filter((_, i) => i !== idx)
    }));
    if (editingFieldIdx === idx) {
      setEditingFieldIdx(null);
      setIsKeyManuallyEdited(false);
    } else if (editingFieldIdx > idx) {
      setEditingFieldIdx(prev => prev - 1);
    }
  };

  const handleFormKeyDown = (e) => {
    if (e.key === 'Enter') {
      const target = e.target;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT')) {
        e.preventDefault();
        const placeholderText = target.placeholder || '';
        if (
          placeholderText.includes('Pre-Test Score') ||
          placeholderText.includes('pre_test_score') ||
          placeholderText.includes('comma separated')
        ) {
          handleAddField();
        }
      }
    }
  };

  const handleSaveTemplate = async (e) => {
    e.preventDefault();
    if (!editingTemplate.templateName) {
      return showToast('Template name is required.', 'warning');
    }

    let finalFields = [...editingTemplate.fields];

    // Auto-append field if the user has content in the Field Builder inputs
    if (newField.label.trim() !== '' || newField.name.trim() !== '') {
      if (!newField.name || !newField.label) {
        return showToast('Please complete or clear the field currently being designed.', 'warning');
      }
      
      const fieldKey = newField.name.toLowerCase().trim().replace(/[^a-z0-9_]/g, '');
      const isDuplicate = editingTemplate.fields.some((f, i) => f.name === fieldKey && i !== editingFieldIdx);
      if (isDuplicate) {
        return showToast('Field key must be unique.', 'warning');
      }

      if (newField.type === 'Dropdown' && (!newField.optionsString || newField.optionsString.trim() === '')) {
        return showToast('Please enter options for the Dropdown field.', 'warning');
      }

      const fieldObj = {
        name: fieldKey,
        label: newField.label.trim(),
        type: newField.type,
        required: newField.required,
        ...(newField.type === 'Dropdown' ? { 
          options: newField.optionsString.split(',').map(o => o.trim()).filter(o => o !== '') 
        } : {})
      };

      if (editingFieldIdx !== null && editingFieldIdx !== undefined) {
        finalFields[editingFieldIdx] = fieldObj;
      } else {
        finalFields.push(fieldObj);
      }
    }

    if (finalFields.length === 0) {
      return showToast('Please add at least one custom field.', 'warning');
    }

    setTemplateSubmitting(true);
    try {
      await api.saveTemplate({
        ...editingTemplate,
        fields: finalFields
      });
      showToast(`Template "${editingTemplate.templateName}" saved successfully!`, 'success');
      setEditingTemplate({
        templateName: '',
        description: '',
        fields: []
      });
      setNewField({
        name: '',
        label: '',
        type: 'Text',
        optionsString: '',
        required: false
      });
      setEditingFieldIdx(null);
      setIsKeyManuallyEdited(false);
      fetchTemplatesList();
    } catch (err) {
      showToast(err.message || 'Failed to save template.', 'danger');
    } finally {
      setTemplateSubmitting(false);
    }
  };

  const handleDeleteTemplate = async (name) => {
    if (!window.confirm(`Are you sure you want to delete template "${name}"?`)) {
      return;
    }
    try {
      await api.deleteTemplate(name);
      showToast(`Template "${name}" deleted.`, 'success');
      fetchTemplatesList();
    } catch (err) {
      showToast(err.message || 'Failed to delete template.', 'danger');
    }
  };

  const handleEnrollClick = (act) => {
    setRegParams({
      projectCode: selectedProject,
      activityCode: act.activityCode,
      activityType: act.activityType
    });
    onViewChange('registration');
  };

  const isPMOrAdmin = ['System Administrator', 'Project Manager'].includes(user?.role);
  const isAdmin = user?.role === 'System Administrator';

  return (
    <div className="container-fluid p-0">
      
      {/* TABS SELECTOR */}
      {isPMOrAdmin && (
        <div className="mb-4">
          <ul className="nav nav-pills gap-2">
            <li className="nav-item">
              <button 
                className={`btn ${activeTab === 'activities' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setActiveTab('activities')}
              >
                <i className="bi bi-calendar-event"></i> Manage Activities
              </button>
            </li>
            <li className="nav-item">
              <button 
                className={`btn ${activeTab === 'templates' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setActiveTab('templates')}
              >
                <i className="bi bi-card-checklist"></i> Form Templates Builder
              </button>
            </li>
          </ul>
        </div>
      )}

      {/* ACTIVITIES TAB PANEL */}
      {(!isPMOrAdmin || activeTab === 'activities') && (
        <>
          {/* SEARCH & FILTERS CONTROLS */}
          <div className="glass-card mb-4 d-flex flex-wrap justify-content-between align-items-end gap-3">
            <div style={{ minWidth: '250px', flex: '1' }}>
              <label htmlFor="act-project-select" className="form-label fw-bold">Select Active Project</label>
              <select 
                id="act-project-select" 
                className="form-select form-control"
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
              >
                {projects.map(p => (
                  <option key={p.projectCode} value={p.projectCode}>
                    {p.projectCode} - {p.projectName}
                  </option>
                ))}
              </select>
            </div>
            
            {isPMOrAdmin && (
              <button 
                className="btn btn-primary"
                onClick={() => setShowAddActivityModal(true)}
                disabled={!selectedProject}
              >
                <i className="bi bi-calendar-plus"></i> Create Activity Sheet
              </button>
            )}
          </div>

          {/* ACTIVITIES DATAGRID */}
          <div className="glass-card">
            <div className="glass-card-header">
              <div className="glass-card-title text-main">
                <i className="bi bi-calendar-check text-warning"></i> Activities in {selectedProject || '...'}
              </div>
            </div>

            {loading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-warning" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                <h5 className="mt-3 text-muted">Retrieving Activity Logs...</h5>
              </div>
            ) : activities.length === 0 ? (
              <div className="text-center py-5 text-muted">
                <i className="bi bi-calendar-x fs-1"></i>
                <h5 className="mt-3">No activities registered for this project.</h5>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Activity Code</th>
                      <th>Activity Name</th>
                      <th>Activity Type</th>
                      <th>Location</th>
                      <th>Implementation Date</th>
                      <th>Responsible Staff</th>
                      <th>Target Reach</th>
                      <th>Status</th>
                      {user?.role !== 'MEAL Officer' && <th style={{ textAlign: 'center' }}>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {activities.map(act => (
                      <tr key={act.activityCode}>
                        <td><strong>{act.activityCode}</strong></td>
                        <td>{act.activityName}</td>
                        <td><span className="badge badge-primary">{act.activityType}</span></td>
                        <td>{act.location}</td>
                        <td>{act.implementationDate ? new Date(act.implementationDate).toLocaleDateString() : '-'}</td>
                        <td>{act.responsibleStaff}</td>
                        <td>{act.targetParticipants}</td>
                        <td>
                          <span className={`badge ${act.status === 'Active' ? 'badge-active' : 'badge-suspended'}`}>
                            {act.status}
                          </span>
                        </td>
                        {user?.role !== 'MEAL Officer' && (
                          <td style={{ textAlign: 'center' }}>
                            <button 
                              className="btn btn-sm btn-success py-1 px-3"
                              onClick={() => handleEnrollClick(act)}
                              disabled={act.status !== 'Active'}
                            >
                              <i className="bi bi-person-fill-add"></i> Enroll
                            </button>
                            <button 
                              className="btn btn-sm btn-secondary py-1 px-3 ms-2"
                              onClick={() => handleQRCodeClick(act)}
                              disabled={act.status !== 'Active'}
                              title="Generate Public QR Code Signboard"
                            >
                              <i className="bi bi-qr-code"></i> QR
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* DYNAMIC FORM TEMPLATES TAB PANEL */}
      {isPMOrAdmin && activeTab === 'templates' && (
        <div className="row g-4">
          
          {/* TEMPLATE CREATION CANVAS */}
          <div className="col-lg-6">
            <div className="glass-card">
              <div className="glass-card-header">
                <div className="glass-card-title text-main">
                  <i className="bi bi-card-heading text-primary"></i> Template Structure Designer
                </div>
              </div>
              
              <form onSubmit={handleSaveTemplate} onKeyDown={handleFormKeyDown}>
                <div className="form-group mb-3">
                  <label className="form-label fw-bold">Template Type Name *</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="e.g. Sewing Training, Cash Distribution"
                    value={editingTemplate.templateName}
                    onChange={(e) => setEditingTemplate(prev => ({ ...prev, templateName: e.target.value }))}
                    required
                    disabled={templateSubmitting}
                  />
                  <small className="text-muted">Must be a unique name describing the activity type.</small>
                </div>

                <div className="form-group mb-4">
                  <label className="form-label">Description / MEAL Instructions</label>
                  <textarea 
                    className="form-control" 
                    rows="2" 
                    placeholder="Brief guidelines for MEAL/Staff when enrolling participants..."
                    value={editingTemplate.description || ''}
                    onChange={(e) => setEditingTemplate(prev => ({ ...prev, description: e.target.value }))}
                    disabled={templateSubmitting}
                  />
                </div>

                {/* CURRENT DESIGNED FIELDS LIST */}
                <div className="mb-4">
                  <label className="form-label fw-bold text-primary">
                    <i className="bi bi-list-task"></i> Form Fields & Schema ({editingTemplate.fields.length})
                  </label>
                  {editingTemplate.fields.length === 0 ? (
                    <div className="text-center py-4 bg-app rounded text-muted border border-dashed">
                      No custom fields added yet. Use the field builder below to add indicators.
                    </div>
                  ) : (
                    <div className="d-flex flex-column gap-2">
                      {editingTemplate.fields.map((field, idx) => (
                        <div 
                          key={idx} 
                          className="d-flex align-items-center justify-content-between p-3 bg-app rounded border border-light"
                          style={editingFieldIdx === idx ? { border: '1px solid var(--color-warning)', boxShadow: '0 0 8px rgba(255, 193, 7, 0.2)' } : {}}
                        >
                          <div>
                            <span className="badge badge-primary me-2">{field.type}</span>
                            <strong>{field.label}</strong>
                            <code className="ms-2 text-muted">({field.name})</code>
                            {field.required && <span className="text-danger ms-1">* Required</span>}
                            {field.type === 'Dropdown' && (
                              <div className="small text-muted mt-1">
                                Options: {field.options ? field.options.join(', ') : ''}
                              </div>
                            )}
                          </div>
                          <div className="d-flex align-items-center gap-2">
                            <button
                              type="button"
                              className="btn btn-sm btn-link text-secondary p-0"
                              onClick={() => handleMoveField(idx, -1)}
                              disabled={idx === 0}
                              title="Move Field Up"
                            >
                              <i className="bi bi-arrow-up-circle fs-5"></i>
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-link text-secondary p-0"
                              onClick={() => handleMoveField(idx, 1)}
                              disabled={idx === editingTemplate.fields.length - 1}
                              title="Move Field Down"
                            >
                              <i className="bi bi-arrow-down-circle fs-5"></i>
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-link text-primary p-0"
                              onClick={() => handleLoadFieldForEdit(idx)}
                              title="Edit Field Schema"
                            >
                              <i className="bi bi-pencil-circle fs-5"></i>
                            </button>
                            <button 
                              type="button" 
                              className="btn btn-sm btn-link text-danger p-0"
                              onClick={() => handleRemoveField(idx)}
                              title="Remove Field"
                            >
                              <i className="bi bi-x-circle-fill fs-5"></i>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <hr className="my-4" />

                {/* FIELD BUILDER BOX */}
                <div className="p-3 bg-app rounded border mb-4">
                  <h6 className="fw-bold mb-3 text-warning">
                    <i className="bi bi-plus-circle"></i> {editingFieldIdx !== null ? 'Modify Custom Form Field' : 'Add Custom Form Field'}
                  </h6>
                  
                  <div className="form-grid mb-3">
                    <div className="form-group">
                      <label className="form-label">Field Label *</label>
                      <input 
                        type="text" 
                        className="form-control form-control-sm"
                        placeholder="e.g. Pre-Test Score"
                        value={newField.label}
                        onChange={(e) => {
                          const lbl = e.target.value;
                          const key = lbl.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
                          setNewField(prev => ({ 
                            ...prev, 
                            label: lbl,
                            name: isKeyManuallyEdited ? prev.name : key
                          }));
                        }}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Field Key (Unique Identifier) *</label>
                      <input 
                        type="text" 
                        className="form-control form-control-sm"
                        placeholder="e.g. pre_test_score"
                        value={newField.name}
                        onChange={(e) => {
                          setIsKeyManuallyEdited(true);
                          setNewField(prev => ({ 
                            ...prev, 
                            name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') 
                          }));
                        }}
                      />
                      <small className="text-muted" style={{ fontSize: '0.75rem' }}>Letters, numbers, underscores only.</small>
                    </div>
                  </div>

                  <div className="form-grid mb-3">
                    <div className="form-group">
                      <label className="form-label">Input Type *</label>
                      <select 
                        className="form-select form-control form-control-sm"
                        value={newField.type}
                        onChange={(e) => setNewField(prev => ({ ...prev, type: e.target.value }))}
                      >
                        <option value="Text">Single-line Text</option>
                        <option value="Number">Number</option>
                        <option value="Date">Date</option>
                        <option value="Dropdown">Dropdown Selection</option>
                        <option value="Text Area">Paragraph / Text Area</option>
                      </select>
                    </div>
                    <div className="form-group d-flex align-items-end">
                      <div className="form-check mb-2">
                        <input 
                          type="checkbox" 
                          className="form-check-input"
                          id="field-required-chk"
                          checked={newField.required}
                          onChange={(e) => setNewField(prev => ({ ...prev, required: e.target.checked }))}
                        />
                        <label className="form-check-label fw-bold small ms-1" htmlFor="field-required-chk">
                          Field is Required
                        </label>
                      </div>
                    </div>
                  </div>

                  {newField.type === 'Dropdown' && (
                    <div className="form-group mb-3">
                      <label className="form-label">Dropdown Options *</label>
                      <input 
                        type="text" 
                        className="form-control form-control-sm"
                        placeholder="e.g. Attended, Absent, Excused (comma separated)"
                        value={newField.optionsString}
                        onChange={(e) => setNewField(prev => ({ ...prev, optionsString: e.target.value }))}
                      />
                      <small className="text-muted">Separate options with commas.</small>
                    </div>
                  )}

                  {editingFieldIdx !== null && (
                    <button 
                      type="button" 
                      className="btn btn-sm btn-outline-secondary w-100 mb-2"
                      onClick={() => {
                        setEditingFieldIdx(null);
                        setNewField({
                          name: '',
                          label: '',
                          type: 'Text',
                          optionsString: '',
                          required: false
                        });
                        setIsKeyManuallyEdited(false);
                      }}
                    >
                      Cancel Field Edit
                    </button>
                  )}

                  <button 
                    type="button" 
                    className={`btn btn-sm ${editingFieldIdx !== null ? 'btn-warning' : 'btn-secondary'} w-100`}
                    onClick={handleAddField}
                  >
                    <i className="bi bi-plus-lg"></i> {editingFieldIdx !== null ? 'Update Field Schema' : 'Append Field to Schema'}
                  </button>
                </div>

                <div className="d-flex justify-content-end gap-2 mt-4">
                  {(editingTemplate.templateName || editingTemplate.fields.length > 0 || newField.label.trim() !== '') && (
                    <button 
                      type="button" 
                      className="btn btn-secondary"
                      onClick={() => {
                        setEditingTemplate({ templateName: '', description: '', fields: [] });
                        setNewField({
                          name: '',
                          label: '',
                          type: 'Text',
                          optionsString: '',
                          required: false
                        });
                        setEditingFieldIdx(null);
                        setIsKeyManuallyEdited(false);
                      }}
                      disabled={templateSubmitting}
                    >
                      Clear / New
                    </button>
                  )}
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    disabled={templateSubmitting || (editingTemplate.fields.length === 0 && !newField.label.trim())}
                  >
                    {templateSubmitting ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                        Saving Template...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-save2-fill"></i> Save Template Structure
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* EXISTING TEMPLATES DICTIONARY */}
          <div className="col-lg-6">
            <div className="glass-card">
              <div className="glass-card-header">
                <div className="glass-card-title text-main">
                  <i className="bi bi-folder2-open text-warning"></i> Active Form Templates List
                </div>
              </div>

              {/* SEARCH BAR */}
              <div className="mb-4">
                <input 
                  type="text" 
                  className="form-control"
                  placeholder="Search templates by name or description..."
                  value={templateSearch}
                  onChange={(e) => setTemplateSearch(e.target.value)}
                />
              </div>

              {loadingTemplates ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <h5 className="mt-3 text-muted">Loading templates...</h5>
                </div>
              ) : (() => {
                const filtered = templates.filter(t => 
                  t.templateName.toLowerCase().includes(templateSearch.toLowerCase()) ||
                  (t.description || '').toLowerCase().includes(templateSearch.toLowerCase())
                );
                
                if (filtered.length === 0) {
                  return (
                    <div className="text-center py-5 text-muted">
                      <i className="bi bi-folder-x fs-1"></i>
                      <h5 className="mt-3">No templates found.</h5>
                    </div>
                  );
                }

                return (
                  <div className="d-flex flex-column gap-3">
                    {filtered.map(t => {
                      const isExpanded = expandedTemplate === t.templateName;
                      return (
                        <div key={t.templateName} className="p-3 bg-app rounded border border-light">
                          <div className="d-flex justify-content-between align-items-start">
                            <div>
                              <h5 className="fw-bold mb-1 text-main">{t.templateName}</h5>
                              <p className="small text-muted mb-2">{t.description || 'No description provided.'}</p>
                              <div className="small">
                                <span className="badge badge-secondary me-2">
                                  {t.fields?.length || 0} Fields Defined
                                </span>
                              </div>
                            </div>
                            <div className="d-flex gap-2">
                              <button 
                                className="btn btn-sm btn-outline-primary py-1 px-2"
                                onClick={() => {
                                  setEditingTemplate({
                                    templateName: t.templateName,
                                    description: t.description || '',
                                    fields: t.fields || []
                                  });
                                  setEditingFieldIdx(null);
                                  setIsKeyManuallyEdited(false);
                                }}
                                title="Edit Template Structure"
                              >
                                <i className="bi bi-pencil-square"></i> Edit
                              </button>
                              <button 
                                className="btn btn-sm btn-outline-danger py-1 px-2"
                                onClick={() => handleDeleteTemplate(t.templateName)}
                                title="Delete Template"
                              >
                                <i className="bi bi-trash"></i> Delete
                              </button>
                            </div>
                          </div>

                          {/* TOGGLE EXPANDED DETAILS */}
                          <div className="mt-2 pt-2 border-top">
                            <button 
                              className="btn btn-sm btn-link text-primary p-0 d-flex align-items-center gap-1"
                              onClick={() => setExpandedTemplate(isExpanded ? null : t.templateName)}
                            >
                              <i className={`bi ${isExpanded ? 'bi-chevron-up' : 'bi-chevron-down'}`}></i>
                              {isExpanded ? 'Hide Field Schema' : 'View Field Schema'}
                            </button>
                            {isExpanded && t.fields && (
                              <div className="mt-3 bg-app rounded p-2 border border-dashed">
                                <table className="table table-sm table-borderless text-muted small mb-0">
                                  <thead>
                                    <tr>
                                      <th>Field Key</th>
                                      <th>Field Label</th>
                                      <th>Type</th>
                                      <th>Required</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {t.fields.map((f, fIdx) => (
                                      <tr key={fIdx}>
                                        <td><code>{f.name}</code></td>
                                        <td>{f.label}</td>
                                        <td><span className="badge bg-secondary-glow text-secondary py-0 px-1">{f.type}</span></td>
                                        <td>{f.required ? 'Yes' : 'No'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>

                        </div>
                      );
                    })}
                  </div>
                );
              })()}

            </div>
          </div>

        </div>
      )}



      {/* CREATE ACTIVITY MODAL */}
      <div className={`modal-overlay ${showAddActivityModal ? 'active' : ''}`}>
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="fw-bold"><i className="bi bi-calendar-plus text-primary"></i> Create Activity Sheet</h5>
            <button className="btn-close" onClick={() => setShowAddActivityModal(false)}></button>
          </div>
          
          <form onSubmit={handleCreateActivity}>
            <div className="modal-body">
              <div className="form-group mb-3">
                <label className="form-label">Activity Type (Template Structure) *</label>
                <select 
                  className="form-select form-control"
                  value={newActivity.activityType}
                  onChange={(e) => setNewActivity(prev => ({ ...prev, activityType: e.target.value }))}
                  required
                  disabled={activitySubmitting}
                >
                  <option value="">-- Choose Template --</option>
                  {templates.map(t => (
                    <option key={t.templateName} value={t.templateName}>{t.templateName}</option>
                  ))}
                </select>
              </div>

              <div className="form-group mb-3">
                <label className="form-label">Activity Code (Unique in Project) *</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="e.g. ACT-002"
                  value={newActivity.activityCode}
                  onChange={(e) => setNewActivity(prev => ({ ...prev, activityCode: e.target.value.toUpperCase().replace(/\s+/g, '') }))}
                  required
                  disabled={activitySubmitting}
                />
              </div>

              <div className="form-group mb-3">
                <label className="form-label">Activity Name *</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="e.g. Sewing Training Mosul Camp"
                  value={newActivity.activityName}
                  onChange={(e) => setNewActivity(prev => ({ ...prev, activityName: e.target.value }))}
                  required
                  disabled={activitySubmitting}
                />
              </div>

              <div className="form-grid mb-3">
                <div className="form-group">
                  <label className="form-label">Governorate *</label>
                  <select 
                    className="form-select form-control" 
                    value={newActivity.governorate}
                    onChange={handleGovChange}
                    required
                    disabled={activitySubmitting}
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
                    value={newActivity.district}
                    onChange={handleDistrictChange}
                    required
                    disabled={activitySubmitting || !newActivity.governorate}
                  >
                    <option value="">-- Choose District --</option>
                    {districtsList.map(dist => (
                      <option key={dist} value={dist}>{dist}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-grid mb-3">
                <div className="form-group">
                  <label className="form-label">Subdistrict *</label>
                  <select 
                    className="form-select form-control" 
                    value={newActivity.subdistrict}
                    onChange={(e) => setNewActivity(prev => ({ ...prev, subdistrict: e.target.value }))}
                    required
                    disabled={activitySubmitting || !newActivity.district}
                  >
                    <option value="">-- Choose Subdistrict --</option>
                    {subdistrictsList.map(sub => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Specific Site Details (optional)</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="e.g. Al-Salaam Camp, school name..."
                    value={newActivity.locationDetails}
                    onChange={(e) => setNewActivity(prev => ({ ...prev, locationDetails: e.target.value }))}
                    disabled={activitySubmitting}
                  />
                </div>
              </div>

              <div className="form-grid mb-3">
                <div className="form-group">
                  <label className="form-label">Implementation Date</label>
                  <input 
                    type="date" 
                    className="form-control"
                    value={newActivity.implementationDate}
                    onChange={(e) => setNewActivity(prev => ({ ...prev, implementationDate: e.target.value }))}
                    disabled={activitySubmitting}
                  />
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Staff Responsible</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="Staff name"
                    value={newActivity.responsibleStaff}
                    onChange={(e) => setNewActivity(prev => ({ ...prev, responsibleStaff: e.target.value }))}
                    disabled={activitySubmitting}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Target Participants Count</label>
                  <input 
                    type="number" 
                    className="form-control" 
                    placeholder="e.g. 25"
                    value={newActivity.targetParticipants}
                    onChange={(e) => setNewActivity(prev => ({ ...prev, targetParticipants: e.target.value }))}
                    disabled={activitySubmitting}
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setShowAddActivityModal(false)}
                disabled={activitySubmitting}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={activitySubmitting}
              >
                {activitySubmitting ? 'Generating Tab...' : 'Create Activity'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* QR CODE GENERATOR MODAL */}
      {showQRCodeModal && qrCodeActivity && (
        <div className={`modal-overlay active`}>
          <div className="modal-content" style={{ maxWidth: '600px', padding: '1.5rem' }}>
            <div className="modal-header no-print">
              <h5 className="fw-bold"><i className="bi bi-qr-code text-primary"></i> Activity QR Code Signboard</h5>
              <button className="btn-close" onClick={() => { setShowQRCodeModal(false); setQrCodeActivity(null); }}></button>
            </div>
            
            <div className="modal-body p-0">
              <div className="printable-signboard">
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.75rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
                  <div className="brand-logo" style={{ width: '40px', height: '40px', background: 'none', boxShadow: 'none' }}>
                    <img src={tghLogo} alt="TGH" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '4px' }} />
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#0f172a' }}>TGH MASTER SYSTEM</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 'bold' }}>BENEFICIARY INFORMATION REGISTRY</div>
                  </div>
                </div>

                <div className="badge" style={{ backgroundColor: 'rgba(244, 150, 0, 0.12)', color: '#F49600', padding: '0.4rem 0.8rem', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', borderRadius: '4px' }}>
                  Project Scope: {selectedProject}
                </div>

                <h1 className="signboard-title" style={{ fontSize: '1.8rem', marginTop: '1rem' }}>{qrCodeActivity.activityName}</h1>
                <p className="signboard-subtitle" style={{ fontSize: '1rem', color: '#475569', margin: '0.25rem 0 1rem 0' }}>
                  Activity Type: <strong>{qrCodeActivity.activityType}</strong> | Location: <strong>{qrCodeActivity.location}</strong>
                </p>

                <div className="signboard-qr-container">
                  <img 
                    className="signboard-qr-img"
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&format=svg&data=${encodeURIComponent(
                      `${window.location.origin}/?view=public-register&project=${encodeURIComponent(selectedProject)}&activity=${encodeURIComponent(qrCodeActivity.activityCode)}`
                    )}`}
                    alt="Registration QR Code"
                  />
                </div>

                <p className="signboard-instructions">
                  <strong>Scan with your mobile camera</strong> to open the public registration form and enroll directly.
                </p>

                <div className="signboard-footer">
                  Generated on {new Date().toLocaleDateString()} • BIMS Mobile Gateway
                </div>
              </div>
            </div>

            <div className="modal-footer no-print">
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => { setShowQRCodeModal(false); setQrCodeActivity(null); }}
              >
                Close
              </button>
              <button 
                type="button" 
                className="btn btn-primary"
                onClick={() => window.print()}
              >
                <i className="bi bi-printer-fill"></i> Print Signboard
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
