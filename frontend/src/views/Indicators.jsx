import React, { useState, useEffect } from 'react';
import api from '../api';
import * as XLSX from 'xlsx';

export default function Indicators({ user, showToast }) {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState('list'); // 'list', 'add', 'import'
  const [editingId, setEditingId] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [syncingId, setSyncingId] = useState(null);
  const [syncingAll, setSyncingAll] = useState(false);

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    indicatorDescription: '',
    targetValue: '',
    achievedTarget: '',
    bnfType: '',
    numMen: '',
    numWomen: '',
    activityType: ''
  });

  // Excel bulk upload state
  const [excelPreview, setExcelPreview] = useState([]);
  const [excelData, setExcelData] = useState([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  // Load projects list on mount
  useEffect(() => {
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

    // Fetch templates to link to indicators
    api.getTemplates()
      .then(data => {
        setTemplates(data || []);
      })
      .catch(err => {
        console.error('Failed to load templates list', err);
      });
  }, []);

  // Fetch indicators when selected project changes
  useEffect(() => {
    if (selectedProject) {
      fetchIndicators(selectedProject);
    }
  }, [selectedProject]);

  const fetchIndicators = async (pCode) => {
    setLoading(true);
    try {
      const data = await api.getIndicators(pCode);
      setRecords(data);
    } catch (err) {
      showToast(err.message || 'Failed to load project indicators', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Sync a single indicator
  const handleSyncIndicator = async (id) => {
    setSyncingId(id);
    try {
      const updated = await api.syncIndicator(id);
      showToast(`Indicator synchronized successfully! Reached: ${updated.totalBeneficiaries} total.`, 'success');
      setRecords(prev => prev.map(r => r.id === id ? updated : r));
    } catch (err) {
      showToast(err.message || 'Failed to synchronize achievements.', 'danger');
    } finally {
      setSyncingId(null);
    }
  };

  // Sync all indicators of active project
  const handleSyncAllIndicators = async () => {
    const linkable = records.filter(r => r.activityType);
    if (linkable.length === 0) {
      return showToast('No indicators in this project are linked to activity types.', 'warning');
    }

    setSyncingAll(true);
    let successCount = 0;
    let failCount = 0;

    for (const ind of linkable) {
      try {
        await api.syncIndicator(ind.id);
        successCount++;
      } catch (err) {
        console.error(`Sync failed for indicator ${ind.id}:`, err);
        failCount++;
      }
    }

    if (successCount > 0) {
      showToast(`Synced achievements for ${successCount} indicators.${failCount > 0 ? ` Failed: ${failCount}` : ''}`, 'success');
      await fetchIndicators(selectedProject);
    } else {
      showToast('Synchronization failed for linked indicators.', 'danger');
    }
    setSyncingAll(false);
  };

  // Create or update indicator
  const handleSubmitForm = async (e) => {
    e.preventDefault();
    if (!formData.indicatorDescription || !selectedProject) {
      return showToast('Indicator description and project code are required.', 'warning');
    }

    setSubmitting(true);
    try {
      const payload = {
        projectCode: selectedProject,
        indicatorDescription: formData.indicatorDescription,
        targetValue: Number(formData.targetValue) || 0,
        achievedTarget: Number(formData.achievedTarget) || 0,
        bnfType: formData.bnfType,
        numMen: Number(formData.numMen) || 0,
        numWomen: Number(formData.numWomen) || 0,
        activityType: formData.activityType
      };

      if (editingId) {
        await api.updateIndicator(editingId, payload);
        showToast('Indicator updated successfully!', 'success');
      } else {
        await api.createIndicator(payload);
        showToast('Indicator logged successfully!', 'success');
      }

      // Reset form & state
      resetForm();
      await fetchIndicators(selectedProject);
      setActiveSubTab('list');
    } catch (err) {
      showToast(err.message || 'Failed to save indicator record.', 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Edit Mode
  const handleEditClick = (record) => {
    setEditingId(record.id);
    setFormData({
      indicatorDescription: record.indicatorDescription,
      targetValue: record.targetValue,
      achievedTarget: record.achievedTarget,
      bnfType: record.bnfType,
      numMen: record.numMen,
      numWomen: record.numWomen,
      activityType: record.activityType || ''
    });
    setActiveSubTab('add');
  };

  // Delete indicator
  const handleDeleteClick = async (id, description) => {
    const shortDesc = description.length > 40 ? description.substring(0, 40) + '...' : description;
    if (!window.confirm(`Are you sure you want to delete indicator "${shortDesc}"?`)) {
      return;
    }
    setLoading(true);
    try {
      await api.deleteIndicator(id);
      showToast('Indicator deleted successfully.', 'success');
      await fetchIndicators(selectedProject);
    } catch (err) {
      showToast(err.message || 'Failed to delete indicator.', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      indicatorDescription: '',
      targetValue: '',
      achievedTarget: '',
      bnfType: '',
      numMen: '',
      numWomen: '',
      activityType: ''
    });
  };

  // Excel sheet parser
  const handleFileDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer?.files || e.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rows = XLSX.utils.sheet_to_json(ws);
        
        if (rows.length === 0) {
          return showToast('Excel sheet is empty.', 'warning');
        }

        setExcelData(rows);
        setExcelPreview(rows.slice(0, 10));
        showToast(`Parsed ${rows.length} indicators from Excel.`, 'success');
      } catch (err) {
        showToast('Failed to parse Excel file.', 'danger');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleBulkUploadSubmit = async () => {
    if (excelData.length === 0) return;
    setSubmitting(true);
    setUploadResult(null);

    try {
      const res = await api.bulkUploadIndicators(selectedProject, excelData);
      setUploadResult(res);
      showToast(`Batch Indicators Upload Completed successfully.`, 'success');
      setExcelData([]);
      setExcelPreview([]);
      await fetchIndicators(selectedProject);
      setActiveSubTab('list');
    } catch (err) {
      showToast(err.message || 'Batch upload failed.', 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  // Download indicator Excel template
  const handleDownloadTemplate = () => {
    try {
      const headers = [
        'Project Code',
        'Indicator Description',
        'Target Value',
        'Achieved Target',
        'Type of Beneficiaries (BNFs)',
        'Number of Men',
        'Number of Women'
      ];
      
      const sampleRow = {
        'Project Code': selectedProject || 'KU50',
        'Indicator Description': 'Number of youth trained in leadership skills',
        'Target Value': 100,
        'Achieved Target': 85,
        'Type of Beneficiaries (BNFs)': 'Youth',
        'Number of Men': 40,
        'Number of Women': 45
      };

      const ws = XLSX.utils.json_to_sheet([sampleRow], { header: headers });
      ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 3, 20) }));

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Indicators Template');
      XLSX.writeFile(wb, `BIMS_Indicators_Template_${selectedProject || 'Import'}.xlsx`);
      showToast('Excel template downloaded successfully!', 'success');
    } catch (err) {
      showToast('Failed to download template.', 'danger');
    }
  };

  // Export current list to Excel
  const handleExportToExcel = () => {
    if (records.length === 0) {
      return showToast('No records to export.', 'warning');
    }
    try {
      const dataToExport = records.map(r => ({
        'Project Code': r.projectCode,
        'Indicator Description': r.indicatorDescription,
        'Target Value': r.targetValue,
        'Achieved Target': r.achievedTarget,
        'Type of Beneficiaries (BNFs)': r.bnfType,
        'Number of Men': r.numMen,
        'Number of Women': r.numWomen,
        'Total Beneficiaries (Calculated)': r.totalBeneficiaries
      }));
      const ws = XLSX.utils.json_to_sheet(dataToExport);
      ws['!cols'] = Object.keys(dataToExport[0]).map(h => ({ wch: Math.max(h.length + 3, 20) }));
      
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Project Indicators');
      XLSX.writeFile(wb, `TGH_Indicators_Report_${selectedProject}_${new Date().toISOString().slice(0, 10)}.xlsx`);
      showToast('Indicators list exported successfully!', 'success');
    } catch (err) {
      showToast('Export failed.', 'danger');
    }
  };

  // Filter records based on search query
  const filteredRecords = records.filter(r => 
    (r.indicatorDescription || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.bnfType || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Stats calculators
  const totalIndicators = records.length;
  const sumTarget = records.reduce((sum, r) => sum + r.targetValue, 0);
  const sumAchieved = records.reduce((sum, r) => sum + r.achievedTarget, 0);
  const achievedPercentage = sumTarget > 0 ? Math.round((sumAchieved / sumTarget) * 100) : 0;
  const totalMen = records.reduce((sum, r) => sum + r.numMen, 0);
  const totalWomen = records.reduce((sum, r) => sum + r.numWomen, 0);
  const totalBNFs = records.reduce((sum, r) => sum + r.totalBeneficiaries, 0);

  const isPMOrAdmin = ['System Administrator', 'Project Manager', 'MEAL Officer'].includes(user?.role);

  // Calculate live total beneficiaries for the manual form
  const liveTotalBeneficiaries = (Number(formData.numMen) || 0) + (Number(formData.numWomen) || 0);

  return (
    <div className="container-fluid p-0">
      
      {/* SELECTION & TAB NAVIGATION BAR */}
      <div className="glass-card mb-4">
        <div className="row g-3 align-items-end">
          <div className="col-md-5">
            <label htmlFor="indicator-project" className="form-label fw-bold">Active Project</label>
            <select 
              id="indicator-project" 
              className="form-select form-control"
              value={selectedProject}
              onChange={(e) => {
                setSelectedProject(e.target.value);
                resetForm();
              }}
            >
              {projects.map(p => (
                <option key={p.projectCode} value={p.projectCode}>
                  {p.projectCode} - {p.projectName}
                </option>
              ))}
            </select>
          </div>
          
          <div className="col-md-7 d-flex justify-content-md-end">
            <ul className="nav nav-pills gap-2">
              <li className="nav-item">
                <button 
                  className={`btn ${activeSubTab === 'list' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => {
                    setActiveSubTab('list');
                    resetForm();
                  }}
                >
                  <i className="bi bi-list-columns-reverse"></i> Indicators List
                </button>
              </li>
              {isPMOrAdmin && (
                <>
                  <li className="nav-item">
                    <button 
                      className={`btn ${activeSubTab === 'add' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => {
                        if (activeSubTab !== 'add') resetForm();
                        setActiveSubTab('add');
                      }}
                      disabled={!selectedProject}
                    >
                      <i className="bi bi-plus-circle-fill"></i> {editingId ? 'Edit Indicator' : 'Add Indicator'}
                    </button>
                  </li>
                  <li className="nav-item">
                    <button 
                      className={`btn ${activeSubTab === 'import' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => {
                        setActiveSubTab('import');
                        resetForm();
                      }}
                      disabled={!selectedProject}
                    >
                      <i className="bi bi-file-earmark-excel"></i> Excel Import
                    </button>
                  </li>
                </>
              )}
            </ul>
          </div>
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      {activeSubTab === 'list' && (
        <div className="row g-3 mb-4">
          <div className="col-md-2-4 col-sm-6">
            <div className="metric-card bg-primary-glow">
              <div className="metric-icon bg-primary text-white"><i className="bi bi-hash"></i></div>
              <div className="metric-details">
                <div className="metric-val">{totalIndicators}</div>
                <div className="metric-label">Indicators Logged</div>
              </div>
            </div>
          </div>
          <div className="col-md-2-4 col-sm-6">
            <div className="metric-card bg-success-glow">
              <div className="metric-icon bg-success text-white"><i className="bi bi-percent"></i></div>
              <div className="metric-details">
                <div className="metric-val">{achievedPercentage}%</div>
                <div className="metric-label">Overall Achievement</div>
              </div>
            </div>
          </div>
          <div className="col-md-2-4 col-sm-6">
            <div className="metric-card bg-info-glow">
              <div className="metric-icon bg-info text-white"><i className="bi bi-gender-male"></i></div>
              <div className="metric-details">
                <div className="metric-val">{totalMen}</div>
                <div className="metric-label">Total Men Reached</div>
              </div>
            </div>
          </div>
          <div className="col-md-2-4 col-sm-6">
            <div className="metric-card bg-warning-glow">
              <div className="metric-icon bg-warning text-white"><i className="bi bi-gender-female"></i></div>
              <div className="metric-details">
                <div className="metric-val">{totalWomen}</div>
                <div className="metric-label">Total Women Reached</div>
              </div>
            </div>
          </div>
          <div className="col-md-2-4 col-sm-12">
            <div className="metric-card bg-danger-glow">
              <div className="metric-icon bg-danger text-white"><i className="bi bi-people-fill"></i></div>
              <div className="metric-details">
                <div className="metric-val">{totalBNFs}</div>
                <div className="metric-label">Total Beneficiaries (BNFs)</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TABS ROUTER */}
      
      {/* 1. VIEW LIST TAB */}
      {activeSubTab === 'list' && (
        <div className="glass-card">
          <div className="glass-card-header d-flex flex-wrap justify-content-between align-items-center gap-3">
            <div className="glass-card-title text-main">
              <i className="bi bi-clipboard-data text-primary"></i> Indicators Registry: {selectedProject}
            </div>
            
            <div className="d-flex gap-2 align-items-center">
              <input 
                type="text" 
                className="form-control form-control-sm"
                placeholder="Search indicators..."
                style={{ maxWidth: '250px' }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {isPMOrAdmin && (
                <button
                  className="btn btn-sm btn-outline-warning"
                  onClick={handleSyncAllIndicators}
                  disabled={syncingAll || records.length === 0}
                  title="Synchronize all indicators linked to activity types"
                >
                  {syncingAll ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true" style={{ width: '12px', height: '12px' }}></span>
                      Syncing...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-arrow-repeat"></i> Sync All
                    </>
                  )}
                </button>
              )}
              <button 
                className="btn btn-sm btn-success"
                onClick={handleExportToExcel}
                disabled={records.length === 0}
                title="Export list to Excel"
              >
                <i className="bi bi-download"></i> Export Excel
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-warning" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <h5 className="mt-3 text-muted">Retrieving Project Indicators...</h5>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <i className="bi bi-clipboard-check fs-1"></i>
              <h5 className="mt-3">No indicators defined for this project yet.</h5>
              {isPMOrAdmin && (
                <button 
                  className="btn btn-primary btn-sm mt-3"
                  onClick={() => setActiveSubTab('add')}
                >
                  <i className="bi bi-plus-circle"></i> Create First Indicator
                </button>
              )}
            </div>
          ) : (
            <div className="table-responsive">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th style={{ width: '40%' }}>Indicator Description</th>
                    <th>Target Value</th>
                    <th>Achieved Target</th>
                    <th>Progress</th>
                    <th>BNF Type</th>
                    <th>Men Reached</th>
                    <th>Women Reached</th>
                    <th>Total Reached (Calculated)</th>
                    {isPMOrAdmin && <th style={{ textAlign: 'center', width: '150px' }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map(r => {
                    const percent = r.targetValue > 0 ? Math.round((r.achievedTarget / r.targetValue) * 100) : 0;
                    let progressColor = 'bg-danger';
                    if (percent >= 100) progressColor = 'bg-success';
                    else if (percent >= 75) progressColor = 'bg-info';
                    else if (percent >= 50) progressColor = 'bg-warning';

                    return (
                      <tr key={r.id}>
                        <td style={{ whiteSpace: 'normal', verticalAlign: 'middle' }}>
                          <div className="d-flex flex-column">
                            <strong>{r.indicatorDescription}</strong>
                            {r.activityType ? (
                              <span className="badge mt-1 align-self-start border" style={{ backgroundColor: 'var(--color-info-glow)', color: 'var(--color-info)', borderColor: 'var(--color-info)', textTransform: 'none', letterSpacing: 'normal' }}>
                                <i className="bi bi-link-45deg"></i> Auto-Sync: {r.activityType}
                              </span>
                            ) : (
                              <span className="badge mt-1 align-self-start border" style={{ backgroundColor: 'var(--border-color)', color: 'var(--text-muted)', borderColor: 'var(--border-color)', textTransform: 'none', letterSpacing: 'normal' }}>
                                <i className="bi bi-hand-index-thumb"></i> Manual Input
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ verticalAlign: 'middle' }} className="fw-bold">{r.targetValue}</td>
                        <td style={{ verticalAlign: 'middle' }} className="fw-bold text-success">{r.achievedTarget}</td>
                        <td style={{ verticalAlign: 'middle' }}>
                          <div className="d-flex align-items-center gap-2">
                            <div className="progress w-100" style={{ height: '8px', minWidth: '60px', backgroundColor: 'var(--border-color)' }}>
                              <div className={`progress-bar ${progressColor}`} style={{ width: `${Math.min(percent, 100)}%` }}></div>
                            </div>
                            <span className="small fw-bold">{percent}%</span>
                          </div>
                        </td>
                        <td style={{ verticalAlign: 'middle' }}>{r.bnfType ? <span className="badge bg-secondary text-dark">{r.bnfType}</span> : '-'}</td>
                        <td style={{ verticalAlign: 'middle' }}>{r.numMen}</td>
                        <td style={{ verticalAlign: 'middle' }}>{r.numWomen}</td>
                        <td style={{ verticalAlign: 'middle' }} className="fw-bold text-primary">{r.totalBeneficiaries}</td>
                        {isPMOrAdmin && (
                          <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                            <div className="d-flex justify-content-center gap-2">
                              {r.activityType && (
                                <button 
                                  className="btn btn-sm btn-outline-warning py-0 px-2"
                                  onClick={() => handleSyncIndicator(r.id)}
                                  disabled={syncingId === r.id || syncingAll}
                                  title="Synchronize achievements"
                                >
                                  {syncingId === r.id ? (
                                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" style={{ width: '12px', height: '12px' }}></span>
                                  ) : (
                                    <i className="bi bi-arrow-repeat"></i>
                                  )}
                                </button>
                              )}
                              <button 
                                className="btn btn-sm btn-outline-primary py-0 px-2"
                                onClick={() => handleEditClick(r)}
                                title="Edit Indicator"
                              >
                                <i className="bi bi-pencil"></i>
                              </button>
                              <button 
                                className="btn btn-sm btn-outline-danger py-0 px-2"
                                onClick={() => handleDeleteClick(r.id, r.indicatorDescription)}
                                title="Delete Indicator"
                              >
                                <i className="bi bi-trash"></i>
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 2. ADD / EDIT RECORD TAB */}
      {activeSubTab === 'add' && isPMOrAdmin && (
        <div className="glass-card" style={{ maxWidth: '850px', margin: '0 auto' }}>
          <div className="glass-card-header">
            <div className="glass-card-title text-main">
              <i className="bi bi-file-earmark-medical text-primary"></i> {editingId ? 'Edit Project Indicator details' : 'Define New Indicator'}
            </div>
          </div>

          <form onSubmit={handleSubmitForm}>
            <div className="row g-3 mb-3">
              <div className="col-md-6">
                <label className="form-label fw-bold">Project Scope</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={selectedProject} 
                  readOnly 
                  style={{ backgroundColor: 'var(--bg-app)', fontWeight: 'bold' }} 
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Type of Beneficiaries (BNFs) *</label>
                <input 
                  type="text" 
                  name="bnfType"
                  className="form-control"
                  placeholder="e.g. Children, Youth, Farmers, Families..."
                  value={formData.bnfType}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>

            <div className="row g-3 mb-3">
              <div className="col-md-12">
                <label className="form-label">Linked Activity Type (for Automatic Sync)</label>
                <select
                  name="activityType"
                  className="form-select form-control"
                  value={formData.activityType}
                  onChange={handleInputChange}
                >
                  <option value="">-- Manual Input (No auto-sync) --</option>
                  {templates.map(t => (
                    <option key={t.activityType} value={t.activityType}>
                      {t.activityName} ({t.activityType})
                    </option>
                  ))}
                </select>
                <div className="form-text text-muted small mt-1">
                  <i className="bi bi-info-circle text-info"></i> If linked, achieved values and gender breakdown will be synchronized automatically from registrations of this activity type under this project.
                </div>
              </div>
            </div>

            <div className="form-group mb-3">
              <label className="form-label">Indicator Description *</label>
              <textarea 
                name="indicatorDescription"
                className="form-control"
                rows="3"
                placeholder="Describe the indicator goal (e.g. Number of individuals receiving emergency cash assistance)"
                value={formData.indicatorDescription}
                onChange={handleInputChange}
                required
              ></textarea>
            </div>

            <div className="form-grid mb-3">
              <div className="form-group">
                <label className="form-label">Target Goal Value *</label>
                <input 
                  type="number" 
                  name="targetValue"
                  className="form-control"
                  placeholder="Target quantity"
                  value={formData.targetValue}
                  onChange={handleInputChange}
                  required
                  min="0"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Current Achieved Target Value *</label>
                <input 
                  type="number" 
                  name="achievedTarget"
                  className="form-control"
                  placeholder="Achieved quantity"
                  value={formData.achievedTarget}
                  onChange={handleInputChange}
                  required={!formData.activityType}
                  min="0"
                  disabled={!!formData.activityType}
                  style={formData.activityType ? { backgroundColor: 'var(--bg-app)', cursor: 'not-allowed' } : {}}
                />
                {formData.activityType && (
                  <span className="text-info small mt-1">
                    <i className="bi bi-arrow-repeat"></i> Auto-synced from linked activity
                  </span>
                )}
              </div>
            </div>

            <div className="p-3 bg-app rounded border mb-4">
              <h6 className="fw-bold mb-3 text-warning">
                <i className="bi bi-gender-ambiguous"></i> Gender Reach Breakdown
              </h6>
              <div className="row g-3 align-items-center">
                <div className="col-md-4">
                  <div className="form-group mb-0">
                    <label className="form-label small">Number of Men Reached</label>
                    <input 
                      type="number" 
                      name="numMen"
                      className="form-control form-control-sm"
                      placeholder="Men count"
                      value={formData.numMen}
                      onChange={handleInputChange}
                      min="0"
                      disabled={!!formData.activityType}
                      style={formData.activityType ? { backgroundColor: 'var(--bg-app)', cursor: 'not-allowed' } : {}}
                    />
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="form-group mb-0">
                    <label className="form-label small">Number of Women Reached</label>
                    <input 
                      type="number" 
                      name="numWomen"
                      className="form-control form-control-sm"
                      placeholder="Women count"
                      value={formData.numWomen}
                      onChange={handleInputChange}
                      min="0"
                      disabled={!!formData.activityType}
                      style={formData.activityType ? { backgroundColor: 'var(--bg-app)', cursor: 'not-allowed' } : {}}
                    />
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="form-group mb-0">
                    <label className="form-label small">Total Beneficiaries (Calculated)</label>
                    <input 
                      type="text" 
                      className="form-control form-control-sm fw-bold text-primary"
                      value={liveTotalBeneficiaries}
                      readOnly
                      style={{ backgroundColor: 'var(--bg-app)', cursor: 'not-allowed' }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="d-flex justify-content-end gap-2">
              <button 
                type="button" 
                className="btn btn-secondary"
                onClick={() => {
                  setActiveSubTab('list');
                  resetForm();
                }}
                disabled={submitting}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={submitting}
              >
                {submitting ? 'Syncing...' : editingId ? 'Update Indicator' : 'Log Indicator'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 3. EXCEL IMPORT TAB */}
      {activeSubTab === 'import' && isPMOrAdmin && (
        <div className="glass-card">
          <div className="glass-card-header d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div className="glass-card-title text-main">
              <i className="bi bi-file-earmark-excel text-success"></i> Indicators Batch Uploader
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm d-flex align-items-center gap-2"
              onClick={handleDownloadTemplate}
              title="Download Excel Import Template"
            >
              <i className="bi bi-download"></i> Download Template
            </button>
          </div>

          <div 
            className={`upload-dropzone mb-4 ${isDragOver ? 'dragover' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleFileDrop}
          >
            <i className="bi bi-cloud-arrow-up upload-icon fs-1"></i>
            <h5 className="fw-bold">Drag and drop your Indicators Excel file here</h5>
            <p className="text-muted small">Supports template spreadsheet files (.xlsx)</p>
            <div className="text-muted small mb-2">or</div>
            <label className="btn btn-secondary btn-sm px-4">
              Browse Files
              <input 
                type="file" 
                accept=".xlsx" 
                style={{ display: 'none' }} 
                onChange={handleFileDrop}
              />
            </label>
          </div>

          {/* GUIDELINES */}
          <div className="mb-4 bg-app rounded p-3" style={{ border: '1px solid var(--border-color)' }}>
            <div className="small fw-bold text-main mb-2">Required Template Column Headers:</div>
            <div className="small text-muted mb-2">
              <code>Project Code</code>, <code>Indicator Description</code>, <code>Target Value</code>, <code>Achieved Target</code>, <code>Type of Beneficiaries (BNFs)</code>, <code>Number of Men</code>, <code>Number of Women</code>
            </div>
            <div className="small text-muted">
              <strong><i className="bi bi-info-circle text-primary"></i> Tip:</strong> Download the pre-populated template above to ensure headers are perfectly configured!
            </div>
          </div>

          {/* PREVIEW DATAGRID */}
          {excelPreview.length > 0 && (
            <div className="mt-4">
              <h5 className="fw-bold mb-3 text-warning">Parsed Rows Preview ({excelData.length} total)</h5>
              <div className="table-responsive" style={{ maxHeight: '350px' }}>
                <table className="custom-table table-sm">
                  <thead>
                    <tr>
                      <th>Project Code</th>
                      <th>Indicator Description</th>
                      <th>Target</th>
                      <th>Achieved</th>
                      <th>BNF Type</th>
                      <th>Men</th>
                      <th>Women</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {excelPreview.map((row, idx) => {
                      const men = Number(row['Number of Men'] || row['numMen'] || row['num_men']) || 0;
                      const women = Number(row['Number of Women'] || row['numWomen'] || row['num_women']) || 0;
                      return (
                        <tr key={idx}>
                          <td>{row['Project Code'] || row['projectCode'] || row['project_code'] || selectedProject}</td>
                          <td style={{ whiteSpace: 'normal' }}>{row['Indicator Description'] || row['indicatorDescription'] || row['indicator_description']}</td>
                          <td>{row['Target Value'] || row['targetValue'] || row['target_value']}</td>
                          <td>{row['Achieved Target'] || row['achievedTarget'] || row['achieved_target']}</td>
                          <td>{row['Type of Beneficiaries (BNFs)'] || row['bnfType'] || row['bnf_type']}</td>
                          <td>{men}</td>
                          <td>{women}</td>
                          <td className="fw-bold">{men + women}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="d-flex justify-content-end gap-2 mt-4">
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => { setExcelPreview([]); setExcelData([]); }}
                  disabled={submitting}
                >
                  Clear Import
                </button>
                <button 
                  type="button" 
                  className="btn btn-success"
                  onClick={handleBulkUploadSubmit}
                  disabled={submitting}
                >
                  {submitting ? 'Uploading Batch...' : 'Submit Batch Indicators'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
