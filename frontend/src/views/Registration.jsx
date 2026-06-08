import React, { useState, useEffect, useRef } from 'react';
import api from '../api';
import * as XLSX from 'xlsx';
import { getGovernorates, getDistricts, getSubdistricts } from '../utils/iraqiLocations';

export default function Registration({ user, regParams, setRegParams, showToast }) {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [activities, setActivities] = useState([]);
  const [selectedActivity, setSelectedActivity] = useState('');
  
  // Tab control: 'single' or 'bulk'
  const [regMode, setRegMode] = useState('single');

  // Districts and Subdistricts lookup state lists
  const [districtsList, setDistrictsList] = useState([]);
  const [subdistrictsList, setSubdistrictsList] = useState([]);

  const handleGovChange = (e) => {
    const gov = e.target.value;
    setCommonData(prev => ({
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
    setCommonData(prev => ({
      ...prev,
      district: dist,
      subdistrict: ''
    }));
    setSubdistrictsList(getSubdistricts(commonData.governorate, dist));
  };

  // Form payload states
  const [isExistingProfile, setIsExistingProfile] = useState(false);
  const [commonData, setCommonData] = useState({
    bnfCode: 'New',
    participantType: 'Beneficiary',
    participantNameEnglish: '',
    participantNameArabic: '',
    age: '',
    gender: 'Male',
    displacementStatus: 'Host Community',
    firstPhoneNumber: '',
    secondPhoneNumber: '',
    governorate: '',
    district: '',
    subdistrict: ''
  });
  const [dynamicData, setDynamicData] = useState({});
  const [activeTemplateFields, setActiveTemplateFields] = useState([]);
  
  // Live autocomplete search states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchTimer = useRef(null);

  // Duplicate match alert states
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Bulk upload states
  const [excelPreview, setExcelPreview] = useState([]);
  const [excelData, setExcelData] = useState([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  useEffect(() => {
    // Fetch projects on mount
    api.getProjects()
      .then(data => {
        setProjects(data);
        
        // Check if navigated with parameters
        if (regParams && regParams.projectCode) {
          setSelectedProject(regParams.projectCode);
        } else if (data.length > 0) {
          setSelectedProject(data[0].projectCode);
        }
      })
      .catch(err => {
        showToast(err.message || 'Failed to load projects list', 'danger');
      });
  }, []);

  // Fetch activities when selected project changes
  useEffect(() => {
    if (selectedProject) {
      api.getActivities(selectedProject)
        .then(data => {
          setActivities(data);
          
          if (regParams && regParams.activityCode && regParams.projectCode === selectedProject) {
            setSelectedActivity(regParams.activityCode);
            // Clear route params after consumption
            setRegParams(null);
          } else if (data.length > 0) {
            setSelectedActivity(data[0].activityCode);
          } else {
            setSelectedActivity('');
            setActiveTemplateFields([]);
          }
        })
        .catch(err => {
          showToast(err.message || 'Failed to load activities', 'danger');
        });
    }
  }, [selectedProject]);

  // Fetch template fields for selected activity
  useEffect(() => {
    if (selectedActivity && selectedProject) {
      const act = activities.find(a => a.activityCode === selectedActivity);
      if (act) {
        api.getTemplates()
          .then(templates => {
            const template = templates.find(t => t.templateName === act.activityType);
            if (template) {
              setActiveTemplateFields(template.fields || []);
              
              // Seed initial dynamic form values
              const initialDyn = {};
              template.fields.forEach(f => {
                initialDyn[f.name] = f.type === 'Checkbox' ? false : '';
              });
              setDynamicData(initialDyn);
            } else {
              setActiveTemplateFields([]);
              setDynamicData({});
            }
          });
      }
    } else {
      setActiveTemplateFields([]);
      setDynamicData({});
    }
  }, [selectedActivity, activities]);

  // Automatically calculate sessions attended from session_1, session_2, etc. fields
  useEffect(() => {
    let count = 0;
    let hasSessionFields = false;
    for (const key in dynamicData) {
      if (/^session_\d+$/i.test(key)) {
        hasSessionFields = true;
        if (dynamicData[key] === 'Attended') {
          count++;
        }
      }
    }
    if (hasSessionFields) {
      const targetKey = 'sessions_attended' in dynamicData ? 'sessions_attended' : ('num_sessions' in dynamicData ? 'num_sessions' : null);
      if (targetKey && Number(dynamicData[targetKey] || 0) !== count) {
        setDynamicData(prev => ({ ...prev, [targetKey]: count }));
      }
    }
  }, [dynamicData]);

  // Handle Autocomplete Live Search
  const handleSearchChange = (e) => {
    const q = e.target.value;
    setSearchQuery(q);

    if (searchTimer.current) clearTimeout(searchTimer.current);

    if (q.trim().length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    searchTimer.current = setTimeout(() => {
      api.searchBeneficiaries(q)
        .then(results => {
          setSearchResults(results);
          setShowDropdown(results.length > 0);
        });
    }, 300);
  };

  // Bind selected beneficiary profile
  const handleSelectProfile = (p) => {
    setCommonData({
      bnfCode: p.bnfCode,
      participantType: 'Beneficiary',
      participantNameEnglish: p.participantNameEnglish || '',
      participantNameArabic: p.participantNameArabic || '',
      age: p.age || '',
      gender: p.gender || 'Male',
      displacementStatus: p.displacementStatus || 'Host Community',
      firstPhoneNumber: p.firstPhoneNumber || '',
      secondPhoneNumber: p.secondPhoneNumber || '',
      governorate: p.governorate || '',
      district: p.district || '',
      subdistrict: p.subdistrict || ''
    });
    setIsExistingProfile(true);
    setShowDropdown(false);
    setSearchQuery('');
    setDistrictsList(getDistricts(p.governorate));
    setSubdistrictsList(getSubdistricts(p.governorate, p.district));
    showToast(`Linked beneficiary: ${p.fullName} (${p.bnfCode})`, 'info');
  };

  const handleClearProfile = () => {
    setCommonData({
      bnfCode: 'New',
      participantType: 'Beneficiary',
      participantNameEnglish: '',
      participantNameArabic: '',
      age: '',
      gender: 'Male',
      displacementStatus: 'Host Community',
      firstPhoneNumber: '',
      secondPhoneNumber: '',
      governorate: '',
      district: '',
      subdistrict: ''
    });
    setIsExistingProfile(false);
    setSearchQuery('');
    setDistrictsList([]);
    setSubdistrictsList([]);
  };

  const handleCommonChange = (e) => {
    const { name, value } = e.target;
    setCommonData(prev => ({ ...prev, [name]: value }));
  };

  const handleDynamicChange = (e) => {
    const { name, value } = e.target;
    setDynamicData(prev => ({ ...prev, [name]: value }));
  };

  // Submit enrollment
  const handleSubmitEnrollment = async (e, force = false) => {
    if (e) e.preventDefault();
    if (!selectedProject || !selectedActivity) {
      return showToast('Please select a project and activity.', 'warning');
    }

    setSubmitting(true);
    try {
      const res = await api.registerParticipant(selectedProject, selectedActivity, commonData, dynamicData, force);
      
      if (res.status === 'duplicate_warning') {
        // Show duplicate modal
        setDuplicateWarning(res);
      } else {
        showToast(`Participant enrolled successfully. BNF Code: ${res.bnfCode}`, 'success');
        setDuplicateWarning(null);
        
        // Reset dynamic questionnaire inputs, keeping common data if they want to register for another activity
        // or reset everything
        handleClearProfile();
        
        // Reset dynamic inputs
        const cleanDyn = {};
        activeTemplateFields.forEach(f => { cleanDyn[f.name] = f.type === 'Checkbox' ? false : ''; });
        setDynamicData(cleanDyn);
      }
    } catch (err) {
      showToast(err.message || 'Registration failed.', 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  // Link duplicate match profile instead
  const handleLinkDuplicate = (match) => {
    handleSelectProfile({
      bnfCode: match.bnfCode,
      participantNameEnglish: match.nameEng,
      participantNameArabic: match.nameAra,
      age: match.age,
      gender: match.gender,
      displacementStatus: match.displacement,
      firstPhoneNumber: match.phone,
      governorate: match.location.split(' / ')[0] || '',
      district: match.location.split(' / ')[1] || ''
    });
    setDuplicateWarning(null);
  };

  // Excel batch parser
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
        setExcelPreview(rows.slice(0, 10)); // show top 10 preview
        showToast(`Loaded ${rows.length} rows from Excel spreadsheet.`, 'success');
      } catch (err) {
        showToast('Failed to parse Excel file. Ensure it is a valid .xlsx file.', 'danger');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleDownloadTemplate = () => {
    try {
      // 1. Core demographic fields expected by the backend
      const headers = [
        'participantNameEnglish',
        'participantNameArabic',
        'age',
        'gender',
        'displacementStatus',
        'firstPhoneNumber',
        'secondPhoneNumber',
        'governorate',
        'district',
        'subdistrict',
        'participantType',
        'bnfCode'
      ];

      // 2. Add dynamic questionnaire fields of the active template
      activeTemplateFields.forEach(field => {
        if (!headers.includes(field.name)) {
          headers.push(field.name);
        }
      });

      // 3. Construct sample data row
      const sampleRow = {
        participantNameEnglish: 'John Doe',
        participantNameArabic: 'جون دو',
        age: 30,
        gender: 'Male',
        displacementStatus: 'Host Community',
        firstPhoneNumber: '07701234567',
        secondPhoneNumber: '07501234567',
        governorate: commonData.governorate || 'Nineveh',
        district: commonData.district || 'Mosul',
        subdistrict: commonData.subdistrict || 'Mosul',
        participantType: 'Beneficiary',
        bnfCode: 'New'
      };

      // Populate dynamic fields with appropriate samples
      activeTemplateFields.forEach(field => {
        if (field.type === 'Dropdown' && field.options && field.options.length > 0) {
          sampleRow[field.name] = field.options[0];
        } else if (field.type === 'Number') {
          sampleRow[field.name] = 10;
        } else if (field.type === 'Date') {
          sampleRow[field.name] = new Date().toISOString().split('T')[0];
        } else {
          sampleRow[field.name] = 'Sample Value';
        }
      });

      // Generate worksheet
      const ws = XLSX.utils.json_to_sheet([sampleRow], { header: headers });
      
      // Auto-fit column widths nicely
      ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 3, 18) }));

      const wb = XLSX.utils.book_new();
      
      // Extract activity code/name for sheet tab name
      const act = activities.find(a => a.activityCode === selectedActivity);
      const sheetName = act ? act.activityCode.substring(0, 30) : 'Template';
      
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      
      const fileName = `BIMS_Template_${selectedProject}_${selectedActivity || 'Import'}.xlsx`;
      XLSX.writeFile(wb, fileName);
      
      showToast(`Excel template ${fileName} downloaded successfully!`, 'success');
    } catch (err) {
      showToast(err.message || 'Failed to download template.', 'danger');
    }
  };

  const handleBulkUploadSubmit = async () => {
    if (excelData.length === 0) return;
    setSubmitting(true);
    setUploadResult(null);

    try {
      const res = await api.bulkUploadBeneficiaries(selectedProject, selectedActivity, excelData);
      setUploadResult(res);
      showToast(`Batch Upload Complete: ${res.successCount} Successes, ${res.errorCount} Errors`, 'info');
      setExcelData([]);
      setExcelPreview([]);
    } catch (err) {
      showToast(err.message || 'Batch enrollment request failed.', 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container-fluid p-0">
      
      {/* SELECTION BAR */}
      <div className="glass-card mb-4">
        <div className="row g-3">
          <div className="col-md-6">
            <label htmlFor="reg-project" className="form-label fw-bold">Project Scope</label>
            <select 
              id="reg-project" 
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
          <div className="col-md-6">
            <label htmlFor="reg-activity" className="form-label fw-bold">Enrollment Activity</label>
            <select 
              id="reg-activity" 
              className="form-select form-control"
              value={selectedActivity}
              onChange={(e) => setSelectedActivity(e.target.value)}
              disabled={activities.length === 0}
            >
              {activities.length === 0 ? (
                <option value="">-- No Active Activities --</option>
              ) : (
                activities.map(a => (
                  <option key={a.activityCode} value={a.activityCode}>
                    {a.activityCode} - {a.activityName} ({a.activityType})
                  </option>
                ))
              )}
            </select>
          </div>
        </div>
      </div>

      {activities.length > 0 && (
        <div className="mb-4">
          <ul className="nav nav-pills gap-2">
            <li className="nav-item">
              <button 
                className={`btn ${regMode === 'single' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setRegMode('single')}
              >
                <i className="bi bi-person-plus"></i> Single Registration
              </button>
            </li>
            <li className="nav-item">
              <button 
                className={`btn ${regMode === 'bulk' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setRegMode('bulk')}
              >
                <i className="bi bi-file-earmark-excel"></i> Excel Batch Upload
              </button>
            </li>
          </ul>
        </div>
      )}

      {/* SINGLE REGISTRATION MODE */}
      {regMode === 'single' && activities.length > 0 && (
        <div className="row g-4">
          
          {/* COMMON REGISTRY FORM */}
          <div className="col-lg-7">
            <div className="glass-card">
              <div className="glass-card-header">
                <div className="glass-card-title text-main">
                  <i className="bi bi-person-fill text-primary"></i> Demographic Registry Form
                </div>
                {isExistingProfile && (
                  <span className="badge bg-success-glow text-success fw-bold">Linked: {commonData.bnfCode}</span>
                )}
              </div>

              {/* AUTOCOMPLETE LIVE LOOKUP */}
              <div className="form-group mb-4 position-relative">
                <label className="form-label fw-bold text-primary">
                  <i className="bi bi-search"></i> Search Registry to Link Profile (Avoid Duplicates)
                </label>
                <input 
                  type="text" 
                  className="form-control"
                  placeholder="Type name, phone, or BNF Code to lookup profile..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                />
                
                {showDropdown && (
                  <ul className="search-results-dropdown active">
                    {searchResults.map(p => (
                      <li 
                        key={p.bnfCode} 
                        className="search-result-item"
                        onClick={() => handleSelectProfile(p)}
                      >
                        <div className="search-result-title">{p.fullName} ({p.bnfCode})</div>
                        <div className="search-result-subtitle">
                          {p.gender} | Age: {p.age} | Phone: {p.firstPhoneNumber} | {p.governorate}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {isExistingProfile && (
                  <button 
                    type="button" 
                    className="btn btn-sm btn-secondary mt-2" 
                    onClick={handleClearProfile}
                  >
                    <i className="bi bi-trash"></i> Unlink / Register New Profile
                  </button>
                )}
              </div>

              <form onSubmit={(e) => handleSubmitEnrollment(e, false)}>
                
                <div className="form-grid mb-3">
                  <div className="form-group">
                    <label className="form-label">Beneficiary ID Code</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={commonData.bnfCode} 
                      readOnly 
                      style={{ backgroundColor: 'var(--bg-app)', fontWeight: 'bold' }} 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Participant Enrollment Type *</label>
                    <select 
                      name="participantType"
                      className="form-select form-control"
                      value={commonData.participantType}
                      onChange={handleCommonChange}
                      required
                    >
                      <option value="Beneficiary">Direct Beneficiary</option>
                      <option value="Community Leader">Community Leader</option>
                      <option value="Stakeholder">Government / Stakeholder</option>
                      <option value="Partner">TGH Implementing Partner</option>
                    </select>
                  </div>
                </div>

                <div className="form-grid mb-3">
                  <div className="form-group">
                    <label className="form-label">Full Name English *</label>
                    <input 
                      type="text" 
                      name="participantNameEnglish"
                      className="form-control" 
                      placeholder="First Middle Last"
                      value={commonData.participantNameEnglish}
                      onChange={handleCommonChange}
                      disabled={isExistingProfile}
                      required={!commonData.participantNameArabic}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Full Name Arabic *</label>
                    <input 
                      type="text" 
                      name="participantNameArabic"
                      className="form-control" 
                      placeholder="الاسم الثلاثي واللقب"
                      value={commonData.participantNameArabic}
                      onChange={handleCommonChange}
                      disabled={isExistingProfile}
                      required={!commonData.participantNameEnglish}
                    />
                  </div>
                </div>

                <div className="form-grid mb-3">
                  <div className="form-group">
                    <label className="form-label">Age *</label>
                    <input 
                      type="number" 
                      name="age"
                      className="form-control" 
                      placeholder="Years"
                      value={commonData.age}
                      onChange={handleCommonChange}
                      disabled={isExistingProfile}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Gender *</label>
                    <select 
                      name="gender"
                      className="form-select form-control"
                      value={commonData.gender}
                      onChange={handleCommonChange}
                      disabled={isExistingProfile}
                      required
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Displacement Status *</label>
                    <select 
                      name="displacementStatus"
                      className="form-select form-control"
                      value={commonData.displacementStatus}
                      onChange={handleCommonChange}
                      disabled={isExistingProfile}
                      required
                    >
                      <option value="Host Community">Host Community</option>
                      <option value="IDP">IDP (Displaced)</option>
                      <option value="Returnee">Returnee</option>
                      <option value="Refugee">Refugee</option>
                    </select>
                  </div>
                </div>

                <div className="form-grid mb-3">
                  <div className="form-group">
                    <label className="form-label">Primary Phone Number *</label>
                    <input 
                      type="tel" 
                      name="firstPhoneNumber"
                      className="form-control" 
                      placeholder="0770xxxxxxx"
                      value={commonData.firstPhoneNumber}
                      onChange={handleCommonChange}
                      disabled={isExistingProfile}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Secondary Phone Number</label>
                    <input 
                      type="tel" 
                      name="secondPhoneNumber"
                      className="form-control" 
                      placeholder="Optional"
                      value={commonData.secondPhoneNumber}
                      onChange={handleCommonChange}
                      disabled={isExistingProfile}
                    />
                  </div>
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Governorate *</label>
                    <select
                      name="governorate"
                      className="form-select form-control"
                      value={commonData.governorate}
                      onChange={handleGovChange}
                      disabled={isExistingProfile}
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
                      name="district"
                      className="form-select form-control"
                      value={commonData.district}
                      onChange={handleDistrictChange}
                      disabled={isExistingProfile || !commonData.governorate}
                      required
                    >
                      <option value="">-- Choose District --</option>
                      {districtsList.map(dist => (
                        <option key={dist} value={dist}>{dist}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Subdistrict</label>
                    <select
                      name="subdistrict"
                      className="form-select form-control"
                      value={commonData.subdistrict}
                      onChange={handleCommonChange}
                      disabled={isExistingProfile || !commonData.district}
                    >
                      <option value="">-- Choose Subdistrict --</option>
                      {subdistrictsList.map(sub => (
                        <option key={sub} value={sub}>{sub}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Submitting Loader */}
                {submitting && (
                  <div className="mt-4 p-2 bg-warning-glow text-warning rounded text-center small fw-bold">
                    <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                    Syncing Enrollment with Master Sheets Database...
                  </div>
                )}
              </form>
            </div>
          </div>

          {/* DYNAMIC ACTIVITY TEMPLATE FIELDS */}
          <div className="col-lg-5">
            <div className="glass-card h-100 d-flex flex-column justify-content-between">
              <div>
                <div className="glass-card-header">
                  <div className="glass-card-title text-main">
                    <i className="bi bi-clipboard-check text-warning"></i> Activity Dynamic Form
                  </div>
                </div>

                {activeTemplateFields.length === 0 ? (
                  <div className="text-center py-5 text-muted">
                    <i className="bi bi-file-earmark-text fs-2"></i>
                    <p className="mt-2 small">This activity has no custom indicators defined.</p>
                  </div>
                ) : (
                  <div className="d-flex flex-column gap-3">
                    {activeTemplateFields.map(field => {
                      const inputName = field.name;

                      // 1. Render Section Header
                      if (field.type === 'Section Header') {
                        return (
                          <div key={inputName} className="mt-4 border-bottom pb-2">
                            <h5 className="text-primary fw-bold mb-1">{field.label}</h5>
                            {field.helpText && <small className="text-muted d-block">{field.helpText}</small>}
                          </div>
                        );
                      }

                      // 2. Render Checkbox (as a Switch Toggle)
                      if (field.type === 'Checkbox') {
                        return (
                          <div key={inputName} className="form-check form-switch my-3">
                            <input
                              type="checkbox"
                              className="form-check-input"
                              id={inputName}
                              name={inputName}
                              checked={!!dynamicData[inputName]}
                              onChange={(e) => setDynamicData(prev => ({ ...prev, [inputName]: e.target.checked }))}
                            />
                            <label className="form-check-label fw-bold ms-2 cursor-pointer" htmlFor={inputName}>
                              {field.label} {field.required && <span className="text-danger">*</span>}
                            </label>
                            {field.helpText && <small className="d-block text-muted mt-1">{field.helpText}</small>}
                          </div>
                        );
                      }

                      // 3. Render Radio choice buttons
                      if (field.type === 'Radio') {
                        return (
                          <div key={inputName} className="form-group">
                            <label className="form-label fw-bold mb-2">{field.label} {field.required && <span className="text-danger">*</span>}</label>
                            <div className="d-flex flex-wrap gap-3">
                              {field.options?.map(opt => (
                                <div key={opt} className="form-check">
                                  <input
                                    type="radio"
                                    className="form-check-input"
                                    id={`${inputName}-${opt}`}
                                    name={inputName}
                                    value={opt}
                                    checked={dynamicData[inputName] === opt}
                                    onChange={handleDynamicChange}
                                    required={field.required}
                                  />
                                  <label className="form-check-label ms-1 cursor-pointer" htmlFor={`${inputName}-${opt}`}>
                                    {opt}
                                  </label>
                                </div>
                              ))}
                            </div>
                            {field.helpText && <small className="d-block text-muted mt-1">{field.helpText}</small>}
                          </div>
                        );
                      }

                      // 4. Render Dropdowns, Text Areas, and Standard Inputs
                      return (
                        <div key={inputName} className="form-group">
                          <label className="form-label fw-bold mb-1">{field.label} {field.required && '*'}</label>
                          
                          {field.type === 'Dropdown' ? (
                            <select
                              name={inputName}
                              className="form-select form-control"
                              value={dynamicData[inputName] || ''}
                              onChange={handleDynamicChange}
                              required={field.required}
                            >
                              <option value="">-- Choose Option --</option>
                              {field.options?.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          ) : field.type === 'Text Area' ? (
                            <textarea
                              name={inputName}
                              className="form-control"
                              rows="3"
                              placeholder={field.placeholder || ''}
                              value={dynamicData[inputName] || ''}
                              onChange={handleDynamicChange}
                              required={field.required}
                            ></textarea>
                          ) : (() => {
                            const isReadOnly = (field.name === 'sessions_attended' || field.name === 'num_sessions') && 
                                               activeTemplateFields.some(f => /^session_\d+$/i.test(f.name));
                            return (
                              <input
                                type={field.type === 'Number' ? 'number' : field.type === 'Date' ? 'date' : 'text'}
                                name={inputName}
                                className="form-control"
                                placeholder={field.placeholder || ''}
                                value={dynamicData[inputName] || ''}
                                onChange={handleDynamicChange}
                                required={field.required}
                                readOnly={isReadOnly}
                                min={field.type === 'Number' ? (field.minValue || undefined) : undefined}
                                max={field.type === 'Number' ? (field.maxValue || undefined) : undefined}
                                style={isReadOnly ? { backgroundColor: 'var(--bg-app)', cursor: 'not-allowed' } : {}}
                              />
                            );
                          })()}

                          {field.helpText && (
                            <small className="d-block text-muted mt-1">
                              <i className="bi bi-info-circle"></i> {field.helpText}
                            </small>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="mt-4">
                <button 
                  type="button" 
                  className="btn btn-primary w-100 py-3 fw-bold"
                  onClick={() => handleSubmitEnrollment(null, false)}
                  disabled={submitting}
                >
                  <i className="bi bi-send-fill"></i> Submit Registry & Enroll
                </button>
              </div>

            </div>
          </div>

        </div>
      )}

      {/* BATCH UPLOAD MODE */}
      {regMode === 'bulk' && activities.length > 0 && (
        <div className="glass-card">
          <div className="glass-card-header d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div className="glass-card-title text-main">
              <i className="bi bi-file-earmark-excel text-success"></i> Batch Excel Import Canvas
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm d-flex align-items-center gap-2"
              onClick={handleDownloadTemplate}
              title="Download Excel Import Template"
            >
              <i className="bi bi-download"></i> Download Excel Template
            </button>
          </div>

          {/* DND DROPZONE */}
          <div 
            className={`upload-dropzone mb-4 ${isDragOver ? 'dragover' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleFileDrop}
          >
            <i className="bi bi-cloud-arrow-up upload-icon fs-1"></i>
            <h5 className="fw-bold">Drag and drop your project Excel file here</h5>
            <p className="text-muted small">Supports standard spreadsheet files (.xlsx, .xls)</p>
            <div className="text-muted small mb-2">or</div>
            <label className="btn btn-secondary btn-sm px-4">
              Browse Files
              <input 
                type="file" 
                accept=".xlsx, .xls" 
                style={{ display: 'none' }} 
                onChange={handleFileDrop}
              />
            </label>
          </div>

          {/* Column structure guidelines */}
          <div className="mb-4 bg-app rounded p-3" style={{ border: '1px solid var(--border-color)' }}>
            <div className="small fw-bold text-main mb-2">Column Headers Guidelines:</div>
            <div className="small text-muted mb-2">
              The Excel sheet must contain these exact column headers: 
              <code>participantNameEnglish</code>, <code>participantNameArabic</code>, <code>age</code>, <code>gender</code>, <code>displacementStatus</code>, <code>firstPhoneNumber</code>, <code>secondPhoneNumber</code>, <code>governorate</code>, <code>district</code>, <code>subdistrict</code>, <code>participantType</code>, <code>bnfCode</code>
            </div>
            <div className="small text-muted">
              For dynamic questionnaire data, headers must match the field name keys (e.g., <code>{activeTemplateFields.length > 0 ? activeTemplateFields.slice(0, 3).map(f => f.name).join(', ') : 'pre_test_score'}</code>). 
              <br />
              <strong><i className="bi bi-info-circle text-primary"></i> Tip:</strong> Click <strong>Download Excel Template</strong> above to get a customized spreadsheet pre-populated with all the exact column headers and a sample record for your selected activity!
            </div>
          </div>

          {/* UPLOAD RESULT SUMMARY */}
          {uploadResult && (
            <div className="alert alert-info py-3 mb-4">
              <h6 className="fw-bold"><i className="bi bi-check-circle-fill"></i> Upload Complete!</h6>
              <div className="small mt-2">
                Successfully enrolled: <strong>{uploadResult.successCount}</strong> participants. <br />
                Failed rows: <strong className="text-danger">{uploadResult.errorCount}</strong> (Check that names, phones, and locations are valid).
              </div>
            </div>
          )}

          {/* PREVIEW CONTAINER */}
          {excelPreview.length > 0 && (
            <div>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h6 className="fw-bold text-main mb-0">Excel Rows Preview (Showing top {excelPreview.length} records)</h6>
                <button 
                  className="btn btn-primary"
                  onClick={handleBulkUploadSubmit}
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                      Uploading...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-cloud-check-fill"></i> Submit and Upload {excelData.length} Records
                    </>
                  )}
                </button>
              </div>

              <div className="table-responsive" style={{ maxHeight: '300px' }}>
                <table className="custom-table table-sm" style={{ fontSize: '0.8rem' }}>
                  <thead>
                    <tr>
                      <th>Name English</th>
                      <th>Name Arabic</th>
                      <th>Age</th>
                      <th>Gender</th>
                      <th>Phone</th>
                      <th>Displacement</th>
                      <th>Governorate</th>
                      <th>District</th>
                    </tr>
                  </thead>
                  <tbody>
                    {excelPreview.map((row, index) => (
                      <tr key={index}>
                        <td>{row.participantNameEnglish || '-'}</td>
                        <td>{row.participantNameArabic || '-'}</td>
                        <td>{row.age || '-'}</td>
                        <td>{row.gender || '-'}</td>
                        <td>{row.firstPhoneNumber || '-'}</td>
                        <td>{row.displacementStatus || '-'}</td>
                        <td>{row.governorate || '-'}</td>
                        <td>{row.district || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* NO VIEW CONTAINER */}
      {activities.length === 0 && (
        <div className="glass-card text-center py-5 text-muted">
          <i className="bi bi-calendar-x fs-1"></i>
          <h4 className="mt-3">No Activities Exist in this Project</h4>
          <p className="small">Please go to the Activities panel to create an activity sheet before registering beneficiaries.</p>
        </div>
      )}

      {/* DUPLICATE WARNING MODAL */}
      {duplicateWarning && (
        <div className="modal-overlay active">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header bg-danger-glow text-danger">
              <h5 className="fw-bold"><i className="bi bi-exclamation-triangle-fill"></i> Potential Duplicate Detected</h5>
            </div>
            <div className="modal-body">
              <p className="small">A participant with matching names or phone number already exists in the central registry:</p>
              
              <div className="bg-app rounded p-3 mb-3 small border">
                <div><strong>BNF Code:</strong> {duplicateWarning.match.bnfCode}</div>
                <div><strong>English Name:</strong> {duplicateWarning.match.nameEng}</div>
                <div><strong>Arabic Name:</strong> {duplicateWarning.match.nameAra}</div>
                <div><strong>Phone Number:</strong> {duplicateWarning.match.phone}</div>
                <div><strong>Location:</strong> {duplicateWarning.match.location}</div>
                <div><strong>Displacement:</strong> {duplicateWarning.match.displacement} | <strong>Age/Gender:</strong> {duplicateWarning.match.age} / {duplicateWarning.match.gender}</div>
              </div>

              <p className="small text-muted">
                Choose <strong>Select Existing Profile</strong> to link this enrollment to their database entry. Use <strong>Link Anyway</strong> only if this is a different person with the same name/phone.
              </p>
            </div>
            <div className="modal-footer">
              <button 
                type="button" 
                className="btn btn-secondary me-auto"
                onClick={() => setDuplicateWarning(null)}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="btn btn-success"
                onClick={() => handleLinkDuplicate(duplicateWarning.match)}
              >
                Select Existing Profile
              </button>
              <button 
                type="button" 
                className="btn btn-danger"
                onClick={() => handleSubmitEnrollment(null, true)}
                disabled={submitting}
              >
                Link Anyway
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
