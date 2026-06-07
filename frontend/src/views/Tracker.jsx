import React, { useState, useEffect } from 'react';
import api from '../api';
import * as XLSX from 'xlsx';
import { getGovernorates } from '../utils/iraqiLocations';

export default function Tracker({ user, showToast }) {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [activities, setActivities] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState('list'); // 'list', 'add', 'import'

  // Search filter state
  const [searchQuery, setSearchQuery] = useState('');

  // Manual entry form state
  const [formData, setFormData] = useState({
    activityCode: '',
    staffResponsible: '',
    governorate: '',
    locationNameEn: '',
    locationNameAr: '',
    latitude: '',
    longitude: '',
    trainingProvider: '',
    movLink: '',
    numberOfAttendees: ''
  });

  // Geolocation loading state
  const [gpsLoading, setGpsLoading] = useState(false);

  // Excel drag and drop import state
  const [excelPreview, setExcelPreview] = useState([]);
  const [excelData, setExcelData] = useState([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  // Load projects list
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
  }, []);

  // Fetch activities and tracker records when selected project changes
  useEffect(() => {
    if (selectedProject) {
      fetchData(selectedProject);
    }
  }, [selectedProject]);

  const fetchData = async (pCode) => {
    setLoading(true);
    try {
      const [acts, recs] = await Promise.all([
        api.getActivities(pCode),
        api.getTrackerRecords(pCode)
      ]);
      setActivities(acts);
      setRecords(recs);
    } catch (err) {
      showToast(err.message || 'Failed to load tracker database', 'danger');
    } finally {
      setLoading(false);
    }
  };

  // Prefill staff responsible when activity selection changes
  const handleActivityChange = (e) => {
    const actCode = e.target.value;
    const matchedAct = activities.find(a => a.activityCode === actCode);
    setFormData(prev => ({
      ...prev,
      activityCode: actCode,
      staffResponsible: matchedAct ? matchedAct.responsibleStaff : ''
    }));
  };

  // Browser Geolocation integration
  const handleGetGPSLocation = () => {
    if (!navigator.geolocation) {
      return showToast('Your browser does not support Geolocation.', 'warning');
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData(prev => ({
          ...prev,
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6)
        }));
        setGpsLoading(false);
        showToast('Successfully captured GPS coordinates!', 'success');
      },
      (err) => {
        console.error("GPS capturing error:", err);
        setGpsLoading(false);
        showToast('Unable to capture location coordinates. Please enter manually.', 'warning');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Create single record
  const handleCreateRecord = async (e) => {
    e.preventDefault();
    if (!formData.activityCode || !formData.locationNameEn || !formData.locationNameAr || !formData.governorate) {
      return showToast('Please fill in all required fields.', 'warning');
    }

    const matchedAct = activities.find(a => a.activityCode === formData.activityCode);
    if (!matchedAct) return;

    setSubmitting(true);
    try {
      const payload = {
        projectCode: selectedProject,
        activityCode: formData.activityCode,
        activityType: matchedAct.activityType,
        activityTypeFull: matchedAct.activityName,
        staffResponsible: formData.staffResponsible,
        governorate: formData.governorate,
        locationNameEn: formData.locationNameEn,
        locationNameAr: formData.locationNameAr,
        latitude: formData.latitude,
        longitude: formData.longitude,
        trainingProvider: formData.trainingProvider,
        movLink: formData.movLink,
        numberOfAttendees: Number(formData.numberOfAttendees) || 0
      };

      await api.createTrackerRecord(payload);
      showToast('Activity tracker entry logged successfully!', 'success');
      
      // Reset form
      setFormData({
        activityCode: '',
        staffResponsible: '',
        governorate: '',
        locationNameEn: '',
        locationNameAr: '',
        latitude: '',
        longitude: '',
        trainingProvider: '',
        movLink: '',
        numberOfAttendees: ''
      });
      
      // Refresh list and switch tab
      await fetchData(selectedProject);
      setActiveSubTab('list');
    } catch (err) {
      showToast(err.message || 'Failed to save tracker entry.', 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete single record
  const handleDeleteRecord = async (id, groupCode) => {
    if (!window.confirm(`Are you sure you want to delete group tracking record "${groupCode}"?`)) {
      return;
    }
    setLoading(true);
    try {
      await api.deleteTrackerRecord(id);
      showToast(`Record "${groupCode}" deleted.`, 'success');
      await fetchData(selectedProject);
    } catch (err) {
      showToast(err.message || 'Failed to delete record.', 'danger');
    } finally {
      setLoading(false);
    }
  };

  // Excel parsing logic
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
        const wsname = wb.SheetNames.includes('Activity Tracker') ? 'Activity Tracker' : wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        // Parse raw rows using XLSX headers array format
        const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1 });
        if (rawRows.length <= 1) {
          return showToast('Excel sheet is empty.', 'warning');
        }

        // The template has headers on Row 0 and Lat/Lng subheaders on Row 1
        const headers = rawRows[0];
        const rows = [];
        
        for (let r = 2; r < rawRows.length; r++) {
          const row = rawRows[r];
          if (!row || row.length === 0 || row.every(c => c === undefined || c === '')) continue;
          
          const obj = {};
          headers.forEach((h, colIdx) => {
            if (h && h.trim()) {
              obj[h.trim()] = row[colIdx];
            }
          });
          
          // Fallback parsing for subheaders (latitude on col index 8, longitude on col index 9)
          if (row[8] !== undefined) obj['Latitude'] = row[8];
          if (row[9] !== undefined) obj['Longitude'] = row[9];
          
          rows.push(obj);
        }

        if (rows.length === 0) {
          return showToast('No data rows found in spreadsheet.', 'warning');
        }

        setExcelData(rows);
        setExcelPreview(rows.slice(0, 10));
        showToast(`Parsed ${rows.length} activity tracker records from Excel.`, 'success');
      } catch (err) {
        console.error(err);
        showToast('Failed to parse Excel file. Make sure it follows the database template format.', 'danger');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleBulkUploadSubmit = async () => {
    if (excelData.length === 0) return;
    setSubmitting(true);
    setUploadResult(null);

    try {
      const res = await api.bulkUploadTrackerRecords(selectedProject, excelData);
      setUploadResult(res);
      showToast(`Batch Upload Completed successfully.`, 'success');
      setExcelData([]);
      setExcelPreview([]);
      await fetchData(selectedProject);
      setActiveSubTab('list');
    } catch (err) {
      showToast(err.message || 'Batch upload failed.', 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  // Excel sheet report exporter
  const handleExportToExcel = () => {
    if (records.length === 0) {
      return showToast('No records to export.', 'warning');
    }

    try {
      // Build exactly the double-header template format
      const headerRow1 = [
        'Group Code (THE CODE WILL BE GENERATED AUTOMATICALLY)',
        'Activity type',
        '', // Spacer
        'Activity type (Full Name)',
        'Staff responsible',
        'Site Code  (THE CODE WILL BE GENERATED AUTOMATICALLY)',
        'Activity Location (Site Name EN)',
        'Activity Location (Site Name AR)',
        'GPS Location of the activity',
        '', // Longitude spacer
        'Traning provider',
        'MOVsAttached attendance (Provide the link)',
        'Number of attendees'
      ];
      
      const headerRow2 = [
        '', '', '', '', '', '', '', '', 'Latitude', 'Longitude ', '', '', ''
      ];

      const dataRows = records.map(r => [
        r.groupCode,
        r.activityType,
        '',
        r.activityTypeFull,
        r.staffResponsible,
        r.siteCode,
        r.locationNameEn,
        r.locationNameAr,
        r.latitude,
        r.longitude,
        r.trainingProvider,
        r.movLink,
        r.numberOfAttendees
      ]);

      const aoa = [headerRow1, headerRow2, ...dataRows];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      
      // Apply merged cell config for GPS Location header
      ws['!merges'] = [
        { s: { r: 0, c: 8 }, e: { r: 0, c: 9 } } // Merge Latitude & Longitude header
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Activity Tracker');
      XLSX.writeFile(wb, `TGH_Activity_Tracker_${selectedProject}_${new Date().toISOString().slice(0, 10)}.xlsx`);
      showToast('Activity Tracker downloaded successfully!', 'success');
    } catch (err) {
      showToast('Export failed.', 'danger');
    }
  };

  // Filter records based on search query
  const filteredRecords = records.filter(r => 
    (r.groupCode || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.siteCode || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.activityType || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.locationNameEn || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.locationNameAr || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.staffResponsible || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.trainingProvider || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isPMOrAdmin = ['System Administrator', 'Project Manager'].includes(user?.role);

  return (
    <div className="container-fluid p-0">
      
      {/* SELECTION & TAB NAVIGATION BAR */}
      <div className="glass-card mb-4">
        <div className="row g-3 align-items-end">
          <div className="col-md-5">
            <label htmlFor="tracker-project" className="form-label fw-bold">Active Project</label>
            <select 
              id="tracker-project" 
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
          
          <div className="col-md-7 d-flex justify-content-md-end">
            <ul className="nav nav-pills gap-2">
              <li className="nav-item">
                <button 
                  className={`btn ${activeSubTab === 'list' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setActiveSubTab('list')}
                >
                  <i className="bi bi-list-columns-reverse"></i> Tracked Groups
                </button>
              </li>
              {isPMOrAdmin && (
                <>
                  <li className="nav-item">
                    <button 
                      className={`btn ${activeSubTab === 'add' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setActiveSubTab('add')}
                      disabled={!selectedProject || activities.length === 0}
                    >
                      <i className="bi bi-geo-alt-fill"></i> Log Single Group
                    </button>
                  </li>
                  <li className="nav-item">
                    <button 
                      className={`btn ${activeSubTab === 'import' ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setActiveSubTab('import')}
                      disabled={!selectedProject}
                    >
                      <i className="bi bi-file-earmark-excel"></i> Excel Batch Import
                    </button>
                  </li>
                </>
              )}
            </ul>
          </div>
        </div>
      </div>

      {/* VIEW LIST TAB */}
      {activeSubTab === 'list' && (
        <div className="glass-card">
          <div className="glass-card-header d-flex flex-wrap justify-content-between align-items-center gap-3">
            <div className="glass-card-title text-main">
              <i className="bi bi-geo-fill text-warning"></i> Tracker Database: {selectedProject}
            </div>
            
            <div className="d-flex gap-2 align-items-center">
              <input 
                type="text" 
                className="form-control form-control-sm"
                placeholder="Search tracker..."
                style={{ maxWidth: '250px' }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
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
              <h5 className="mt-3 text-muted">Retrieving Tracker Logs...</h5>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <i className="bi bi-geo-alt fs-1"></i>
              <h5 className="mt-3">No activity group records tracked yet.</h5>
              {activities.length === 0 && (
                <p className="small text-danger">Warning: Create Activities first to track them.</p>
              )}
            </div>
          ) : (
            <div className="table-responsive">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Group Code</th>
                    <th>Site Code</th>
                    <th>Activity</th>
                    <th>Site Location (EN/AR)</th>
                    <th>GPS Coords</th>
                    <th>Responsible / Provider</th>
                    <th>Attendees</th>
                    <th>Link (MoV)</th>
                    {isPMOrAdmin && <th style={{ textAlign: 'center' }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map(r => (
                    <tr key={r.id}>
                      <td><strong>{r.groupCode}</strong></td>
                      <td><span className="badge badge-secondary">{r.siteCode}</span></td>
                      <td>
                        <strong>{r.activityType}</strong>
                        <div className="small text-muted">{r.activityTypeFull}</div>
                      </td>
                      <td>
                        <div>{r.locationNameEn}</div>
                        <div className="small text-muted">{r.locationNameAr}</div>
                      </td>
                      <td>
                        {r.latitude && r.longitude ? (
                          <a 
                            href={`https://www.google.com/maps/search/?api=1&query=${r.latitude},${r.longitude}`}
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-info text-decoration-none small"
                            title="View in Google Maps"
                          >
                            <i className="bi bi-map"></i> {r.latitude}, {r.longitude}
                          </a>
                        ) : '-'}
                      </td>
                      <td>
                        <div>Staff: <strong>{r.staffResponsible}</strong></div>
                        <div className="small text-muted">Provider: {r.trainingProvider || '-'}</div>
                      </td>
                      <td><span className="badge bg-warning-glow text-warning fw-bold px-3">{r.numberOfAttendees}</span></td>
                      <td>
                        {r.movLink ? (
                          <a 
                            href={r.movLink} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="btn btn-sm btn-link text-primary p-0"
                            title="Verify documents attachment"
                          >
                            <i className="bi bi-link-45deg fs-5"></i> Link
                          </a>
                        ) : '-'}
                      </td>
                      {isPMOrAdmin && (
                        <td style={{ textAlign: 'center' }}>
                          <button 
                            className="btn btn-sm btn-outline-danger py-0 px-2"
                            onClick={() => handleDeleteRecord(r.id, r.groupCode)}
                            title="Delete Record"
                          >
                            <i className="bi bi-trash"></i>
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
      )}

      {/* LOG SINGLE GROUP TAB */}
      {activeSubTab === 'add' && isPMOrAdmin && (
        <div className="glass-card" style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div className="glass-card-header">
            <div className="glass-card-title text-main">
              <i className="bi bi-geo-alt-fill text-primary"></i> Track Activity Implementation Site
            </div>
          </div>

          <form onSubmit={handleCreateRecord}>
            <div className="form-group mb-3">
              <label className="form-label">Linked Activity Scope *</label>
              <select 
                className="form-select form-control"
                value={formData.activityCode}
                onChange={handleActivityChange}
                required
              >
                <option value="">-- Select Project Activity --</option>
                {activities.map(a => (
                  <option key={a.activityCode} value={a.activityCode}>
                    {a.activityCode} - {a.activityName} ({a.activityType})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-grid mb-3">
              <div className="form-group">
                <label className="form-label">Staff Responsible</label>
                <input 
                  type="text" 
                  className="form-control"
                  placeholder="Staff name"
                  value={formData.staffResponsible}
                  onChange={(e) => setFormData(prev => ({ ...prev, staffResponsible: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Training / Service Provider</label>
                <input 
                  type="text" 
                  className="form-control"
                  placeholder="e.g. Contractor name, TGH team..."
                  value={formData.trainingProvider}
                  onChange={(e) => setFormData(prev => ({ ...prev, trainingProvider: e.target.value }))}
                />
              </div>
            </div>

            <div className="form-grid mb-3">
              <div className="form-group">
                <label className="form-label">Governorate *</label>
                <select 
                  className="form-select form-control"
                  value={formData.governorate}
                  onChange={(e) => setFormData(prev => ({ ...prev, governorate: e.target.value }))}
                  required
                >
                  <option value="">-- Choose Governorate --</option>
                  {getGovernorates().map(gov => (
                    <option key={gov} value={gov}>{gov}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Number of Attendees / Sessions Size</label>
                <input 
                  type="number" 
                  className="form-control"
                  placeholder="e.g. 15"
                  value={formData.numberOfAttendees}
                  onChange={(e) => setFormData(prev => ({ ...prev, numberOfAttendees: e.target.value }))}
                />
              </div>
            </div>

            <div className="form-grid mb-3">
              <div className="form-group">
                <label className="form-label">Activity Location Name (English) *</label>
                <input 
                  type="text" 
                  className="form-control"
                  placeholder="e.g. Mosul Youth Sports Center"
                  value={formData.locationNameEn}
                  onChange={(e) => setFormData(prev => ({ ...prev, locationNameEn: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Activity Location Name (Arabic) *</label>
                <input 
                  type="text" 
                  className="form-control"
                  placeholder="e.g. منتدى شباب ورياضة الموصل"
                  value={formData.locationNameAr}
                  onChange={(e) => setFormData(prev => ({ ...prev, locationNameAr: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="p-3 bg-app rounded border mb-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h6 className="fw-bold mb-0 text-warning">
                  <i className="bi bi-pin-map-fill"></i> GPS Coordinates (Optional)
                </h6>
                <button 
                  type="button" 
                  className="btn btn-sm btn-outline-primary"
                  onClick={handleGetGPSLocation}
                  disabled={gpsLoading}
                >
                  {gpsLoading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                      Detecting Coords...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-geo"></i> Use My GPS Location
                    </>
                  )}
                </button>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label small">Latitude</label>
                  <input 
                    type="text" 
                    className="form-control form-control-sm"
                    placeholder="e.g. 36.34891"
                    value={formData.latitude}
                    onChange={(e) => setFormData(prev => ({ ...prev, latitude: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label small">Longitude</label>
                  <input 
                    type="text" 
                    className="form-control form-control-sm"
                    placeholder="e.g. 43.12567"
                    value={formData.longitude}
                    onChange={(e) => setFormData(prev => ({ ...prev, longitude: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <div className="form-group mb-4">
              <label className="form-label">MOVs / Verification Link (Google Drive / OneDrive Folder Link)</label>
              <input 
                type="url" 
                className="form-control"
                placeholder="https://drive.google.com/drive/folders/..."
                value={formData.movLink}
                onChange={(e) => setFormData(prev => ({ ...prev, movLink: e.target.value }))}
              />
              <small className="text-muted">Link to verification materials (attendance sheet photos, signed receipts, initiatives reports).</small>
            </div>

            <div className="d-flex justify-content-end gap-2">
              <button 
                type="button" 
                className="btn btn-secondary"
                onClick={() => setActiveSubTab('list')}
                disabled={submitting}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={submitting || !formData.activityCode}
              >
                {submitting ? 'Syncing...' : 'Log Tracker Record'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* EXCEL IMPORT TAB */}
      {activeSubTab === 'import' && isPMOrAdmin && (
        <div className="glass-card">
          <div className="glass-card-header">
            <div className="glass-card-title text-main">
              <i className="bi bi-file-earmark-excel text-success"></i> Activity Tracker Batch Uploader
            </div>
          </div>

          <div 
            className={`upload-dropzone mb-4 ${isDragOver ? 'dragover' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleFileDrop}
          >
            <i className="bi bi-cloud-arrow-up upload-icon fs-1"></i>
            <h5 className="fw-bold">Drag and drop your Activity Tracker Excel file here</h5>
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
            <div className="small text-muted">
              <code>Group Code</code>, <code>Activity type</code>, <code>Activity type (Full Name)</code>, <code>Staff responsible</code>, <code>Site Code</code>, <code>Activity Location (Site Name EN)</code>, <code>Activity Location (Site Name AR)</code>, <code>Latitude</code>, <code>Longitude</code>, <code>Traning provider</code>, <code>MOVsAttached attendance (Provide the link)</code>, <code>Number of attendees</code>
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
                      <th>Activity type</th>
                      <th>Staff responsible</th>
                      <th>Location Name EN</th>
                      <th>Location Name AR</th>
                      <th>GPS Location</th>
                      <th>Provider</th>
                      <th>Attendees</th>
                    </tr>
                  </thead>
                  <tbody>
                    {excelPreview.map((row, idx) => (
                      <tr key={idx}>
                        <td>{row['Activity type'] || row['Activity type (Full Name)']}</td>
                        <td>{row['Staff responsible']}</td>
                        <td>{row['Activity Location (Site Name EN)']}</td>
                        <td>{row['Activity Location (Site Name AR)']}</td>
                        <td>{row['Latitude'] && row['Longitude'] ? `${row['Latitude']}, ${row['Longitude']}` : '-'}</td>
                        <td>{row['Traning provider']}</td>
                        <td>{row['Number of attendees']}</td>
                      </tr>
                    ))}
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
                  {submitting ? 'Uploading Batch...' : 'Submit Batch Tracker Records'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
