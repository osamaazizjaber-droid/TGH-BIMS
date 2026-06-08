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
  const [isDesigning, setIsDesigning] = useState(false);
  const [cloneSource, setCloneSource] = useState('');
  const [editingTemplate, setEditingTemplate] = useState({
    templateName: '',
    description: '',
    fields: []
  });
  const [newField, setNewField] = useState({
    name: '',
    label: '',
    type: 'Text',
    options: [],
    required: false,
    placeholder: '',
    helpText: '',
    minValue: '',
    maxValue: ''
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

  const handleCloneFields = (sourceName) => {
    if (!sourceName) return;
    const source = templates.find(t => t.templateName === sourceName);
    if (source) {
      setEditingTemplate(prev => ({
        ...prev,
        fields: [...prev.fields, ...JSON.parse(JSON.stringify(source.fields || []))]
      }));
      showToast(`Cloned ${source.fields?.length || 0} fields from "${sourceName}" template!`, 'success');
      setCloneSource('');
    }
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
      name: field.name || '',
      label: field.label || '',
      type: field.type || 'Text',
      options: field.options || [],
      required: !!field.required,
      placeholder: field.placeholder || '',
      helpText: field.helpText || '',
      minValue: field.minValue || '',
      maxValue: field.maxValue || ''
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
    if (!newField.label) {
      return showToast('Please enter a field label.', 'warning');
    }
    
    // Auto-generate name key if empty
    let fieldKey = newField.name;
    if (!fieldKey) {
      fieldKey = newField.label.toLowerCase().trim().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
    }
    fieldKey = fieldKey.toLowerCase().trim().replace(/[^a-z0-9_]/g, '');

    if (!fieldKey && newField.type !== 'Section Header') {
      return showToast('Please enter or generate a unique field key identifier.', 'warning');
    }
    
    // Check uniqueness excluding the index being edited (except Section Header which doesn't store input)
    if (newField.type !== 'Section Header') {
      const isDuplicate = editingTemplate.fields.some((f, i) => f.name === fieldKey && i !== editingFieldIdx);
      if (isDuplicate) {
        return showToast('Field key must be unique.', 'warning');
      }
    }

    if (['Dropdown', 'Radio'].includes(newField.type) && (!newField.options || newField.options.length === 0)) {
      return showToast('Please add at least one choice option for selection fields.', 'warning');
    }

    const fieldObj = {
      name: newField.type === 'Section Header' ? `section_${Date.now()}` : fieldKey,
      label: newField.label.trim(),
      type: newField.type,
      required: newField.type === 'Section Header' ? false : newField.required,
      placeholder: newField.placeholder.trim(),
      helpText: newField.helpText.trim(),
      minValue: newField.type === 'Number' ? newField.minValue : '',
      maxValue: newField.type === 'Number' ? newField.maxValue : '',
      options: ['Dropdown', 'Radio'].includes(newField.type) ? newField.options : []
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
      options: [],
      required: false,
      placeholder: '',
      helpText: '',
      minValue: '',
      maxValue: ''
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
        handleAddField();
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
    if (newField.label.trim() !== '') {
      let fieldKey = newField.name;
      if (!fieldKey) {
        fieldKey = newField.label.toLowerCase().trim().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
      }
      fieldKey = fieldKey.toLowerCase().trim().replace(/[^a-z0-9_]/g, '');

      const isDuplicate = editingTemplate.fields.some((f, i) => f.name === fieldKey && i !== editingFieldIdx);
      if (!isDuplicate && (newField.type === 'Section Header' || fieldKey)) {
        if (['Dropdown', 'Radio'].includes(newField.type) && (!newField.options || newField.options.length === 0)) {
          return showToast('Please complete options or clear the field currently being designed.', 'warning');
        }

        const fieldObj = {
          name: newField.type === 'Section Header' ? `section_${Date.now()}` : fieldKey,
          label: newField.label.trim(),
          type: newField.type,
          required: newField.type === 'Section Header' ? false : newField.required,
          placeholder: newField.placeholder.trim(),
          helpText: newField.helpText.trim(),
          minValue: newField.type === 'Number' ? newField.minValue : '',
          maxValue: newField.type === 'Number' ? newField.maxValue : '',
          options: ['Dropdown', 'Radio'].includes(newField.type) ? newField.options : []
        };

        if (editingFieldIdx !== null && editingFieldIdx !== undefined) {
          finalFields[editingFieldIdx] = fieldObj;
        } else {
          finalFields.push(fieldObj);
        }
      }
    }

    if (finalFields.length === 0) {
      return showToast('Please add at least one custom field or layout element.', 'warning');
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
        options: [],
        required: false,
        placeholder: '',
        helpText: '',
        minValue: '',
        maxValue: ''
      });
      setEditingFieldIdx(null);
      setIsKeyManuallyEdited(false);
      setIsDesigning(false);
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
        <div>
          {/* Component-Specific Custom CSS Styles */}
          <style>{`
            .mobile-preview-device {
              width: 320px;
              height: 620px;
              background: #0f172a;
              border: 10px solid #1e293b;
              border-radius: 36px;
              position: relative;
              display: flex;
              flex-direction: column;
              overflow: hidden;
              box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
              border-color: #334155;
            }
            .device-header {
              height: 20px;
              background: #1e293b;
              display: flex;
              justify-content: center;
              align-items: center;
              position: relative;
              gap: 6px;
            }
            .device-speaker {
              width: 40px;
              height: 4px;
              background: #475569;
              border-radius: 2px;
            }
            .device-camera {
              width: 6px;
              height: 6px;
              background: #475569;
              border-radius: 50%;
            }
            .device-screen {
              flex-grow: 1;
              background: var(--bg-app, #121824);
              display: flex;
              flex-direction: column;
              overflow: hidden;
              border-radius: 0 0 26px 26px;
            }
            .device-app-bar {
              background: rgba(30, 41, 59, 0.5);
              backdrop-filter: blur(10px);
              border-bottom: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));
            }
            .device-screen-body {
              overflow-y: auto;
              padding: 1rem;
            }
            .form-group-mobile {
              margin-bottom: 0.8rem;
              text-align: left;
            }
            .form-label-mobile {
              font-size: 0.72rem;
              color: var(--text-main, #e2e8f0);
              font-weight: 600;
            }
            .cursor-pointer {
              cursor: pointer;
            }
          `}</style>

          {!isDesigning ? (
            /* 1. VIEW TEMPLATES LIST MODE */
            <div className="glass-card">
              <div className="glass-card-header d-flex flex-wrap justify-content-between align-items-center gap-3">
                <div className="glass-card-title text-main">
                  <i className="bi bi-folder2-open text-warning"></i> Active Form Templates List
                </div>
                <button 
                  className="btn btn-primary d-flex align-items-center gap-2"
                  onClick={() => {
                    setEditingTemplate({ templateName: '', description: '', fields: [] });
                    setNewField({
                      name: '', label: '', type: 'Text', options: [], required: false,
                      placeholder: '', helpText: '', minValue: '', maxValue: ''
                    });
                    setEditingFieldIdx(null);
                    setIsKeyManuallyEdited(false);
                    setIsDesigning(true);
                  }}
                >
                  <i className="bi bi-plus-circle"></i> Create New Form Template
                </button>
              </div>

              {/* SEARCH BAR */}
              <div className="my-4">
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
                  <div className="row g-3">
                    {filtered.map(t => {
                      const isExpanded = expandedTemplate === t.templateName;
                      return (
                        <div key={t.templateName} className="col-md-6">
                          <div className="p-3 bg-app rounded border border-light h-100 d-flex flex-column justify-content-between">
                            <div>
                              <div className="d-flex justify-content-between align-items-start">
                                <div>
                                  <h5 className="fw-bold mb-1 text-main">{t.templateName}</h5>
                                  <p className="small text-muted mb-2">{t.description || 'No description provided.'}</p>
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
                                      setIsDesigning(true);
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
                                    <i className="bi bi-trash"></i>
                                  </button>
                                </div>
                              </div>
                              
                              <div className="small mt-2">
                                <span className="badge badge-secondary me-2">
                                  {t.fields?.length || 0} Fields Defined
                                </span>
                              </div>
                            </div>

                            {/* TOGGLE EXPANDED DETAILS */}
                            <div className="mt-3 pt-2 border-top">
                              <button 
                                className="btn btn-sm btn-link text-primary p-0 d-flex align-items-center gap-1"
                                onClick={() => setExpandedTemplate(isExpanded ? null : t.templateName)}
                              >
                                <i className={`bi ${isExpanded ? 'bi-chevron-up' : 'bi-chevron-down'}`}></i>
                                {isExpanded ? 'Hide Field Schema' : 'View Field Schema'}
                              </button>
                              {isExpanded && t.fields && (
                                <div className="mt-2 bg-app rounded p-2 border border-dashed" style={{ maxHeight: '200px', overflowY: 'auto' }}>
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
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          ) : (
            /* 2. COMPREHENSIVE DESIGN CANVAS MODE (SIDE-BY-SIDE MOBILE PREVIEW) */
            <div className="row g-4">
              
              {/* LEFT SIDE: CONFIGURATOR AND FIELD CANVAS */}
              <div className="col-lg-7">
                <div className="glass-card">
                  <div className="glass-card-header d-flex justify-content-between align-items-center">
                    <div className="glass-card-title text-main">
                      <i className="bi bi-palette text-primary"></i> Visual Form Designer
                    </div>
                    <button 
                      className="btn btn-sm btn-outline-secondary"
                      onClick={() => {
                        setIsDesigning(false);
                      }}
                      disabled={templateSubmitting}
                    >
                      <i className="bi bi-arrow-left"></i> Back to Templates
                    </button>
                  </div>
                  
                  <form onSubmit={handleSaveTemplate} onKeyDown={handleFormKeyDown}>
                    <div className="row g-2 mb-3">
                      <div className="col-md-6 form-group">
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
                      </div>

                      <div className="col-md-6 form-group">
                        <label className="form-label fw-bold text-success">
                          <i className="bi bi-box-arrow-in-down"></i> Clone Fields from Existing Template
                        </label>
                        <div className="d-flex gap-1">
                          <select 
                            className="form-select form-control"
                            value={cloneSource}
                            onChange={(e) => setCloneSource(e.target.value)}
                            disabled={templateSubmitting}
                          >
                            <option value="">-- Select Template to Copy --</option>
                            {templates.map(t => (
                              <option key={t.templateName} value={t.templateName}>{t.templateName}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="btn btn-success"
                            onClick={() => handleCloneFields(cloneSource)}
                            disabled={!cloneSource || templateSubmitting}
                          >
                            Clone
                          </button>
                        </div>
                      </div>
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

                    {/* FIELDS SCHEMA CANVAS */}
                    <div className="mb-4">
                      <label className="form-label fw-bold text-primary mb-2">
                        <i className="bi bi-list-task"></i> Form Fields Canvas ({editingTemplate.fields.length})
                      </label>
                      {editingTemplate.fields.length === 0 ? (
                        <div className="text-center py-4 bg-app rounded text-muted border border-dashed">
                          No fields defined yet. Add elements using the configurator below.
                        </div>
                      ) : (
                        <div className="d-flex flex-column gap-2" style={{ maxHeight: '350px', overflowY: 'auto', padding: '4px' }}>
                          {editingTemplate.fields.map((field, idx) => {
                            let fieldIcon = "bi-type";
                            let badgeStyle = "badge-primary";
                            if (field.type === 'Number') { fieldIcon = "bi-hash"; badgeStyle = "badge-primary"; }
                            else if (field.type === 'Date') { fieldIcon = "bi-calendar-date"; badgeStyle = "badge-primary"; }
                            else if (field.type === 'Dropdown') { fieldIcon = "bi-menu-button-wide"; badgeStyle = "badge-active"; }
                            else if (field.type === 'Text Area') { fieldIcon = "bi-blockquote-left"; badgeStyle = "badge-secondary"; }
                            else if (field.type === 'Checkbox') { fieldIcon = "bi-toggle-on"; badgeStyle = "badge-suspended"; }
                            else if (field.type === 'Radio') { fieldIcon = "bi-ui-checks"; badgeStyle = "badge-active"; }
                            else if (field.type === 'Section Header') { fieldIcon = "bi-layout-text-window"; badgeStyle = "badge-secondary text-main border"; }

                            return (
                              <div 
                                key={idx} 
                                className="d-flex align-items-center justify-content-between p-3 bg-app rounded border"
                                style={editingFieldIdx === idx ? { border: '1px solid var(--color-warning)', boxShadow: '0 0 8px rgba(255, 193, 7, 0.2)' } : {}}
                              >
                                <div>
                                  <span className={`badge ${badgeStyle} me-2 d-inline-flex align-items-center gap-1`}>
                                    <i className={`bi ${fieldIcon}`}></i> {field.type}
                                  </span>
                                  <strong>{field.label}</strong>
                                  {field.type !== 'Section Header' && (
                                    <code className="ms-2 text-muted">({field.name})</code>
                                  )}
                                  {field.required && <span className="text-danger ms-1 fw-bold">* Required</span>}
                                  
                                  {field.helpText && (
                                    <div className="small text-muted mt-1" style={{ fontSize: '0.8rem' }}>
                                      <i className="bi bi-info-circle"></i> {field.helpText}
                                    </div>
                                  )}
                                </div>
                                <div className="d-flex align-items-center gap-2">
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-link text-secondary p-0"
                                    onClick={() => handleMoveField(idx, -1)}
                                    disabled={idx === 0}
                                    title="Move Up"
                                  >
                                    <i className="bi bi-arrow-up-circle fs-5"></i>
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-link text-secondary p-0"
                                    onClick={() => handleMoveField(idx, 1)}
                                    disabled={idx === editingTemplate.fields.length - 1}
                                    title="Move Down"
                                  >
                                    <i className="bi bi-arrow-down-circle fs-5"></i>
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-link text-primary p-0"
                                    onClick={() => handleLoadFieldForEdit(idx)}
                                    title="Edit Element Schema"
                                  >
                                    <i className="bi bi-pencil-circle fs-5"></i>
                                  </button>
                                  <button 
                                    type="button" 
                                    className="btn btn-sm btn-link text-danger p-0"
                                    onClick={() => handleRemoveField(idx)}
                                    title="Remove Element"
                                  >
                                    <i className="bi bi-x-circle-fill fs-5"></i>
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <hr className="my-4" />

                    {/* FIELD BUILDER PANEL */}
                    <div className="p-3 bg-app rounded border mb-4">
                      <h6 className="fw-bold mb-3 text-warning">
                        <i className="bi bi-plus-circle"></i> {editingFieldIdx !== null ? 'Modify Custom Form Field' : 'Add Custom Form Field'}
                      </h6>
                      
                      <div className="form-grid mb-3">
                        <div className="form-group">
                          <label className="form-label small fw-bold">Input Type *</label>
                          <select 
                            className="form-select form-control form-control-sm"
                            value={newField.type}
                            onChange={(e) => {
                              const selectedType = e.target.value;
                              setNewField(prev => ({ 
                                ...prev, 
                                type: selectedType, 
                                required: selectedType === 'Section Header' ? false : prev.required 
                              }));
                            }}
                          >
                            <optgroup label="Basic Inputs">
                              <option value="Text">Single-line Text</option>
                              <option value="Number">Number</option>
                              <option value="Date">Date</option>
                              <option value="Text Area">Paragraph / Text Area</option>
                            </optgroup>
                            <optgroup label="Interactive Choices">
                              <option value="Dropdown">Dropdown Selection</option>
                              <option value="Radio">Radio Buttons (Choices)</option>
                              <option value="Checkbox">Checkbox / Switch</option>
                            </optgroup>
                            <optgroup label="Form Layout">
                              <option value="Section Header">Section Header / Divider</option>
                            </optgroup>
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label small fw-bold">Field Label / Title *</label>
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
                      </div>

                      {newField.type !== 'Section Header' && (
                        <div className="form-grid mb-3">
                          <div className="form-group">
                            <label className="form-label small">Field Key (Unique Identifier) *</label>
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
                            <small className="text-muted" style={{ fontSize: '0.73rem' }}>Letters, numbers, underscores only.</small>
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
                      )}

                      <div className="form-grid mb-3">
                        <div className="form-group">
                          <label className="form-label small">Input Placeholder Text</label>
                          <input 
                            type="text" 
                            className="form-control form-control-sm"
                            placeholder="e.g. Enter training score"
                            value={newField.placeholder || ''}
                            onChange={(e) => setNewField(prev => ({ ...prev, placeholder: e.target.value }))}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label small">MEAL Instruction / Help Text</label>
                          <input 
                            type="text" 
                            className="form-control form-control-sm"
                            placeholder="e.g. Score must be between 0 and 100"
                            value={newField.helpText || ''}
                            onChange={(e) => setNewField(prev => ({ ...prev, helpText: e.target.value }))}
                          />
                        </div>
                      </div>

                      {newField.type === 'Number' && (
                        <div className="form-grid mb-3">
                          <div className="form-group">
                            <label className="form-label small">Minimum Value</label>
                            <input 
                              type="number" 
                              className="form-control form-control-sm"
                              placeholder="e.g. 0"
                              value={newField.minValue || ''}
                              onChange={(e) => setNewField(prev => ({ ...prev, minValue: e.target.value }))}
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label small">Maximum Value</label>
                            <input 
                              type="number" 
                              className="form-control form-control-sm"
                              placeholder="e.g. 100"
                              value={newField.maxValue || ''}
                              onChange={(e) => setNewField(prev => ({ ...prev, maxValue: e.target.value }))}
                            />
                          </div>
                        </div>
                      )}

                      {/* DYNAMIC OPTION LIST TAG BUILDER */}
                      {['Dropdown', 'Radio'].includes(newField.type) && (
                        <div className="p-3 bg-app rounded border border-light mb-3 text-start">
                          <label className="form-label small fw-bold text-success mb-2">
                            <i className="bi bi-list-check"></i> Options Choice Builder
                          </label>
                          <div className="d-flex gap-1 mb-2">
                            <input
                              type="text"
                              id="new-opt-input"
                              className="form-control form-control-sm"
                              placeholder="Type option and press Enter..."
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  const val = e.target.value.trim();
                                  if (val && !newField.options.includes(val)) {
                                    setNewField(prev => ({ ...prev, options: [...prev.options, val] }));
                                    e.target.value = '';
                                  }
                                }
                              }}
                            />
                            <button
                              type="button"
                              className="btn btn-sm btn-secondary"
                              onClick={() => {
                                const inp = document.getElementById('new-opt-input');
                                const val = inp?.value.trim();
                                if (val && !newField.options.includes(val)) {
                                  setNewField(prev => ({ ...prev, options: [...prev.options, val] }));
                                  inp.value = '';
                                }
                              }}
                            >
                              Add
                            </button>
                          </div>
                          <div className="d-flex flex-wrap gap-1 mt-2">
                            {(!newField.options || newField.options.length === 0) ? (
                              <span className="small text-muted text-italic">No choices added yet. Add some.</span>
                            ) : (
                              newField.options.map((opt, oIdx) => (
                                <span key={oIdx} className="badge bg-secondary-glow text-main border d-flex align-items-center gap-1 py-1 px-2">
                                  {opt}
                                  <i
                                    className="bi bi-x text-danger cursor-pointer fs-6"
                                    onClick={() => setNewField(prev => ({ ...prev, options: prev.options.filter((_, idx) => idx !== oIdx) }))}
                                  ></i>
                                </span>
                              ))
                            )}
                          </div>
                        </div>
                      )}

                      {editingFieldIdx !== null && (
                        <button 
                          type="button" 
                          className="btn btn-sm btn-outline-secondary w-100 mb-2"
                          onClick={() => {
                            setEditingFieldIdx(null);
                            setNewField({
                              name: '', label: '', type: 'Text', options: [], required: false,
                              placeholder: '', helpText: '', minValue: '', maxValue: ''
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
                              name: '', label: '', type: 'Text', options: [], required: false,
                              placeholder: '', helpText: '', minValue: '', maxValue: ''
                            });
                            setEditingFieldIdx(null);
                            setIsKeyManuallyEdited(false);
                            setIsDesigning(false);
                          }}
                          disabled={templateSubmitting}
                        >
                          Clear / Back
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

              {/* RIGHT SIDE: LIVE SMARTPHONE PREVIEW */}
              <div className="col-lg-5">
                <div className="sticky-top" style={{ top: '24px', zIndex: '5' }}>
                  <div className="mobile-preview-device shadow-lg mx-auto">
                    {/* Device Top Speaker and Lens */}
                    <div className="device-header">
                      <div className="device-speaker"></div>
                      <div className="device-camera"></div>
                    </div>

                    {/* Smartphone Screen Content */}
                    <div className="device-screen d-flex flex-column">
                      
                      {/* App Header */}
                      <div className="device-app-bar text-center p-3">
                        <div className="small fw-bold tracking-widest text-uppercase text-muted" style={{ fontSize: '0.62rem' }}>BIMS Mobile Gateway</div>
                        <div className="fw-bold mt-1 text-main text-truncate" style={{ fontSize: '0.92rem' }}>
                          {editingTemplate.templateName || "Activity Registration Form"}
                        </div>
                      </div>

                      {/* Screen scrollable body */}
                      <div className="device-screen-body flex-grow-1">
                        <div className="text-center mb-3">
                          <i className="bi bi-qr-code text-primary" style={{ fontSize: '2.2rem' }}></i>
                          <div className="small text-muted mt-1 text-truncate" style={{ fontSize: '0.72rem' }}>
                            {editingTemplate.description || "Scan to fill out this sheet"}
                          </div>
                        </div>

                        {/* Static Demographics reference */}
                        <div className="device-static-section mb-3 p-2 bg-light rounded text-muted" style={{ fontSize: '0.72rem', opacity: '0.55', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <div className="fw-bold border-bottom pb-1 mb-1 text-primary">Demographics (Central)</div>
                          <div className="d-flex justify-content-between mb-1"><span>Full Name</span><span>* Required</span></div>
                          <div className="d-flex justify-content-between mb-1"><span>Phone Number</span><span>* Required</span></div>
                          <div className="d-flex justify-content-between"><span>Location (Gov/Dist)</span><span>* Required</span></div>
                        </div>

                        {/* Custom Dynamic Fields Live Rendering */}
                        <div className="device-custom-section">
                          <div className="small fw-bold text-warning mb-2 border-bottom pb-1" style={{ fontSize: '0.78rem' }}>
                            Activity Specific Information
                          </div>

                          {editingTemplate.fields.length === 0 ? (
                            <div className="text-center py-4 text-muted small bg-light rounded border border-dashed" style={{ fontSize: '0.72rem' }}>
                              Custom fields added to the schema will dynamically preview here.
                            </div>
                          ) : (
                            <div className="d-flex flex-column gap-2">
                              {editingTemplate.fields.map((field, fIdx) => (
                                <div key={fIdx} className="form-group-mobile">
                                  
                                  {field.type === 'Section Header' ? (
                                    <h6 className="border-bottom pb-1 pt-2 text-primary mt-2 fw-bold" style={{ fontSize: '0.8rem' }}>
                                      {field.label}
                                    </h6>
                                  ) : (
                                    <>
                                      <label className="form-label-mobile mb-1 d-block">
                                        {field.label} {field.required && <span className="text-danger">*</span>}
                                      </label>

                                      {field.type === 'Dropdown' ? (
                                        <select className="form-select form-select-sm form-control" disabled style={{ fontSize: '0.72rem' }}>
                                          <option value="">-- Choose Option --</option>
                                          {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                        </select>
                                      ) : field.type === 'Radio' ? (
                                        <div className="d-flex flex-wrap gap-2 pt-1">
                                          {field.options?.map(opt => (
                                            <div key={opt} className="d-flex align-items-center gap-1" style={{ fontSize: '0.72rem' }}>
                                              <input type="radio" className="form-check-input" disabled />
                                              <label className="text-muted mb-0">{opt}</label>
                                            </div>
                                          ))}
                                        </div>
                                      ) : field.type === 'Checkbox' ? (
                                        <div className="form-check form-switch p-0 d-flex align-items-center gap-2">
                                          <input type="checkbox" className="form-check-input ms-0" disabled style={{ float: 'none' }} />
                                          <span className="small text-muted" style={{ fontSize: '0.72rem' }}>{field.placeholder || "Checked / Yes"}</span>
                                        </div>
                                      ) : field.type === 'Text Area' ? (
                                        <textarea className="form-control form-control-sm" disabled rows="2" placeholder={field.placeholder || "Enter details..."} style={{ fontSize: '0.72rem' }}></textarea>
                                      ) : (
                                        <input 
                                          type={field.type === 'Number' ? 'number' : field.type === 'Date' ? 'date' : 'text'} 
                                          className="form-control form-control-sm" 
                                          disabled 
                                          placeholder={field.placeholder || (field.type === 'Number' ? '0' : 'Enter value...')}
                                          style={{ fontSize: '0.72rem' }}
                                        />
                                      )}

                                      {field.helpText && (
                                        <div className="text-muted style-italic mt-1" style={{ fontSize: '0.68rem', opacity: '0.75' }}>
                                          {field.helpText}
                                        </div>
                                      )}
                                    </>
                                  )}

                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                      </div>

                      {/* Mock Submit button */}
                      <div className="p-3 bg-light border-top">
                        <button className="btn btn-primary btn-sm w-100 py-2 fw-bold" disabled style={{ fontSize: '0.75rem' }}>
                          Submit Registration
                        </button>
                      </div>

                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}
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
