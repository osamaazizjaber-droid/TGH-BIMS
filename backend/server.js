const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();

const supabaseDb = require('./supabaseDb');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'tgh-bims-token-secret-key';

// Initialize and enforce Supabase database driver
if (!supabaseDb.isConfigured()) {
  console.error("--------------------------------------------------");
  console.error("CRITICAL ERROR: Supabase database is not configured!");
  console.error("Please define SUPABASE_URL and SUPABASE_KEY in your .env");
  console.error("--------------------------------------------------");
  process.exit(1);
}

const db = supabaseDb;
console.log("--------------------------------------------------");
console.log("DATABASE STATUS: Active connection to Supabase (PostgreSQL)");
console.log("--------------------------------------------------");


// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Request log middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Authentication middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token missing' });
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired access token' });
    }
    req.user = user;
    next();
  });
}

// ======================== PUBLIC ROUTES ========================

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    // Look up user in database and verify password
    const user = await db.loginUser(email, password);
    
    // Create JWT token containing user details
    const token = jwt.sign({
      email: user.email,
      name: user.name,
      role: user.role,
      assignedProjects: user.assignedProjects
    }, JWT_SECRET, { expiresIn: '8h' });
    
    res.json({
      token,
      user: {
        email: user.email,
        name: user.name,
        role: user.role,
        assignedProjects: user.assignedProjects
      }
    });
  } catch (err) {
    res.status(400).json({ error: err.message || err.toString() });
  }
});

// ======================== PUBLIC DATA COLLECTION ROUTES ========================

app.get('/api/public/activity-form-details', async (req, res) => {
  try {
    const { projectCode, activityCode } = req.query;
    if (!projectCode || !activityCode) {
      return res.status(400).json({ error: 'projectCode and activityCode are required query parameters' });
    }
    const details = await db.getActivityFormDetailsPublic(projectCode, activityCode);
    res.json(details);
  } catch (err) {
    res.status(400).json({ error: err.message || err.toString() });
  }
});

app.post('/api/public/register', async (req, res) => {
  try {
    const { projectCode, activityCode, commonData, dynamicData, forceCreate } = req.body;
    if (!projectCode || !activityCode || !commonData) {
      return res.status(400).json({ error: 'Missing registration payload data (projectCode, activityCode, commonData)' });
    }
    const result = await db.registerParticipantPublic(projectCode, activityCode, commonData, dynamicData || {}, !!forceCreate);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message || err.toString() });
  }
});

// ======================== PROTECTED ROUTES ========================

// 1. Projects API
app.get('/api/projects', authenticateToken, async (req, res) => {
  try {
    const projects = await db.getProjects(req.user.email);
    res.json(projects);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/projects', authenticateToken, async (req, res) => {
  try {
    const result = await db.createProject(req.user.email, req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/projects/archive', authenticateToken, async (req, res) => {
  try {
    const { projectCode } = req.body;
    const result = await db.archiveProject(req.user.email, projectCode);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 2. Activities API
app.get('/api/activities', authenticateToken, async (req, res) => {
  try {
    const { projectCode } = req.query;
    if (!projectCode) {
      return res.status(400).json({ error: 'projectCode is required' });
    }
    const activities = await db.getActivities(req.user.email, projectCode);
    res.json(activities);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/activities', authenticateToken, async (req, res) => {
  try {
    const { projectCode, activity } = req.body;
    if (!projectCode || !activity) {
      return res.status(400).json({ error: 'projectCode and activity payload are required' });
    }
    const result = await db.createActivity(req.user.email, projectCode, activity);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 3. Templates API
app.get('/api/templates', authenticateToken, async (req, res) => {
  try {
    const templates = await db.getTemplates(req.user.email);
    res.json(templates);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/templates', authenticateToken, async (req, res) => {
  try {
    const result = await db.saveTemplate(req.user.email, req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/templates/:name', authenticateToken, async (req, res) => {
  try {
    const result = await db.deleteTemplate(req.user.email, req.params.name);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 3.5. Activity Tracker API
app.get('/api/tracker', authenticateToken, async (req, res) => {
  try {
    const { projectCode } = req.query;
    if (!projectCode) {
      return res.status(400).json({ error: 'projectCode is required' });
    }
    const data = await db.getTrackerRecords(req.user.email, projectCode);
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/tracker', authenticateToken, async (req, res) => {
  try {
    const result = await db.createTrackerRecord(req.user.email, req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/tracker/:id', authenticateToken, async (req, res) => {
  try {
    const result = await db.deleteTrackerRecord(req.user.email, req.params.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/tracker/bulk', authenticateToken, async (req, res) => {
  try {
    const { projectCode, rows } = req.body;
    if (!projectCode || !rows) {
      return res.status(400).json({ error: 'Missing projectCode or rows data' });
    }
    const result = await db.bulkUploadTrackerRecords(req.user.email, projectCode, rows);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 3.7. Project Indicators API
app.get('/api/indicators', authenticateToken, async (req, res) => {
  try {
    const { projectCode } = req.query;
    const data = await db.getIndicators(req.user.email, projectCode);
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/indicators', authenticateToken, async (req, res) => {
  try {
    const result = await db.createIndicator(req.user.email, req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/indicators/:id', authenticateToken, async (req, res) => {
  try {
    const result = await db.updateIndicator(req.user.email, req.params.id, req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/indicators/:id', authenticateToken, async (req, res) => {
  try {
    const result = await db.deleteIndicator(req.user.email, req.params.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/indicators/bulk', authenticateToken, async (req, res) => {
  try {
    const { projectCode, rows } = req.body;
    if (!projectCode || !rows) {
      return res.status(400).json({ error: 'Missing projectCode or rows data' });
    }
    const result = await db.bulkUploadIndicators(req.user.email, projectCode, rows);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});


// 4. Beneficiaries API
app.get('/api/beneficiaries/search', authenticateToken, async (req, res) => {
  try {
    const { q } = req.query;
    const list = await db.searchBeneficiaries(req.user.email, q || '');
    res.json(list);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/beneficiaries/register', authenticateToken, async (req, res) => {
  try {
    const { projectCode, activityCode, commonData, dynamicData, forceCreate } = req.body;
    if (!projectCode || !activityCode || !commonData) {
      return res.status(400).json({ error: 'Missing registration payload data' });
    }
    const result = await db.registerParticipant(req.user.email, projectCode, activityCode, commonData, dynamicData || {}, forceCreate);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/beneficiaries/bulk', authenticateToken, async (req, res) => {
  try {
    const { projectCode, activityCode, rows } = req.body;
    if (!projectCode || !activityCode || !rows) {
      return res.status(400).json({ error: 'Missing upload payload parameters' });
    }
    const result = await db.bulkUploadBeneficiaries(req.user.email, projectCode, activityCode, rows);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 5. Dashboard API
app.get('/api/dashboard/kpis', authenticateToken, async (req, res) => {
  try {
    const { projectCode, start, end } = req.query;
    const stats = await db.getDashboardKPIs(req.user.email, projectCode || 'All', start || null, end || null);
    res.json(stats);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 6. Reports API
app.post('/api/reports/query', authenticateToken, async (req, res) => {
  try {
    const list = await db.getReportsData(req.user.email, req.body || {});
    res.json(list);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/beneficiaries/history/:bnfCode', authenticateToken, async (req, res) => {
  try {
    const timeline = await db.getBeneficiaryHistory(req.user.email, req.params.bnfCode);
    res.json(timeline);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/registrations', authenticateToken, async (req, res) => {
  try {
    const { bnfCode, projectCode, activityCode } = req.body;
    if (!bnfCode || !projectCode || !activityCode) {
      return res.status(400).json({ error: 'Missing registration payload data (bnfCode, projectCode, activityCode)' });
    }
    const result = await db.deleteRegistration(req.user.email, bnfCode, projectCode, activityCode);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 7. Admin-Only Users Management
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    const list = await db.getUsers(req.user.email);
    res.json(list);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/users', authenticateToken, async (req, res) => {
  try {
    const result = await db.saveUser(req.user.email, req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/users/:email', authenticateToken, async (req, res) => {
  try {
    const result = await db.deleteUser(req.user.email, req.params.email);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Fallback route
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint Not Found' });
});

// Start Server
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`BIMS Node Backend Proxy listening on http://localhost:${PORT}`);
  });
}

module.exports = app;

