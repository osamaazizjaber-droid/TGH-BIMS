// BIMS API Client with JWT Authorization

// Helper to make API calls
async function request(path, options = {}) {
  const token = localStorage.getItem('bims_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const config = {
    ...options,
    headers
  };

  const response = await fetch(path, config);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Server request failed.');
  }
  return data;
}

const api = {
  // Authentication
  login: async (email, password) => {
    const data = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    // Save token and user details to localStorage
    if (data.token) {
      localStorage.setItem('bims_token', data.token);
      localStorage.setItem('bims_user', JSON.stringify(data.user));
    }
    return data.user;
  },

  logout: () => {
    localStorage.removeItem('bims_token');
    localStorage.removeItem('bims_user');
  },

  getCurrentUser: () => {
    const stored = localStorage.getItem('bims_user');
    if (!stored) return null;
    try {
      return JSON.parse(stored);
    } catch (e) {
      return null;
    }
  },

  // Projects
  getProjects: () => request('/api/projects'),
  createProject: (project) => request('/api/projects', {
    method: 'POST',
    body: JSON.stringify(project)
  }),
  archiveProject: (projectCode) => request('/api/projects/archive', {
    method: 'POST',
    body: JSON.stringify({ projectCode })
  }),

  // Activities
  getActivities: (projectCode) => request(`/api/activities?projectCode=${encodeURIComponent(projectCode)}`),
  createActivity: (projectCode, activity) => request('/api/activities', {
    method: 'POST',
    body: JSON.stringify({ projectCode, activity })
  }),

  // Templates
  getTemplates: () => request('/api/templates'),
  saveTemplate: (template) => request('/api/templates', {
    method: 'POST',
    body: JSON.stringify(template)
  }),
  deleteTemplate: (name) => request(`/api/templates/${encodeURIComponent(name)}`, {
    method: 'DELETE'
  }),

  // Beneficiaries & Enrollment
  searchBeneficiaries: (q) => request(`/api/beneficiaries/search?q=${encodeURIComponent(q)}`),
  registerParticipant: (projectCode, activityCode, commonData, dynamicData, forceCreate = false) => 
    request('/api/beneficiaries/register', {
      method: 'POST',
      body: JSON.stringify({ projectCode, activityCode, commonData, dynamicData, forceCreate })
    }),
  bulkUploadBeneficiaries: (projectCode, activityCode, rows) => 
    request('/api/beneficiaries/bulk', {
      method: 'POST',
      body: JSON.stringify({ projectCode, activityCode, rows })
    }),

  // Dashboard Metrics
  getDashboardKPIs: (projectCode = 'All', start = '', end = '') => 
    request(`/api/dashboard/kpis?projectCode=${encodeURIComponent(projectCode)}&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`),

  // Reports
  getReportsData: (filters) => request('/api/reports/query', {
    method: 'POST',
    body: JSON.stringify(filters)
  }),
  getBeneficiaryHistory: (bnfCode) => request(`/api/beneficiaries/history/${encodeURIComponent(bnfCode)}`),
  deleteRegistration: (bnfCode, projectCode, activityCode) => request('/api/registrations', {
    method: 'DELETE',
    body: JSON.stringify({ bnfCode, projectCode, activityCode })
  }),

  // User Accounts (Admin only)
  getUsers: () => request('/api/users'),
  saveUser: (user) => request('/api/users', {
    method: 'POST',
    body: JSON.stringify(user)
  }),
  deleteUser: (email) => request(`/api/users/${encodeURIComponent(email)}`, {
    method: 'DELETE'
  }),

  // Activity Tracker Methods
  getTrackerRecords: (projectCode) => 
    request(`/api/tracker?projectCode=${encodeURIComponent(projectCode)}`),
  createTrackerRecord: (record) => 
    request('/api/tracker', {
      method: 'POST',
      body: JSON.stringify(record)
    }),
  deleteTrackerRecord: (id) => 
    request(`/api/tracker/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    }),
  bulkUploadTrackerRecords: (projectCode, rows) => 
    request('/api/tracker/bulk', {
      method: 'POST',
      body: JSON.stringify({ projectCode, rows })
    }),

  // Project Indicators Methods
  getIndicators: (projectCode) => 
    request(`/api/indicators?projectCode=${encodeURIComponent(projectCode)}`),
  createIndicator: (record) => 
    request('/api/indicators', {
      method: 'POST',
      body: JSON.stringify(record)
    }),
  updateIndicator: (id, record) => 
    request(`/api/indicators/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(record)
    }),
  deleteIndicator: (id) => 
    request(`/api/indicators/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    }),
  syncIndicator: (id) => 
    request(`/api/indicators/${encodeURIComponent(id)}/sync`, {
      method: 'POST'
    }),
  bulkUploadIndicators: (projectCode, rows) => 
    request('/api/indicators/bulk', {
      method: 'POST',
      body: JSON.stringify({ projectCode, rows })
    }),


  // Public Mobile Form API Methods
  getActivityFormDetailsPublic: (projectCode, activityCode) => 
    request(`/api/public/activity-form-details?projectCode=${encodeURIComponent(projectCode)}&activityCode=${encodeURIComponent(activityCode)}`),
  registerParticipantPublic: (projectCode, activityCode, commonData, dynamicData, forceCreate = false) => 
    request('/api/public/register', {
      method: 'POST',
      body: JSON.stringify({ projectCode, activityCode, commonData, dynamicData, forceCreate })
    })
};

export default api;
