import React, { useState, useEffect } from 'react';
import api from '../api';
import tghLogo from '../assets/tgh_logo.jpg';
import { getGovernorates, getDistricts, getSubdistricts } from '../utils/iraqiLocations';

export default function PublicRegistration({ showToast }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activityDetails, setActivityDetails] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [bnfCodeCreated, setBnfCodeCreated] = useState('');

  // Project and activity from URL query parameters
  const queryParams = new URLSearchParams(window.location.search);
  const projectCode = queryParams.get('project') || '';
  const activityCode = queryParams.get('activity') || '';

  // Districts and Subdistricts lookup lists
  const [districtsList, setDistrictsList] = useState([]);
  const [subdistrictsList, setSubdistrictsList] = useState([]);

  // Form states
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
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!projectCode || !activityCode) {
      setError('Invalid registration link. The link must contain project and activity parameters.');
      setLoading(false);
      return;
    }

    setLoading(true);
    api.getActivityFormDetailsPublic(projectCode, activityCode)
      .then(data => {
        setActivityDetails(data);
        
        // Initialize dynamic questionnaire inputs
        const initialDyn = {};
        if (data.fields) {
          data.fields.forEach(f => {
            initialDyn[f.name] = '';
          });
        }
        setDynamicData(initialDyn);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || 'Failed to retrieve activity registration details.');
        setLoading(false);
      });
  }, [projectCode, activityCode]);

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

  const handleCommonChange = (e) => {
    const { name, value } = e.target;
    setCommonData(prev => ({ ...prev, [name]: value }));
  };

  const handleDynamicChange = (e) => {
    const { name, value } = e.target;
    setDynamicData(prev => ({ ...prev, [name]: value }));
  };

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

  const handleSubmit = async (e, force = false) => {
    if (e) e.preventDefault();
    
    // Simple frontend validations
    if (!commonData.participantNameEnglish && !commonData.participantNameArabic) {
      return showToast('Please enter the participant name in either English or Arabic.', 'warning');
    }
    if (!commonData.age || !commonData.firstPhoneNumber || !commonData.governorate || !commonData.district) {
      return showToast('Please fill out all required demographic fields.', 'warning');
    }

    setSubmitting(true);
    try {
      const res = await api.registerParticipantPublic(projectCode, activityCode, commonData, dynamicData, force);
      
      if (res.status === 'duplicate_warning') {
        setDuplicateWarning(res);
      } else {
        setBnfCodeCreated(res.bnfCode);
        setSubmitted(true);
        setDuplicateWarning(null);
        showToast('Registration submitted successfully!', 'success');
      }
    } catch (err) {
      showToast(err.message || 'Failed to submit registration.', 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetForm = () => {
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
    
    const initialDyn = {};
    if (activityDetails?.fields) {
      activityDetails.fields.forEach(f => {
        initialDyn[f.name] = '';
      });
    }
    setDynamicData(initialDyn);
    setDistrictsList([]);
    setSubdistrictsList([]);
    setSubmitted(false);
    setBnfCodeCreated('');
    setDuplicateWarning(null);
  };

  if (loading) {
    return (
      <div className="public-reg-container d-flex justify-content-center align-items-center">
        <div className="text-center p-5 glass-card" style={{ maxWidth: '400px' }}>
          <div className="spinner-border text-primary" style={{ width: '3rem', height: '3rem' }} role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <h5 className="mt-4 fw-bold text-main">TGH BIMS</h5>
          <p className="text-muted small">Loading Mobile Registration Form...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="public-reg-container d-flex justify-content-center align-items-center">
        <div className="text-center p-5 glass-card" style={{ maxWidth: '500px', border: '1px solid var(--color-danger)' }}>
          <div className="brand-logo bg-danger-glow text-danger mx-auto mb-3" style={{ width: '60px', height: '60px', borderRadius: '50%', fontSize: '1.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="bi bi-exclamation-triangle-fill"></i>
          </div>
          <h4 className="fw-bold text-main">Registration Unavailable</h4>
          <p className="text-muted my-3">{error}</p>
          <div className="p-3 bg-app rounded text-start small border">
            <h6 className="fw-bold text-main mb-1">Troubleshooting Tips:</h6>
            <ul className="mb-0 text-muted ps-3">
              <li>Ensure you scanned the correct QR code.</li>
              <li>Check with the activity supervisor to confirm this activity sheet is active.</li>
              <li>Verify your internet connection and try reloading the page.</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="public-reg-container d-flex justify-content-center align-items-center">
        <div className="text-center p-5 glass-card text-main" style={{ maxWidth: '500px', border: '1px solid var(--color-success)' }}>
          <div className="brand-logo bg-success-glow text-success mx-auto mb-3" style={{ width: '60px', height: '60px', borderRadius: '50%', fontSize: '1.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="bi bi-check-circle-fill"></i>
          </div>
          <h4 className="fw-bold">Success! Registration Submitted</h4>
          <p className="text-muted my-3">
            Thank you! The participant profile has been registered successfully.
          </p>
          
          <div className="p-4 bg-app rounded mb-4" style={{ border: '1px solid var(--border-color)' }}>
            <div className="small text-muted text-uppercase fw-bold">Beneficiary ID Code (BNF Code)</div>
            <div className="fs-3 fw-bold text-primary tracking-wider mt-1">{bnfCodeCreated}</div>
            <div className="small text-muted mt-2">
              Project Scope: <strong>{activityDetails.projectCode}</strong> <br />
              Activity: <strong>{activityDetails.activityName}</strong>
            </div>
          </div>

          <button 
            type="button" 
            className="btn btn-primary w-100 py-3 fw-bold"
            onClick={handleResetForm}
          >
            <i className="bi bi-person-plus-fill"></i> Register Another Participant
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="public-reg-container">
      <div className="public-reg-card mx-auto">
        
        {/* Banner Header */}
        <div className="public-reg-header text-center mb-4">
          <div className="brand-logo mx-auto mb-2" style={{ width: '45px', height: '45px', background: 'none', boxShadow: 'none' }}>
            <img src={tghLogo} alt="TGH" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '4px' }} />
          </div>
          <h4 className="fw-bold text-main mb-1">Activity Registration Form</h4>
          <p className="small text-muted mb-0">{activityDetails.projectName} ({activityDetails.projectCode})</p>
          <div className="badge bg-primary-glow text-primary mt-2 px-3 py-2 fs-6">
            <i className="bi bi-bookmark-fill"></i> {activityDetails.activityCode} - {activityDetails.activityName} ({activityDetails.activityType})
          </div>
          <div className="small text-muted mt-1">
            <i className="bi bi-geo-alt-fill"></i> Location: {activityDetails.location}
          </div>
        </div>

        <form onSubmit={(e) => handleSubmit(e, false)}>
          
          {/* Demographic Section */}
          <div className="glass-card mb-4" style={{ padding: '1.25rem' }}>
            <h6 className="fw-bold text-primary mb-3">
              <i className="bi bi-person-circle"></i> Demographic Information
            </h6>

            <div className="form-group mb-3">
              <label className="form-label small fw-bold">Participant Type *</label>
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

            <div className="form-group mb-3">
              <label className="form-label small fw-bold">Full Name English *</label>
              <input 
                type="text" 
                name="participantNameEnglish"
                className="form-control" 
                placeholder="First Middle Last"
                value={commonData.participantNameEnglish}
                onChange={handleCommonChange}
                required={!commonData.participantNameArabic}
              />
            </div>

            <div className="form-group mb-3">
              <label className="form-label small fw-bold">Full Name Arabic *</label>
              <input 
                type="text" 
                name="participantNameArabic"
                className="form-control text-end" 
                placeholder="الاسم الثلاثي واللقب"
                value={commonData.participantNameArabic}
                onChange={handleCommonChange}
                required={!commonData.participantNameEnglish}
              />
            </div>

            <div className="row g-2 mb-3">
              <div className="col-6 form-group">
                <label className="form-label small fw-bold">Age *</label>
                <input 
                  type="number" 
                  name="age"
                  className="form-control" 
                  placeholder="Years"
                  value={commonData.age}
                  onChange={handleCommonChange}
                  required
                />
              </div>
              <div className="col-6 form-group">
                <label className="form-label small fw-bold">Gender *</label>
                <select 
                  name="gender"
                  className="form-select form-control"
                  value={commonData.gender}
                  onChange={handleCommonChange}
                  required
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
            </div>

            <div className="form-group mb-3">
              <label className="form-label small fw-bold">Displacement Status *</label>
              <select 
                name="displacementStatus"
                className="form-select form-control"
                value={commonData.displacementStatus}
                onChange={handleCommonChange}
                required
              >
                <option value="Host Community">Host Community</option>
                <option value="IDP">IDP (Displaced)</option>
                <option value="Returnee">Returnee</option>
                <option value="Refugee">Refugee</option>
              </select>
            </div>

            <div className="row g-2 mb-3">
              <div className="col-6 form-group">
                <label className="form-label small fw-bold">Primary Phone *</label>
                <input 
                  type="tel" 
                  name="firstPhoneNumber"
                  className="form-control" 
                  placeholder="0770xxxxxxx"
                  value={commonData.firstPhoneNumber}
                  onChange={handleCommonChange}
                  required
                />
              </div>
              <div className="col-6 form-group">
                <label className="form-label small fw-bold">Secondary Phone</label>
                <input 
                  type="tel" 
                  name="secondPhoneNumber"
                  className="form-control" 
                  placeholder="Optional"
                  value={commonData.secondPhoneNumber}
                  onChange={handleCommonChange}
                />
              </div>
            </div>

            <div className="form-group mb-3">
              <label className="form-label small fw-bold">Governorate *</label>
              <select
                name="governorate"
                className="form-select form-control"
                value={commonData.governorate}
                onChange={handleGovChange}
                required
              >
                <option value="">-- Choose Governorate --</option>
                {getGovernorates().map(gov => (
                  <option key={gov} value={gov}>{gov}</option>
                ))}
              </select>
            </div>

            <div className="row g-2">
              <div className="col-6 form-group">
                <label className="form-label small fw-bold">District *</label>
                <select
                  name="district"
                  className="form-select form-control"
                  value={commonData.district}
                  onChange={handleDistrictChange}
                  disabled={!commonData.governorate}
                  required
                >
                  <option value="">-- Choose District --</option>
                  {districtsList.map(dist => (
                    <option key={dist} value={dist}>{dist}</option>
                  ))}
                </select>
              </div>
              <div className="col-6 form-group">
                <label className="form-label small fw-bold">Subdistrict</label>
                <select
                  name="subdistrict"
                  className="form-select form-control"
                  value={commonData.subdistrict}
                  onChange={handleCommonChange}
                  disabled={!commonData.district}
                >
                  <option value="">-- Choose Subdistrict --</option>
                  {subdistrictsList.map(sub => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                </select>
              </div>
            </div>

          </div>

          {/* Dynamic Activity Indicators Section */}
          {activityDetails.fields && activityDetails.fields.length > 0 && (
            <div className="glass-card mb-4" style={{ padding: '1.25rem' }}>
              <h6 className="fw-bold text-primary mb-3">
                <i className="bi bi-clipboard-data"></i> Activity Specific Information
              </h6>
              
              <div className="d-flex flex-column gap-3">
                {activityDetails.fields.map(field => {
                  const inputName = field.name;

                  return (
                    <div key={inputName} className="form-group">
                      <label className="form-label small fw-bold">{field.label} {field.required && '*'}</label>
                      
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
                          value={dynamicData[inputName] || ''}
                          onChange={handleDynamicChange}
                          required={field.required}
                        ></textarea>
                      ) : (() => {
                        const isReadOnly = (field.name === 'sessions_attended' || field.name === 'num_sessions') && 
                                           activityDetails.fields?.some(f => /^session_\d+$/i.test(f.name));
                        return (
                          <input
                            type={field.type === 'Number' ? 'number' : field.type === 'Date' ? 'date' : 'text'}
                            name={inputName}
                            className="form-control"
                            value={dynamicData[inputName] || ''}
                            onChange={handleDynamicChange}
                            required={field.required}
                            readOnly={isReadOnly}
                            style={isReadOnly ? { backgroundColor: 'var(--bg-app)', cursor: 'not-allowed' } : {}}
                          />
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <button 
            type="submit" 
            className="btn btn-primary w-100 py-3 fw-bold fs-5 mt-2"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                Submitting Form...
              </>
            ) : (
              <>
                <i className="bi bi-cloud-arrow-up-fill"></i> Submit Registration
              </>
            )}
          </button>
        </form>
      </div>

      {/* Duplicate Verification Modal */}
      {duplicateWarning && (
        <div className="modal-overlay">
          <div className="custom-modal glass-card text-main" style={{ maxWidth: '480px' }}>
            <div className="modal-header border-bottom pb-2 mb-3">
              <h5 className="modal-title fw-bold text-warning">
                <i className="bi bi-exclamation-triangle"></i> Potential Duplicate Detected
              </h5>
            </div>
            <div className="modal-body">
              <p className="small text-muted">
                A participant with a matching name or phone number already exists in the registry. 
                Please review the matching profile below:
              </p>
              
              <div className="p-3 bg-app rounded mb-3 border text-start small">
                <div className="row mb-1">
                  <div className="col-4 text-muted fw-bold">Name English:</div>
                  <div className="col-8 text-main">{duplicateWarning.match.nameEng || '-'}</div>
                </div>
                <div className="row mb-1">
                  <div className="col-4 text-muted fw-bold">Name Arabic:</div>
                  <div className="col-8 text-main">{duplicateWarning.match.nameAra || '-'}</div>
                </div>
                <div className="row mb-1">
                  <div className="col-4 text-muted fw-bold">BNF Code:</div>
                  <div className="col-8 text-primary fw-bold">{duplicateWarning.match.bnfCode}</div>
                </div>
                <div className="row mb-1">
                  <div className="col-4 text-muted fw-bold">Primary Phone:</div>
                  <div className="col-8 text-main">{duplicateWarning.match.phone || '-'}</div>
                </div>
                <div className="row">
                  <div className="col-4 text-muted fw-bold">Location:</div>
                  <div className="col-8 text-main">{duplicateWarning.match.location}</div>
                </div>
              </div>

              <div className="alert alert-info py-2 small mb-0">
                <i className="bi bi-info-circle-fill"></i> <strong>Note:</strong> If this is indeed a new participant, click <strong>"Submit Anyway"</strong>. If it is the same person, please contact the site supervisor to link their profile.
              </div>
            </div>
            
            <div className="modal-footer border-top pt-3 mt-3 d-flex gap-2">
              <button 
                type="button" 
                className="btn btn-secondary w-50"
                onClick={() => setDuplicateWarning(null)}
              >
                Go Back & Edit
              </button>
              <button 
                type="button" 
                className="btn btn-warning w-50 fw-bold"
                onClick={() => handleSubmit(null, true)}
                disabled={submitting}
              >
                Submit Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
