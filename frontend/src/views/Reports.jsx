import React, { useState, useEffect } from 'react';
import api from '../api';
import * as XLSX from 'xlsx';

export default function Reports({ user, showToast }) {
  const [projects, setProjects] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);

  const canDelete = user && ['System Administrator', 'Project Manager'].includes(user.role);

  // Filters state
  const [filters, setFilters] = useState({
    projectCode: 'All',
    activityType: 'All',
    startDate: '',
    endDate: '',
    query: ''
  });

  // Timeline History Modal State
  const [selectedBnf, setSelectedBnf] = useState(null);
  const [timelineHistory, setTimelineHistory] = useState([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);

  useEffect(() => {
    // Load projects and templates for filtering
    api.getProjects()
      .then(data => setProjects(data))
      .catch(err => showToast('Failed to load projects list', 'danger'));

    api.getTemplates()
      .then(data => setTemplates(data))
      .catch(err => showToast('Failed to load templates list', 'danger'));

    // Run initial search
    handleRunQuery(null);
  }, []);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleRunQuery = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    try {
      const data = await api.getReportsData(filters);
      setRecords(data);
      if (e) showToast(`Query found ${data.length} enrollments.`, 'success');
    } catch (err) {
      showToast(err.message || 'Failed to query reports data.', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const handleBnfClick = async (bnfCode, fullName, recordItem) => {
    setSelectedBnf({
      code: bnfCode,
      name: fullName,
      phone: recordItem.firstPhoneNumber,
      age: recordItem.age,
      gender: recordItem.gender,
      displacementStatus: recordItem.displacementStatus,
      location: `${recordItem.governorate} / ${recordItem.district} / ${recordItem.subdistrict || '-'}`
    });
    setLoadingTimeline(true);
    setTimelineHistory([]);

    try {
      const timeline = await api.getBeneficiaryHistory(bnfCode);
      // Sort timeline chronologically (latest first)
      const sortedTimeline = timeline.sort((a, b) => new Date(b.registrationDate) - new Date(a.registrationDate));
      setTimelineHistory(sortedTimeline);
    } catch (err) {
      showToast(err.message || 'Failed to compile timeline.', 'danger');
    } finally {
      setLoadingTimeline(false);
    }
  };

  const handleExportToExcel = () => {
    if (records.length === 0) {
      return showToast('No rows available to export.', 'warning');
    }

    try {
      // Create worksheet data
      const dataToExport = records.map(r => ({
        "BNF Code": r.bnfCode,
        "Project Code": r.projectCode,
        "Project Name": r.projectName,
        "Donor": r.donor,
        "Activity Code": r.activityCode,
        "Activity Name": r.activityName,
        "Activity Type": r.activityType,
        "Location": r.location,
        "Responsible Staff": r.responsibleStaff,
        "Participant Type": r.participantType,
        "Participant Name English": r.participantNameEnglish,
        "Participant Name Arabic": r.participantNameArabic,
        "Age": r.age,
        "Gender": r.gender,
        "Displacement Status": r.displacementStatus,
        "Phone Number": r.firstPhoneNumber,
        "Governorate": r.governorate,
        "District": r.district,
        "Subdistrict": r.subdistrict,
        "Registration Date": r.registrationDate ? new Date(r.registrationDate).toLocaleDateString() : ''
      }));

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Enrollments");
      
      const fileName = `TGH_BIMS_Report_${new Date().toISOString().slice(0,10)}.xlsx`;
      XLSX.writeFile(wb, fileName);
      showToast(`Excel file ${fileName} downloaded!`, 'success');
    } catch (e) {
      showToast('Excel compiler crashed.', 'danger');
    }
  };

  const handleDeleteClick = async (r) => {
    const fullName = r.participantNameEnglish || r.participantNameArabic || 'this participant';
    const confirmMessage = `Are you sure you want to delete the enrollment for "${fullName}" (${r.bnfCode}) from the activity "${r.activityName}"?\n\nThis action cannot be undone.`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }
    
    try {
      await api.deleteRegistration(r.bnfCode, r.projectCode, r.activityCode);
      showToast('Enrollment deleted successfully!', 'success');
      handleRunQuery(null);
    } catch (err) {
      showToast(err.message || 'Failed to delete enrollment.', 'danger');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <div className="container-fluid p-0">
      
      {/* ADVANCED CRITERIA FILTERS BAR */}
      <div className="glass-card mb-4">
        <form onSubmit={handleRunQuery}>
          <div className="row g-3 align-items-end">
            <div className="col-md-3 col-sm-6">
              <label className="form-label fw-bold">Project Scope</label>
              <select 
                name="projectCode" 
                className="form-select form-control"
                value={filters.projectCode}
                onChange={handleFilterChange}
              >
                <option value="All">All Projects</option>
                {projects.map(p => (
                  <option key={p.projectCode} value={p.projectCode}>
                    {p.projectCode} - {p.projectName}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="col-md-3 col-sm-6">
              <label className="form-label fw-bold">Activity Type</label>
              <select 
                name="activityType" 
                className="form-select form-control"
                value={filters.activityType}
                onChange={handleFilterChange}
              >
                <option value="All">All Form Types</option>
                {templates.map(t => (
                  <option key={t.templateName} value={t.templateName}>
                    {t.templateName}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-2 col-sm-6">
              <label className="form-label fw-bold">Start Date</label>
              <input 
                type="date" 
                name="startDate" 
                className="form-control"
                value={filters.startDate}
                onChange={handleFilterChange}
              />
            </div>

            <div className="col-md-2 col-sm-6">
              <label className="form-label fw-bold">End Date</label>
              <input 
                type="date" 
                name="endDate" 
                className="form-control"
                value={filters.endDate}
                onChange={handleFilterChange}
              />
            </div>

            <div className="col-md-2 d-grid">
              <button type="submit" className="btn btn-primary py-2" disabled={loading}>
                <i className="bi bi-search"></i> Query Database
              </button>
            </div>
          </div>

          <div className="row g-3 mt-1 align-items-center">
            <div className="col-md-10">
              <input 
                type="text" 
                name="query"
                className="form-control" 
                placeholder="Text search filter by Code, Names, or Phone Number..."
                value={filters.query}
                onChange={handleFilterChange}
              />
            </div>
            <div className="col-md-2 d-grid">
              <button 
                type="button" 
                className="btn btn-secondary py-2"
                onClick={handleExportToExcel}
                disabled={loading || records.length === 0}
              >
                <i className="bi bi-file-earmark-excel"></i> Export Excel
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* REPORTS DATA TABLE */}
      <div className="glass-card">
        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-warning" role="status"></div>
            <h5 className="mt-3 text-muted">Running Relational Query...</h5>
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-5 text-muted">
            <i className="bi bi-bar-chart-line fs-1"></i>
            <h5 className="mt-3">No matching records found. Modify your filters and query again.</h5>
          </div>
        ) : (
          <div>
            <div className="small text-muted mb-2">Query result: <strong>{records.length}</strong> enrollments.</div>
            <div className="table-responsive" style={{ maxHeight: '500px', overflowY: 'auto' }}>
              <table className="custom-table" style={{ fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th>BNF Code</th>
                    <th>Project</th>
                    <th>Activity Name</th>
                    <th>Activity Type</th>
                    <th>Participant Name</th>
                    <th>Age</th>
                    <th>Gender</th>
                    <th>Displacement</th>
                    <th>Phone</th>
                    <th>Governorate</th>
                    <th>District</th>
                    <th>Subdistrict</th>
                    <th>Enrollment Date</th>
                    {canDelete && <th style={{ textAlign: 'center' }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {records.map((r, idx) => {
                    const fullName = r.participantNameEnglish || r.participantNameArabic || 'No Name';
                    
                    return (
                      <tr key={idx}>
                        <td>
                          <a 
                            href="#" 
                            onClick={(e) => { e.preventDefault(); handleBnfClick(r.bnfCode, fullName, r); }}
                            style={{ fontWeight: 'bold', textDecoration: 'none', color: 'var(--color-primary)' }}
                          >
                            {r.bnfCode}
                          </a>
                        </td>
                        <td><strong>{r.projectCode}</strong></td>
                        <td style={{ whiteSpace: 'normal', minWidth: '150px' }}>{r.activityName}</td>
                        <td><span className="badge badge-primary">{r.activityType}</span></td>
                        <td style={{ whiteSpace: 'normal', minWidth: '150px' }}>
                          <div>{r.participantNameEnglish || '-'}</div>
                          <div className="text-muted small" style={{ fontSize: '0.75rem' }}>{r.participantNameArabic || '-'}</div>
                        </td>
                        <td>{r.age}</td>
                        <td>{r.gender}</td>
                        <td>{r.displacementStatus}</td>
                        <td>{r.firstPhoneNumber}</td>
                        <td>{r.governorate}</td>
                        <td>{r.district}</td>
                        <td>{r.subdistrict || '-'}</td>
                        <td><span className="small text-muted">{formatDate(r.registrationDate)}</span></td>
                        {canDelete && (
                          <td style={{ textAlign: 'center' }}>
                            <button 
                              className="btn btn-sm btn-danger py-1 px-2 border-0"
                              onClick={() => handleDeleteClick(r)}
                              title="Delete Enrollment"
                            >
                              <i className="bi bi-trash"></i> Delete
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* BENEFICIARY TIMELINE HISTORY MODAL */}
      {selectedBnf && (
        <div className="modal-overlay active">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h5 className="fw-bold"><i className="bi bi-clock-history text-primary"></i> Timeline Activity History</h5>
              <button className="btn-close" onClick={() => setSelectedBnf(null)}></button>
            </div>
            <div className="modal-body" style={{ padding: '0 1rem' }}>
              
              {/* Profile card summary */}
              <div className="glass-card bg-app mb-4" style={{ padding: '1.25rem' }}>
                <h6 className="fw-bold text-main mb-2">{selectedBnf.name}</h6>
                <div className="row g-2 small text-muted">
                  <div className="col-6"><strong>BNF Code:</strong> {selectedBnf.code}</div>
                  <div className="col-6"><strong>Phone Number:</strong> {selectedBnf.phone}</div>
                  <div className="col-6"><strong>Age/Gender:</strong> {selectedBnf.age} / {selectedBnf.gender}</div>
                  <div className="col-6"><strong>Displacement:</strong> {selectedBnf.displacementStatus}</div>
                  <div className="col-12"><strong>Location:</strong> {selectedBnf.location}</div>
                </div>
              </div>

              {/* TIMELINE LIST */}
              <h6 className="fw-bold text-main mb-3">Activity Enrollment Logs</h6>
              
              {loadingTimeline ? (
                <div className="text-center py-4">
                  <div className="spinner-border text-warning spinner-border-sm" role="status"></div>
                  <div className="small text-muted mt-2">Recompiling central timeline logs...</div>
                </div>
              ) : timelineHistory.length === 0 ? (
                <div className="text-center py-4 text-muted small">No enrollment history records compiled.</div>
              ) : (
                <div className="position-relative" style={{ paddingLeft: '1.5rem', borderLeft: '2px dashed var(--border-color)', margin: '0 0.5rem 1.5rem 0.5rem' }}>
                  {timelineHistory.map((item, index) => (
                    <div key={index} className="position-relative mb-4">
                      
                      {/* Timeline dot */}
                      <span className="position-absolute" style={{ left: '-31px', top: '2px', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: 'var(--color-primary)', border: '2px solid var(--bg-surface)' }}></span>
                      
                      <div className="small text-muted">{formatDate(item.registrationDate)}</div>
                      <h6 className="fw-bold text-main mb-0">{item.activityName}</h6>
                      <div className="small text-muted d-flex gap-2 align-items-center mt-1">
                        <span>Project: <strong>{item.projectCode}</strong> ({item.projectName})</span>
                        <span className="badge bg-secondary text-dark px-1 py-0" style={{ fontSize: '0.65rem' }}>{item.activityType}</span>
                      </div>
                      <div className="small text-muted" style={{ fontSize: '0.75rem' }}>Registered by: {item.registeredBy}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedBnf(null)}>Close Timeline</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
