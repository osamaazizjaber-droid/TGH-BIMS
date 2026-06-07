const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

function hashPassword(password) {
  if (!password) return '';
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Automatically seed templates if the Supabase templates table is empty
if (supabase) {
  seedTemplatesIfNeeded();
}

async function seedTemplatesIfNeeded() {
  try {
    const { count, error: countErr } = await supabase
      .from('templates')
      .select('*', { count: 'exact', head: true });
      
    if (countErr) {
      console.error("Supabase templates check failed:", countErr);
      return;
    }
    
    if (count === 0) {
      console.log("--------------------------------------------------");
      console.log("Supabase empty templates table detected. Auto-seeding templates...");
      const templates = require('./templates.json');
      const dbTemplates = templates.map(mapTemplateToDb);
      const { error: seedErr } = await supabase
        .from('templates')
        .insert(dbTemplates);
      if (seedErr) {
        console.error("Error seeding templates into Supabase:", seedErr);
      } else {
        console.log("Successfully seeded 27 TGH templates into Supabase!");
      }
      console.log("--------------------------------------------------");
    }
  } catch (e) {
    console.error("Auto-seeding templates error:", e);
  }
}

// ======================== MAPPING UTILITIES ========================

function mapUserToJs(u) {
  if (!u) return null;
  return {
    email: u.email,
    name: u.name,
    role: u.role,
    assignedProjects: u.assigned_projects || "All",
    status: u.status || "Active",
    password: u.password
  };
}

function mapUserToDb(u) {
  if (!u) return null;
  const dbObj = {
    email: u.email.toLowerCase().trim(),
    name: u.name,
    role: u.role,
    assigned_projects: u.assignedProjects || "All",
    status: u.status || "Active"
  };
  if (u.password !== undefined) {
    dbObj.password = u.password;
  }
  return dbObj;
}

function mapProjectToJs(p) {
  if (!p) return null;
  return {
    projectCode: p.project_code,
    projectName: p.project_name,
    donor: p.donor,
    location: p.location,
    governorate: p.governorate,
    district: p.district,
    subdistrict: p.subdistrict || "",
    startDate: p.start_date,
    endDate: p.end_date,
    budget: Number(p.budget) || 0,
    implementingTeam: p.implementing_team || "",
    projectManager: p.project_manager,
    spreadsheetId: p.spreadsheet_id || "",
    status: p.status || "Active"
  };
}

function mapProjectToDb(p) {
  if (!p) return null;
  return {
    project_code: p.projectCode,
    project_name: p.projectName,
    donor: p.donor,
    location: p.location,
    governorate: p.governorate,
    district: p.district,
    subdistrict: p.subdistrict || "",
    start_date: p.startDate,
    end_date: p.endDate,
    budget: Number(p.budget) || 0,
    implementing_team: p.implementingTeam || "",
    project_manager: p.projectManager,
    spreadsheet_id: p.spreadsheetId || "",
    status: p.status || "Active"
  };
}

function mapActivityToJs(a) {
  if (!a) return null;
  return {
    activityCode: a.activity_code,
    activityName: a.activity_name,
    activityType: a.activity_type,
    location: a.location,
    implementationDate: a.implementation_date,
    responsibleStaff: a.responsible_staff || "",
    targetParticipants: Number(a.target_participants) || 25,
    sheetName: a.sheet_name || "",
    status: a.status || "Active"
  };
}

function mapActivityToDb(a, projectCode) {
  if (!a) return null;
  return {
    activity_code: a.activityCode,
    project_code: projectCode,
    activity_name: a.activityName,
    activity_type: a.activityType,
    location: a.location,
    implementation_date: a.implementationDate,
    responsible_staff: a.responsibleStaff || "",
    target_participants: Number(a.targetParticipants) || 25,
    sheet_name: a.sheetName || "",
    status: a.status || "Active"
  };
}

function mapTemplateToJs(t) {
  if (!t) return null;
  return {
    templateName: t.template_name,
    description: t.description || "",
    fields: Array.isArray(t.fields) ? t.fields : []
  };
}

function mapTemplateToDb(t) {
  if (!t) return null;
  return {
    template_name: t.templateName,
    description: t.description || "",
    fields: Array.isArray(t.fields) ? t.fields : []
  };
}

function mapTrackerToJs(t) {
  if (!t) return null;
  return {
    id: t.id,
    projectCode: t.project_code,
    activityCode: t.activity_code,
    groupCode: t.group_code,
    activityType: t.activity_type,
    activityTypeFull: t.activity_type_full,
    staffResponsible: t.staff_responsible || "",
    siteCode: t.site_code,
    locationNameEn: t.location_name_en,
    locationNameAr: t.location_name_ar,
    latitude: t.latitude || "",
    longitude: t.longitude || "",
    trainingProvider: t.training_provider || "",
    movLink: t.mov_link || "",
    numberOfAttendees: Number(t.number_of_attendees) || 0,
    createdAt: t.created_at
  };
}

function mapTrackerToDb(t) {
  if (!t) return null;
  return {
    project_code: t.projectCode,
    activity_code: t.activityCode,
    group_code: t.groupCode,
    activity_type: t.activityType,
    activity_type_full: t.activityTypeFull,
    staff_responsible: t.staffResponsible || "",
    site_code: t.siteCode,
    location_name_en: t.locationNameEn,
    location_name_ar: t.locationNameAr,
    latitude: t.latitude || "",
    longitude: t.longitude || "",
    training_provider: t.trainingProvider || "",
    mov_link: t.movLink || "",
    number_of_attendees: Number(t.numberOfAttendees) || 0
  };
}

function mapIndicatorToJs(i) {
  if (!i) return null;
  return {
    id: i.id,
    projectCode: i.project_code,
    indicatorDescription: i.indicator_description,
    targetValue: Number(i.target_value) || 0,
    achievedTarget: Number(i.achieved_target) || 0,
    bnfType: i.bnf_type || "",
    numMen: Number(i.num_men) || 0,
    numWomen: Number(i.num_women) || 0,
    totalBeneficiaries: Number(i.total_beneficiaries) || 0,
    createdAt: i.created_at
  };
}

function mapIndicatorToDb(i) {
  if (!i) return null;
  const numMen = Number(i.numMen) || 0;
  const numWomen = Number(i.numWomen) || 0;
  return {
    project_code: i.projectCode,
    indicator_description: i.indicatorDescription,
    target_value: Number(i.targetValue) || 0,
    achieved_target: Number(i.achievedTarget) || 0,
    bnf_type: i.bnfType || "",
    num_men: numMen,
    num_women: numWomen,
    total_beneficiaries: numMen + numWomen
  };
}

function mapBeneficiaryToJs(b) {
  if (!b) return null;
  return {
    bnfCode: b.bnf_code,
    participantNameEnglish: b.participant_name_english,
    participantNameArabic: b.participant_name_arabic,
    fullName: b.full_name,
    age: Number(b.age) || 0,
    gender: b.gender,
    displacementStatus: b.displacement_status,
    firstPhoneNumber: b.first_phone_number,
    secondPhoneNumber: b.second_phone_number || "",
    governorate: b.governorate,
    district: b.district,
    subdistrict: b.subdistrict || "",
    registrationDate: b.registration_date,
    registeredBy: b.registered_by,
    firstProjectCode: b.first_project_code
  };
}

function mapBeneficiaryToDb(b) {
  if (!b) return null;
  return {
    bnf_code: b.bnfCode,
    participant_name_english: b.participantNameEnglish,
    participant_name_arabic: b.participantNameArabic,
    full_name: b.fullName || `${b.participantNameEnglish || ''} ${b.participantNameArabic || ''}`.trim(),
    age: Number(b.age) || 0,
    gender: b.gender,
    displacement_status: b.displacementStatus,
    first_phone_number: b.firstPhoneNumber,
    second_phone_number: b.secondPhoneNumber || "",
    governorate: b.governorate,
    district: b.district,
    subdistrict: b.subdistrict || "",
    registered_by: b.registeredBy,
    first_project_code: b.firstProjectCode
  };
}

function mapRegistrationToJs(r) {
  if (!r) return null;
  return {
    bnfCode: r.bnf_code,
    projectCode: r.project_code,
    activityCode: r.activity_code,
    activityName: r.activity_name,
    activityType: r.activity_type,
    implementationDate: r.implementation_date,
    participantType: r.participant_type || "Beneficiary",
    participantNameEnglish: r.participant_name_english,
    participantNameArabic: r.participant_name_arabic,
    fullName: r.full_name,
    age: Number(r.age) || 0,
    gender: r.gender,
    displacementStatus: r.displacement_status,
    firstPhoneNumber: r.first_phone_number,
    secondPhoneNumber: r.second_phone_number || "",
    governorate: r.governorate,
    district: r.district,
    subdistrict: r.subdistrict || "",
    responsibleStaff: r.responsible_staff || "",
    registrationDate: r.registration_date,
    registeredBy: r.registered_by,
    dynamicData: r.dynamic_data || {}
  };
}

function mapRegistrationToDb(r) {
  if (!r) return null;
  return {
    bnf_code: r.bnfCode,
    project_code: r.projectCode,
    activity_code: r.activityCode,
    activity_name: r.activityName,
    activity_type: r.activityType,
    implementation_date: r.implementationDate,
    participant_type: r.participantType || "Beneficiary",
    participant_name_english: r.participantNameEnglish,
    participant_name_arabic: r.participantNameArabic,
    full_name: r.fullName,
    age: Number(r.age) || 0,
    gender: r.gender,
    displacement_status: r.displacementStatus,
    first_phone_number: r.firstPhoneNumber,
    second_phone_number: r.secondPhoneNumber || "",
    governorate: r.governorate,
    district: r.district,
    subdistrict: r.subdistrict || "",
    responsible_staff: r.responsibleStaff || "",
    registered_by: r.registeredBy,
    dynamic_data: r.dynamicData || {}
  };
}

function autoCalculateSessions(dynamicData) {
  if (!dynamicData) return {};
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
  if (!hasSessionFields) {
    return dynamicData;
  }
  const updated = { ...dynamicData };
  if ('sessions_attended' in updated) {
    updated['sessions_attended'] = count;
  }
  if ('num_sessions' in updated) {
    updated['num_sessions'] = count;
  }
  return updated;
}

// ======================== HELPER METHODS ========================

async function checkUserPermission(email, allowedRoles) {
  const cleanEmail = (email || "").toLowerCase().trim();
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', cleanEmail)
    .single();
    
  if (error || !user) {
    if (cleanEmail === "admin@ngo-bims.org" || cleanEmail === "ku.dat1@trianglegh.cloud" || cleanEmail.includes("admin")) {
      const defaultAdmin = {
        email: cleanEmail,
        name: "Default Admin",
        role: "System Administrator",
        assigned_projects: "All",
        status: "Active",
        password: cleanEmail === "ku.dat1@trianglegh.cloud" ? hashPassword("tgh26+") : hashPassword("admin123")
      };
      await supabase.from('users').upsert(defaultAdmin);
      return defaultAdmin;
    }
    throw new Error(`Access Denied: Email '${email}' is not registered in the system registry.`);
  }
  
  if (user.status !== 'Active') {
    throw new Error('Access Denied: Your account is suspended.');
  }
  
  if (allowedRoles.indexOf(user.role) === -1) {
    throw new Error(`Access Denied: Role '${user.role}' is not authorized to execute this action.`);
  }
  
  return user;
}

async function generateNextBnfCode(projectCode) {
  const cleanPrefix = projectCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
  
  const { data, error } = await supabase
    .from('beneficiaries')
    .select('bnf_code')
    .like('bnf_code', `${cleanPrefix}-%`);
  
  let maxNum = 0;
  if (data) {
    data.forEach(b => {
      const code = String(b.bnf_code);
      const parts = code.split("-");
      if (parts.length >= 2) {
        const dbPrefix = parts[0].toUpperCase().replace(/[^A-Z0-9]/g, "");
        if (dbPrefix === cleanPrefix) {
          const num = parseInt(parts[1], 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      }
    });
  }
  const nextNum = maxNum + 1;
  const paddedNum = String(nextNum).padStart(5, '0');
  return `${cleanPrefix}-${paddedNum}`;
}

async function writeAuditLog(userEmail, action, details, projectCode, activityCode) {
  try {
    await supabase.from('audit_logs').insert({
      user_email: userEmail || "SYSTEM",
      action,
      details,
      project_code: projectCode || "",
      activity_code: activityCode || ""
    });
  } catch (e) {
    console.error("Audit log error:", e);
  }
}

// ======================== DRIVER INTERFACE ========================

module.exports = {
  isConfigured: () => {
    return !!(supabaseUrl && supabaseKey);
  },

  loginUser: async (email, password) => {
    const cleanEmail = (email || "").toLowerCase().trim();
    if (cleanEmail === "") {
      throw new Error("Email address cannot be empty.");
    }
    if (!password) {
      throw new Error("Password cannot be empty.");
    }
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', cleanEmail)
      .maybeSingle();
      
    if (error || !user) {
      if (cleanEmail === "admin@ngo-bims.org" || cleanEmail === "ku.dat1@trianglegh.cloud" || cleanEmail.includes("admin")) {
        const newAdmin = {
          email: cleanEmail,
          name: "Default Admin",
          role: "System Administrator",
          assigned_projects: "All",
          status: "Active",
          password: cleanEmail === "ku.dat1@trianglegh.cloud" ? hashPassword("tgh26+") : hashPassword("admin123")
        };
        await supabase.from('users').insert(newAdmin);
        return mapUserToJs(newAdmin);
      } else {
        throw new Error(`Email address '${email}' is not registered in the system registry.`);
      }
    }
    
    if (user.status !== "Active") {
      throw new Error("Your account has been suspended or is inactive.");
    }
    const expectedHash = user.password || hashPassword("password123");
    if (hashPassword(password) !== expectedHash) {
      throw new Error("Invalid email or password.");
    }
    return mapUserToJs(user);
  },

  getProjects: async (userEmail) => {
    const user = await checkUserPermission(userEmail, ["System Administrator", "Project Manager", "Data Entry Officer", "MEAL Officer"]);
    const { data, error } = await supabase.from('projects').select('*');
    if (error) throw error;
    
    // Filter projects so PMs can see projects they are assigned to OR projects they manage
    let filteredData = data || [];
    if (user.role !== "System Administrator" && user.role !== "MEAL Officer") {
      const assigned = user.assigned_projects.split(",").map(c => c.trim().toLowerCase());
      const cleanEmail = user.email.toLowerCase().trim();
      
      filteredData = (data || []).filter(p => {
        const isPmOfProject = p.project_manager && p.project_manager.toLowerCase().trim() === cleanEmail;
        const isAssignedProject = user.assigned_projects === "All" || assigned.includes(p.project_code.toLowerCase().trim());
        return isPmOfProject || isAssignedProject;
      });
    }
    return filteredData.map(mapProjectToJs);
  },

  createProject: async (userEmail, p) => {
    await checkUserPermission(userEmail, ["System Administrator"]);
    const code = p.projectCode.trim().toUpperCase().replace(/\s+/g, "");
    
    const { data: existing } = await supabase
      .from('projects')
      .select('project_code')
      .eq('project_code', code)
      .maybeSingle();
      
    if (existing) {
      throw new Error(`Project Code '${code}' already exists!`);
    }
    
    const dbProj = mapProjectToDb({
      ...p,
      projectCode: code,
      spreadsheetId: `mock-sheet-${code.toLowerCase()}`,
      status: "Active"
    });
    
    const { error } = await supabase.from('projects').insert(dbProj);
    if (error) throw error;
    
    await writeAuditLog(userEmail, "CREATE_PROJECT", `Created project ${code} in Supabase`, code, "");
    return { status: "success", spreadsheetId: dbProj.spreadsheet_id };
  },

  archiveProject: async (userEmail, projectCode) => {
    await checkUserPermission(userEmail, ["System Administrator"]);
    const cleanCode = projectCode.toUpperCase().trim();
    
    const { error } = await supabase
      .from('projects')
      .update({ status: "Archived" })
      .eq('project_code', cleanCode);
      
    if (error) throw error;
    
    await writeAuditLog(userEmail, "ARCHIVE_PROJECT", `Archived project code ${projectCode} in Supabase`, cleanCode, "");
    return { status: "success" };
  },

  getActivities: async (userEmail, projectCode) => {
    await checkUserPermission(userEmail, ["System Administrator", "Project Manager", "Data Entry Officer", "MEAL Officer"]);
    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .eq('project_code', projectCode);
      
    if (error) throw error;
    return data.map(mapActivityToJs);
  },

  createActivity: async (userEmail, projectCode, act) => {
    await checkUserPermission(userEmail, ["System Administrator", "Project Manager"]);
    const code = act.activityCode.trim().toUpperCase();
    
    const { data: existing } = await supabase
      .from('activities')
      .select('activity_code')
      .eq('project_code', projectCode)
      .eq('activity_code', code)
      .maybeSingle();
      
    if (existing) {
      throw new Error(`Activity Code '${code}' already exists in this project!`);
    }
    
    const dbAct = mapActivityToDb({
      ...act,
      activityCode: code,
      sheetName: `ACT_${code}`,
      status: "Active"
    }, projectCode);
    
    const { error } = await supabase.from('activities').insert(dbAct);
    if (error) throw error;
    
    await writeAuditLog(userEmail, "CREATE_ACTIVITY", `Created activity ${code} under project ${projectCode} in Supabase`, projectCode, code);
    return { status: "success", sheetName: dbAct.sheet_name };
  },

  getTemplates: async (userEmail) => {
    await checkUserPermission(userEmail, ["System Administrator", "Project Manager", "Data Entry Officer", "MEAL Officer"]);
    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .order('template_name', { ascending: true });
      
    if (error) throw error;
    return data.map(mapTemplateToJs);
  },

  saveTemplate: async (userEmail, t) => {
    await checkUserPermission(userEmail, ["System Administrator"]);
    const dbTemp = mapTemplateToDb(t);
    
    const { error } = await supabase
      .from('templates')
      .upsert(dbTemp);
      
    if (error) throw error;
    
    await writeAuditLog(userEmail, "SAVE_TEMPLATE", `Saved activity template ${t.templateName} in Supabase`, "", "");
    return { status: "success" };
  },

  deleteTemplate: async (userEmail, name) => {
    await checkUserPermission(userEmail, ["System Administrator"]);
    const { error } = await supabase
      .from('templates')
      .delete()
      .eq('template_name', name.trim());
      
    if (error) throw error;
    
    await writeAuditLog(userEmail, "DELETE_TEMPLATE", `Deleted template ${name} in Supabase`, "", "");
    return { status: "success" };
  },

  getTrackerRecords: async (userEmail, projectCode) => {
    await checkUserPermission(userEmail, ["System Administrator", "Project Manager", "MEAL Officer", "Data Entry Officer"]);
    
    const fs = require('fs');
    const path = require('path');
    const localTrackerFile = path.join(__dirname, 'local_activity_tracker.json');

    function loadLocalTracker() {
      if (!fs.existsSync(localTrackerFile)) return [];
      try {
        return JSON.parse(fs.readFileSync(localTrackerFile, 'utf8'));
      } catch (e) {
        return [];
      }
    }

    try {
      const { data, error } = await supabase
        .from('activity_tracker')
        .select('*')
        .eq('project_code', projectCode)
        .order('created_at', { ascending: false });
        
      if (error) {
        if (error.code === 'PGRST205') {
          console.warn("activity_tracker table not found in Supabase. Falling back to local storage.");
          return loadLocalTracker().filter(r => r.projectCode === projectCode);
        }
        throw error;
      }
      return data.map(mapTrackerToJs);
    } catch (err) {
      if (err.message && err.message.includes("relation \"public.activity_tracker\" does not exist")) {
        console.warn("activity_tracker relation not found. Falling back to local storage.");
        return loadLocalTracker().filter(r => r.projectCode === projectCode);
      }
      throw err;
    }
  },

  createTrackerRecord: async (userEmail, record) => {
    await checkUserPermission(userEmail, ["System Administrator", "Project Manager", "MEAL Officer", "Data Entry Officer"]);
    
    const projectCode = record.projectCode;
    const activityCode = record.activityCode;
    
    const fs = require('fs');
    const path = require('path');
    const localTrackerFile = path.join(__dirname, 'local_activity_tracker.json');

    function loadLocalTracker() {
      if (!fs.existsSync(localTrackerFile)) return [];
      try {
        return JSON.parse(fs.readFileSync(localTrackerFile, 'utf8'));
      } catch (e) {
        return [];
      }
    }

    function saveLocalTracker(data) {
      fs.writeFileSync(localTrackerFile, JSON.stringify(data, null, 2), 'utf8');
    }

    let existingCount = 0;
    let fallbackMode = false;
    
    try {
      const { count, error } = await supabase
        .from('activity_tracker')
        .select('*', { count: 'exact', head: true })
        .eq('project_code', projectCode)
        .eq('activity_code', activityCode);
        
      if (error) {
        if (error.code === 'PGRST205') {
          fallbackMode = true;
        } else {
          throw error;
        }
      } else {
        existingCount = count || 0;
      }
    } catch (err) {
      if (err.message && err.message.includes("relation \"public.activity_tracker\" does not exist")) {
        fallbackMode = true;
      } else {
        throw err;
      }
    }
    
    if (fallbackMode) {
      existingCount = loadLocalTracker().filter(r => r.projectCode === projectCode && r.activityCode === activityCode).length;
    }
    
    const seqGroup = String(existingCount + 1).padStart(2, '0');
    const groupCode = `GRP-${projectCode.toUpperCase()}-${activityCode.toUpperCase()}-${seqGroup}`;
    
    let existingSitesCount = 0;
    const governorate = record.governorate || "SITE";
    const govPrefix = governorate.trim().substring(0, 3).toUpperCase();
    
    if (fallbackMode) {
      existingSitesCount = loadLocalTracker().filter(r => r.siteCode && r.siteCode.includes(`-${govPrefix}-`)).length;
    } else {
      try {
        const { data: sites, error: siteError } = await supabase
          .from('activity_tracker')
          .select('site_code')
          .like('site_code', `%-${govPrefix}-%`);
          
        if (!siteError && sites) {
          existingSitesCount = sites.length;
        }
      } catch (err) {
        // ignore
      }
    }
    
    const seqSite = String(existingSitesCount + 1).padStart(3, '0');
    const siteCode = `SITE-${govPrefix}-${seqSite}`;
    
    const newRecord = {
      ...record,
      groupCode,
      siteCode
    };
    
    if (fallbackMode) {
      const localData = loadLocalTracker();
      const nextId = localData.length > 0 ? Math.max(...localData.map(r => r.id || 0)) + 1 : 1;
      const savedRecord = {
        id: nextId,
        ...newRecord,
        createdAt: new Date().toISOString()
      };
      localData.push(savedRecord);
      saveLocalTracker(localData);
      
      await writeAuditLog(userEmail, "CREATE_TRACKER_LOCAL", `Created local tracker group ${groupCode} under project ${projectCode}`, projectCode, activityCode);
      return savedRecord;
    } else {
      const dbRecord = mapTrackerToDb(newRecord);
      const { data, error } = await supabase
        .from('activity_tracker')
        .insert(dbRecord)
        .select()
        .single();
        
      if (error) throw error;
      
      await writeAuditLog(userEmail, "CREATE_TRACKER", `Created tracker group ${groupCode} under project ${projectCode} in Supabase`, projectCode, activityCode);
      return mapTrackerToJs(data);
    }
  },

  deleteTrackerRecord: async (userEmail, id) => {
    await checkUserPermission(userEmail, ["System Administrator", "Project Manager"]);
    
    const fs = require('fs');
    const path = require('path');
    const localTrackerFile = path.join(__dirname, 'local_activity_tracker.json');

    function loadLocalTracker() {
      if (!fs.existsSync(localTrackerFile)) return [];
      try {
        return JSON.parse(fs.readFileSync(localTrackerFile, 'utf8'));
      } catch (e) {
        return [];
      }
    }

    function saveLocalTracker(data) {
      fs.writeFileSync(localTrackerFile, JSON.stringify(data, null, 2), 'utf8');
    }

    let fallbackMode = false;
    try {
      const { error } = await supabase
        .from('activity_tracker')
        .delete()
        .eq('id', id);
        
      if (error) {
        if (error.code === 'PGRST205') {
          fallbackMode = true;
        } else {
          throw error;
        }
      } else {
        await writeAuditLog(userEmail, "DELETE_TRACKER", `Deleted tracker record id ${id} in Supabase`, "", "");
        return { status: "success" };
      }
    } catch (err) {
      if (err.message && err.message.includes("relation \"public.activity_tracker\" does not exist")) {
        fallbackMode = true;
      } else {
        throw err;
      }
    }
    
    if (fallbackMode) {
      const localData = loadLocalTracker();
      const updated = localData.filter(r => String(r.id) !== String(id));
      saveLocalTracker(updated);
      
      await writeAuditLog(userEmail, "DELETE_TRACKER_LOCAL", `Deleted local tracker record id ${id}`, "", "");
      return { status: "success" };
    }
  },

  bulkUploadTrackerRecords: async (userEmail, projectCode, rows) => {
    await checkUserPermission(userEmail, ["System Administrator", "Project Manager"]);
    
    const fs = require('fs');
    const path = require('path');
    const localTrackerFile = path.join(__dirname, 'local_activity_tracker.json');

    function loadLocalTracker() {
      if (!fs.existsSync(localTrackerFile)) return [];
      try {
        return JSON.parse(fs.readFileSync(localTrackerFile, 'utf8'));
      } catch (e) {
        return [];
      }
    }

    function saveLocalTracker(data) {
      fs.writeFileSync(localTrackerFile, JSON.stringify(data, null, 2), 'utf8');
    }

    let activities = [];
    try {
      const { data: acts } = await supabase
        .from('activities')
        .select('*')
        .eq('project_code', projectCode);
      if (acts) {
        activities = acts.map(mapActivityToJs);
      }
    } catch (err) {
      // ignore
    }
    
    let fallbackMode = false;
    try {
      const { error } = await supabase
        .from('activity_tracker')
        .select('id')
        .limit(1);
      if (error && error.code === 'PGRST205') {
        fallbackMode = true;
      }
    } catch (e) {
      fallbackMode = true;
    }
    
    const savedRecords = [];
    const localData = fallbackMode ? loadLocalTracker() : [];
    let nextId = localData.length > 0 ? Math.max(...localData.map(r => r.id || 0)) + 1 : 1;
    
    let existingRecords = [];
    if (fallbackMode) {
      existingRecords = localData.filter(r => r.projectCode === projectCode);
    } else {
      try {
        const { data } = await supabase
          .from('activity_tracker')
          .select('group_code, site_code, activity_code')
          .eq('project_code', projectCode);
        if (data) {
          existingRecords = data.map(r => ({
            groupCode: r.group_code,
            siteCode: r.site_code,
            activityCode: r.activity_code
          }));
        }
      } catch (err) {
        // ignore
      }
    }
    
    for (const row of rows) {
      const rawActType = row['Activity type'] || row['Activity type (Full Name)'] || "";
      const matchedAct = activities.find(a => 
        a.activityType.toLowerCase() === rawActType.toLowerCase() ||
        a.activityName.toLowerCase() === rawActType.toLowerCase()
      ) || { activityCode: 'GEN', activityType: rawActType, activityName: rawActType, responsibleStaff: row['Staff responsible'] || '' };
      
      const activityCode = matchedAct.activityCode;
      const activityGroupsCount = existingRecords.filter(r => r.activityCode === activityCode).length;
      const seqGroup = String(activityGroupsCount + 1).padStart(2, '0');
      const groupCode = row['Group Code (THE CODE WILL BE GENERATED AUTOMATICALLY)'] || 
                        `GRP-${projectCode.toUpperCase()}-${activityCode.toUpperCase()}-${seqGroup}`;
      
      const locationEn = row['Activity Location (Site Name EN)'] || "";
      const locationAr = row['Activity Location (Site Name AR)'] || "";
      const governorate = "SITE"; 
      const govPrefix = "SITE";
      
      const existingSitesCount = existingRecords.filter(r => r.siteCode && r.siteCode.includes(`-${govPrefix}-`)).length;
      const seqSite = String(existingSitesCount + 1).padStart(3, '0');
      const siteCode = row['Site Code  (THE CODE WILL BE GENERATED AUTOMATICALLY)'] || 
                        `SITE-${govPrefix}-${seqSite}`;
      
      const record = {
        projectCode,
        activityCode,
        groupCode,
        activityType: matchedAct.activityType,
        activityTypeFull: matchedAct.activityName,
        staffResponsible: row['Staff responsible'] || matchedAct.responsibleStaff || "",
        siteCode,
        locationNameEn: locationEn,
        locationNameAr: locationAr,
        latitude: String(row['Latitude'] || row['GPS Location of the activity'] || ""),
        longitude: String(row['Longitude '] || row['Longitude'] || row['__EMPTY_1'] || ""),
        trainingProvider: row['Traning provider'] || "",
        movLink: row['MOVsAttached attendance (Provide the link)'] || "",
        numberOfAttendees: Number(row['Number of attendees']) || 0
      };
      
      existingRecords.push(record);
      
      if (fallbackMode) {
        const saved = {
          id: nextId++,
          ...record,
          createdAt: new Date().toISOString()
        };
        localData.push(saved);
        savedRecords.push(saved);
      } else {
        savedRecords.push(mapTrackerToDb(record));
      }
    }
    
    if (fallbackMode) {
      saveLocalTracker(localData);
      await writeAuditLog(userEmail, "BULK_TRACKER_LOCAL", `Bulk uploaded ${rows.length} tracker rows locally under project ${projectCode}`, projectCode, "");
      return { successCount: rows.length, errorCount: 0 };
    } else {
      const { error } = await supabase
        .from('activity_tracker')
        .insert(savedRecords);
        
      if (error) throw error;
      await writeAuditLog(userEmail, "BULK_TRACKER", `Bulk uploaded ${rows.length} tracker rows in Supabase under project ${projectCode}`, projectCode, "");
      return { successCount: rows.length, errorCount: 0 };
    }
  },


  searchBeneficiaries: async (userEmail, query) => {
    await checkUserPermission(userEmail, ["System Administrator", "Project Manager", "Data Entry Officer", "MEAL Officer"]);
    const q = String(query).toLowerCase().trim();
    if (q === "") return [];
    
    const { data, error } = await supabase
      .from('beneficiaries')
      .select('*')
      .or(`bnf_code.ilike.%${q}%,participant_name_english.ilike.%${q}%,participant_name_arabic.ilike.%${q}%,first_phone_number.ilike.%${q}%,second_phone_number.ilike.%${q}%`)
      .limit(10);
      
    if (error) throw error;
    return data.map(mapBeneficiaryToJs);
  },

  registerParticipant: async (userEmail, projectCode, activityCode, commonData, dynamicData, forceCreate) => {
    await checkUserPermission(userEmail, ["System Administrator", "Project Manager", "Data Entry Officer"]);
    
    const nameEng = (commonData.participantNameEnglish || "").trim();
    const nameAra = (commonData.participantNameArabic || "").trim();
    const phone = (commonData.firstPhoneNumber || "").trim();
    const existingBnfCode = commonData.bnfCode ? commonData.bnfCode.trim() : "";
    const isNewProfile = (existingBnfCode === "" || existingBnfCode.toLowerCase() === "new");

    if (isNewProfile && !forceCreate) {
      let queryMatch = supabase.from('beneficiaries').select('*');
      
      // Match Arabic name, phone number, gender, and age (Logical AND)
      if (nameAra !== "") {
        queryMatch = queryMatch.ilike('participant_name_arabic', nameAra);
      }
      if (phone !== "") {
        queryMatch = queryMatch.eq('first_phone_number', phone);
      }
      if (commonData.gender) {
        queryMatch = queryMatch.eq('gender', commonData.gender);
      }
      if (commonData.age) {
        queryMatch = queryMatch.eq('age', Number(commonData.age));
      }
      
      // Only execute query if we have Arabic name or Phone to avoid empty filter matching
      if (nameAra !== "" || phone !== "") {
        const { data: matches } = await queryMatch;
        
        if (matches && matches.length > 0) {
          const match = matches[0];
          return {
            status: "duplicate_warning",
            match: {
              bnfCode: match.bnf_code,
              nameEng: match.participant_name_english,
              nameAra: match.participant_name_arabic,
              phone: match.first_phone_number,
              age: match.age,
              gender: match.gender,
              displacement: match.displacement_status,
              location: `${match.governorate} / ${match.district}`
            },
            message: "Potential duplicate detected matching the Arabic name, phone number, gender, and age."
          };
        }
      }
    }

    let finalBnfCode = existingBnfCode;
    if (isNewProfile) {
      finalBnfCode = await generateNextBnfCode(projectCode);
      const dbBnf = mapBeneficiaryToDb({
        ...commonData,
        bnfCode: finalBnfCode,
        registeredBy: userEmail,
        firstProjectCode: projectCode
      });
      
      const { error: bnfErr } = await supabase.from('beneficiaries').insert(dbBnf);
      if (bnfErr) throw bnfErr;
    }

    const { data: act } = await supabase
      .from('activities')
      .select('*')
      .eq('project_code', projectCode)
      .eq('activity_code', activityCode)
      .maybeSingle();

    const dbReg = mapRegistrationToDb({
      bnfCode: finalBnfCode,
      projectCode,
      activityCode,
      activityName: act ? act.activity_name : "Unknown Activity",
      activityType: act ? act.activity_type : "Unknown Type",
      implementationDate: act ? act.implementation_date : new Date().toISOString().split('T')[0],
      participantType: commonData.participantType || "Beneficiary",
      participantNameEnglish: nameEng,
      participantNameArabic: nameAra,
      fullName: nameEng || nameAra,
      age: parseInt(commonData.age, 10) || 0,
      gender: commonData.gender,
      displacementStatus: commonData.displacementStatus,
      firstPhoneNumber: phone,
      secondPhoneNumber: commonData.secondPhoneNumber || "",
      governorate: commonData.governorate,
      district: commonData.district,
      subdistrict: commonData.subdistrict,
      responsibleStaff: act ? act.responsible_staff : "Staff",
      registeredBy: userEmail,
      dynamicData: autoCalculateSessions(dynamicData)
    });

    const { error: regErr } = await supabase.from('registrations').insert(dbReg);
    if (regErr) throw regErr;

    await writeAuditLog(userEmail, "REGISTER_BENEFICIARY", `Registered participant ${finalBnfCode} in activity ${activityCode} in Supabase`, projectCode, activityCode);
    return { status: "success", bnfCode: finalBnfCode };
  },

  bulkUploadBeneficiaries: async (userEmail, projectCode, activityCode, rows) => {
    await checkUserPermission(userEmail, ["System Administrator", "Project Manager", "Data Entry Officer"]);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const row of rows) {
      try {
        const commonData = {
          bnfCode: row.bnfCode || "",
          participantNameEnglish: row.participantNameEnglish || "",
          participantNameArabic: row.participantNameArabic || "",
          age: parseInt(row.age, 10) || 0,
          gender: row.gender || "Male",
          displacementStatus: row.displacementStatus || "Host Community",
          firstPhoneNumber: row.firstPhoneNumber || "",
          secondPhoneNumber: row.secondPhoneNumber || "",
          governorate: row.governorate || "",
          district: row.district || "",
          subdistrict: row.subdistrict || "",
          participantType: row.participantType || "Beneficiary"
        };
        const dynamicData = {};
        for (let key in row) {
          if (commonData[key] === undefined) {
            dynamicData[key] = row[key];
          }
        }
        
        const result = await module.exports.registerParticipant(userEmail, projectCode, activityCode, commonData, dynamicData, true);
        if (result.status === 'success') {
          successCount++;
        } else {
          errorCount++;
        }
      } catch (e) {
        console.error("Bulk row error:", e);
        errorCount++;
      }
    }
    return { status: "success", successCount, errorCount };
  },

  getDashboardKPIs: async (userEmail, projectCode, start, end) => {
    const user = await checkUserPermission(userEmail, ["System Administrator", "Project Manager", "Data Entry Officer", "MEAL Officer"]);
    
    let projQuery = supabase.from('projects').select('project_code, status, project_manager');
    const { data: visProjects, error: projErr } = await projQuery;
    if (projErr) throw projErr;
    
    let visProjectsFiltered = visProjects || [];
    if (user.role !== "System Administrator" && user.role !== "MEAL Officer") {
      const assigned = user.assigned_projects.split(",").map(c => c.trim().toLowerCase());
      const cleanEmail = user.email.toLowerCase().trim();
      
      visProjectsFiltered = (visProjects || []).filter(p => {
        const isPmOfProject = p.project_manager && p.project_manager.toLowerCase().trim() === cleanEmail;
        const isAssignedProject = user.assigned_projects === "All" || assigned.includes(p.project_code.toLowerCase().trim());
        return isPmOfProject || isAssignedProject;
      });
    }
    const visProjectCodes = visProjectsFiltered.map(p => p.project_code);
    
    let filteredCodes = visProjectCodes;
    if (projectCode && projectCode !== 'All') {
      filteredCodes = visProjectCodes.filter(c => c.toLowerCase() === projectCode.toLowerCase());
    }

    if (filteredCodes.length === 0) {
      return {
        totalProjects: 0, activeProjects: 0, completedProjects: 0,
        totalActivities: 0, totalBeneficiaries: 0,
        maleBeneficiaries: 0, femaleBeneficiaries: 0, otherBeneficiaries: 0,
        idpBeneficiaries: 0, returneeBeneficiaries: 0, hostBeneficiaries: 0,
        avgPreTestScore: 0, avgPostTestScore: 0,
        chartGender: {}, chartActType: {}, chartMonthly: {}, chartGov: {}, chartDist: {},
        ageBreakdown: {
          male: { "<1": 0, "1-4 years": 0, "5-14 years": 0, "15-17 years": 0, "18-30 years": 0, "31-49 years": 0, "50-60 years": 0, "60+ years": 0 },
          female: { "<1": 0, "1-4 years": 0, "5-14 years": 0, "15-17 years": 0, "18-30 years": 0, "31-49 years": 0, "50-60 years": 0, "60+ years": 0 }
        }
      };
    }

    let regQuery = supabase
      .from('registrations')
      .select('registration_date, bnf_code, activity_type, dynamic_data, project_code, activity_code, activity_name, gender')
      .in('project_code', filteredCodes);

    if (start) regQuery = regQuery.gte('registration_date', start);
    if (end) regQuery = regQuery.lte('registration_date', end);

    const { data: regs, error: regErr } = await regQuery;
    if (regErr) throw regErr;

    const uniqueBnfCodes = [...new Set((regs || []).map(r => r.bnf_code))];
    let bnfs = [];
    if (uniqueBnfCodes.length > 0) {
      const { data: bnfList } = await supabase
        .from('beneficiaries')
        .select('age, gender, displacement_status, governorate, district')
        .in('bnf_code', uniqueBnfCodes);
      bnfs = bnfList || [];
    }

    const ageBreakdown = {
      male: { "<1": 0, "1-4 years": 0, "5-14 years": 0, "15-17 years": 0, "18-30 years": 0, "31-49 years": 0, "50-60 years": 0, "60+ years": 0 },
      female: { "<1": 0, "1-4 years": 0, "5-14 years": 0, "15-17 years": 0, "18-30 years": 0, "31-49 years": 0, "50-60 years": 0, "60+ years": 0 }
    };

    bnfs.forEach(b => {
      const age = Number(b.age) || 0;
      const gender = (b.gender || "").toLowerCase();
      
      let category = "";
      if (age < 1) category = "<1";
      else if (age >= 1 && age <= 4) category = "1-4 years";
      else if (age >= 5 && age <= 14) category = "5-14 years";
      else if (age >= 15 && age <= 17) category = "15-17 years";
      else if (age >= 18 && age <= 30) category = "18-30 years";
      else if (age >= 31 && age <= 49) category = "31-49 years";
      else if (age >= 50 && age <= 60) category = "50-60 years";
      else if (age > 60) category = "60+ years";

      if (category) {
        if (gender === "male") {
          ageBreakdown.male[category]++;
        } else if (gender === "female") {
          ageBreakdown.female[category]++;
        }
      }
    });

    const male = bnfs.filter(b => b.gender === 'Male').length;
    const female = bnfs.filter(b => b.gender === 'Female').length;
    const other = 0;
    
    const idps = bnfs.filter(b => b.displacement_status === 'IDP').length;
    const returnees = bnfs.filter(b => b.displacement_status === 'Returnee').length;
    const host = bnfs.filter(b => b.displacement_status === 'Host Community').length;

    const chartGender = { male, female, other };

    const chartActType = {};
    regs.forEach(r => {
      const t = r.activity_type || 'Unknown';
      chartActType[t] = (chartActType[t] || 0) + 1;
    });

    const chartMonthly = {};
    regs.forEach(r => {
      const d = new Date(r.registration_date);
      if (!isNaN(d)) {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        chartMonthly[key] = (chartMonthly[key] || 0) + 1;
      }
    });

    const chartGov = {};
    bnfs.forEach(b => {
      const gov = b.governorate || 'Unknown';
      chartGov[gov] = (chartGov[gov] || 0) + 1;
    });

    const chartDist = {};
    bnfs.forEach(b => {
      const dist = b.district || 'Unknown';
      chartDist[dist] = (chartDist[dist] || 0) + 1;
    });

    let preScores = [], postScores = [];
    regs.forEach(r => {
      if (r.dynamic_data) {
        if (r.dynamic_data.pre_test_score !== undefined && r.dynamic_data.pre_test_score !== null && r.dynamic_data.pre_test_score !== '') preScores.push(Number(r.dynamic_data.pre_test_score));
        if (r.dynamic_data.post_test_score !== undefined && r.dynamic_data.post_test_score !== null && r.dynamic_data.post_test_score !== '') postScores.push(Number(r.dynamic_data.post_test_score));
      }
    });
    const avgPre = preScores.length ? Math.round(preScores.reduce((a,b)=>a+b,0) / preScores.length) : 0;
    const avgPost = postScores.length ? Math.round(postScores.reduce((a,b)=>a+b,0) / postScores.length) : 0;

    const { count: totalActivities, error: actCountErr } = await supabase
      .from('activities')
      .select('*', { count: 'exact', head: true })
      .in('project_code', filteredCodes);
      
    if (actCountErr) throw actCountErr;

    const matchedProjs = (visProjects || []).filter(p => projectCode === 'All' || p.project_code.toLowerCase() === projectCode.toLowerCase());
    const activeProjects = matchedProjs.filter(p => p.status === 'Active').length;
    const completedProjects = matchedProjs.filter(p => p.status !== 'Active').length;

    // Calculate activity gender breakdown for reporting
    const activityGenderMap = {};
    regs.forEach(r => {
      const actCode = r.activity_code || 'Unknown';
      const actName = r.activity_name || 'Unknown Activity';
      const gender = r.gender || 'Unknown';

      if (!activityGenderMap[actCode]) {
        activityGenderMap[actCode] = {
          activityCode: actCode,
          activityName: actName,
          projectCode: r.project_code,
          male: 0,
          female: 0,
          total: 0
        };
      }

      if (gender === 'Male') {
        activityGenderMap[actCode].male++;
        activityGenderMap[actCode].total++;
      } else if (gender === 'Female') {
        activityGenderMap[actCode].female++;
        activityGenderMap[actCode].total++;
      }
    });
    const activityGenderBreakdown = Object.values(activityGenderMap);

    return {
      totalProjects: matchedProjs.length,
      activeProjects,
      completedProjects,
      totalActivities,
      totalBeneficiaries: uniqueBnfCodes.length,
      maleBeneficiaries: male,
      femaleBeneficiaries: female,
      otherBeneficiaries: other,
      idpBeneficiaries: idps,
      returneeBeneficiaries: returnees,
      hostBeneficiaries: host,
      avgPreTestScore: avgPre,
      avgPostTestScore: avgPost,
      chartGender, chartActType, chartMonthly, chartGov, chartDist,
      ageBreakdown,
      activityGenderBreakdown
    };
  },

  getReportsData: async (userEmail, filters) => {
    await checkUserPermission(userEmail, ["System Administrator", "Project Manager", "MEAL Officer"]);
    
    let query = supabase.from('registrations').select('*');
    if (filters.projectCode && filters.projectCode !== 'All') {
      query = query.eq('project_code', filters.projectCode);
    }
    if (filters.activityType && filters.activityType !== 'All') {
      query = query.eq('activity_type', filters.activityType);
    }
    if (filters.startDate) {
      query = query.gte('registration_date', filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte('registration_date', filters.endDate);
    }
    
    if (filters.query && filters.query.trim() !== '') {
      const q = filters.query.toLowerCase().trim();
      query = query.or(`bnf_code.ilike.%${q}%,participant_name_english.ilike.%${q}%,participant_name_arabic.ilike.%${q}%,first_phone_number.ilike.%${q}%`);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data.map(mapRegistrationToJs);
  },

  getBeneficiaryHistory: async (userEmail, bnfCode) => {
    await checkUserPermission(userEmail, ["System Administrator", "Project Manager", "MEAL Officer"]);
    
    const { data: regs, error: regErr } = await supabase
      .from('registrations')
      .select('*')
      .eq('bnf_code', bnfCode.trim());
      
    if (regErr) throw regErr;
    
    const projectCodes = [...new Set(regs.map(r => r.project_code))];
    let projectMap = {};
    if (projectCodes.length > 0) {
      const { data: projs } = await supabase
        .from('projects')
        .select('project_code, project_name, donor')
        .in('project_code', projectCodes);
      (projs || []).forEach(p => {
        projectMap[p.project_code] = p;
      });
    }
    
    return regs.map(r => ({
      projectCode: r.project_code,
      projectName: projectMap[r.project_code]?.project_name || "TGH Project",
      donor: projectMap[r.project_code]?.donor || "TGH Donor",
      activityCode: r.activity_code,
      activityName: r.activity_name,
      activityType: r.activity_type,
      registrationDate: r.registration_date,
      registeredBy: r.registered_by
    }));
  },

  getUsers: async (userEmail) => {
    await checkUserPermission(userEmail, ["System Administrator"]);
    const { data, error } = await supabase.from('users').select('*');
    if (error) throw error;
    return data.map(mapUserToJs);
  },

  saveUser: async (userEmail, u) => {
    await checkUserPermission(userEmail, ["System Administrator"]);
    
    // Check if user already exists to preserve password if not updated
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('email', u.email.toLowerCase().trim())
      .maybeSingle();
      
    let userPassword = u.password ? hashPassword(u.password) : undefined;
    
    const dbUser = mapUserToDb(u);
    if (existingUser) {
      dbUser.password = userPassword || existingUser.password || hashPassword("password123");
    } else {
      dbUser.password = userPassword || hashPassword("password123");
    }
    
    const { error } = await supabase.from('users').upsert(dbUser);
    if (error) throw error;
    
    await writeAuditLog(userEmail, "SAVE_USER", `Saved user ${u.email} in Supabase`, "", "");
    return { status: "success" };
  },

  deleteUser: async (userEmail, targetEmail) => {
    await checkUserPermission(userEmail, ["System Administrator"]);
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('email', targetEmail.toLowerCase().trim());
      
    if (error) throw error;
    
    await writeAuditLog(userEmail, "DELETE_USER", `Deleted user ${targetEmail} in Supabase`, "", "");
    return { status: "success" };
  },

  getActivityFormDetailsPublic: async (projectCode, activityCode) => {
    // 1. Fetch project to ensure it exists and is active
    const { data: proj, error: projErr } = await supabase
      .from('projects')
      .select('project_name, status')
      .eq('project_code', projectCode)
      .maybeSingle();

    if (projErr || !proj) {
      throw new Error(`Project '${projectCode}' not found.`);
    }

    if (proj.status !== 'Active') {
      throw new Error(`Project '${projectCode}' is not active.`);
    }

    // 2. Fetch activity
    const { data: act, error: actErr } = await supabase
      .from('activities')
      .select('*')
      .eq('project_code', projectCode)
      .eq('activity_code', activityCode)
      .maybeSingle();

    if (actErr || !act) {
      throw new Error(`Activity '${activityCode}' not found under project '${projectCode}'.`);
    }

    if (act.status !== 'Active') {
      throw new Error(`Activity '${activityCode}' is not active.`);
    }

    // 3. Fetch template fields
    const { data: temp, error: tempErr } = await supabase
      .from('templates')
      .select('*')
      .eq('template_name', act.activity_type)
      .maybeSingle();

    const fields = temp ? (Array.isArray(temp.fields) ? temp.fields : []) : [];

    return {
      projectCode,
      projectName: proj.project_name,
      activityCode,
      activityName: act.activity_name,
      activityType: act.activity_type,
      location: act.location,
      fields
    };
  },

  registerParticipantPublic: async (projectCode, activityCode, commonData, dynamicData, forceCreate) => {
    const nameEng = (commonData.participantNameEnglish || "").trim();
    const nameAra = (commonData.participantNameArabic || "").trim();
    const phone = (commonData.firstPhoneNumber || "").trim();
    const existingBnfCode = commonData.bnfCode ? commonData.bnfCode.trim() : "";
    const isNewProfile = (existingBnfCode === "" || existingBnfCode.toLowerCase() === "new");

    // Duplicate check for new profiles
    if (isNewProfile && !forceCreate) {
      let queryMatch = supabase.from('beneficiaries').select('*');
      
      // Match Arabic name, phone number, gender, and age (Logical AND)
      if (nameAra !== "") {
        queryMatch = queryMatch.ilike('participant_name_arabic', nameAra);
      }
      if (phone !== "") {
        queryMatch = queryMatch.eq('first_phone_number', phone);
      }
      if (commonData.gender) {
        queryMatch = queryMatch.eq('gender', commonData.gender);
      }
      if (commonData.age) {
        queryMatch = queryMatch.eq('age', Number(commonData.age));
      }
      
      // Only execute query if we have Arabic name or Phone to avoid empty filter matching
      if (nameAra !== "" || phone !== "") {
        const { data: matches } = await queryMatch;
        
        if (matches && matches.length > 0) {
          const match = matches[0];
          return {
            status: "duplicate_warning",
            match: {
              bnfCode: match.bnf_code,
              nameEng: match.participant_name_english,
              nameAra: match.participant_name_arabic,
              phone: match.first_phone_number,
              age: match.age,
              gender: match.gender,
              displacement: match.displacement_status,
              location: `${match.governorate} / ${match.district}`
            },
            message: "Potential duplicate detected matching the Arabic name, phone number, gender, and age."
          };
        }
      }
    }

    let finalBnfCode = existingBnfCode;
    if (isNewProfile) {
      finalBnfCode = await generateNextBnfCode(projectCode);
      const dbBnf = mapBeneficiaryToDb({
        ...commonData,
        bnfCode: finalBnfCode,
        registeredBy: "Public Form",
        firstProjectCode: projectCode
      });
      
      const { error: bnfErr } = await supabase.from('beneficiaries').insert(dbBnf);
      if (bnfErr) throw bnfErr;
    }

    const { data: act } = await supabase
      .from('activities')
      .select('*')
      .eq('project_code', projectCode)
      .eq('activity_code', activityCode)
      .maybeSingle();

    const dbReg = mapRegistrationToDb({
      bnfCode: finalBnfCode,
      projectCode,
      activityCode,
      activityName: act ? act.activity_name : "Unknown Activity",
      activityType: act ? act.activity_type : "Unknown Type",
      implementationDate: act ? act.implementation_date : new Date().toISOString().split('T')[0],
      participantType: commonData.participantType || "Beneficiary",
      participantNameEnglish: nameEng,
      participantNameArabic: nameAra,
      fullName: nameEng || nameAra,
      age: parseInt(commonData.age, 10) || 0,
      gender: commonData.gender,
      displacementStatus: commonData.displacementStatus,
      firstPhoneNumber: phone,
      secondPhoneNumber: commonData.secondPhoneNumber || "",
      governorate: commonData.governorate,
      district: commonData.district,
      subdistrict: commonData.subdistrict,
      responsibleStaff: act ? act.responsible_staff : "Staff",
      registeredBy: "Public Form",
      dynamicData
    });

    const { error: regErr } = await supabase.from('registrations').insert(dbReg);
    if (regErr) throw regErr;

    await writeAuditLog("Public Form", "REGISTER_BENEFICIARY_PUBLIC", `Registered public participant ${finalBnfCode} in activity ${activityCode} in Supabase`, projectCode, activityCode);
    return { status: "success", bnfCode: finalBnfCode };
  },

  deleteRegistration: async (userEmail, bnfCode, projectCode, activityCode) => {
    await checkUserPermission(userEmail, ["System Administrator", "Project Manager"]);
    
    const { error } = await supabase
      .from('registrations')
      .delete()
      .eq('bnf_code', bnfCode.trim())
      .eq('project_code', projectCode.trim())
      .eq('activity_code', activityCode.trim());
      
    if (error) throw error;
    
    await writeAuditLog(userEmail, "DELETE_REGISTRATION", `Deleted registration for beneficiary ${bnfCode} from activity ${activityCode}`, projectCode, activityCode);
    return { status: "success" };
  },

  // ======================== ACTIVITY TRACKER ========================

  getTrackerRecords: async (userEmail, projectCode) => {
    await checkUserPermission(userEmail, ["System Administrator", "Project Manager", "MEAL Officer", "Data Entry Officer"]);

    const { data, error } = await supabase
      .from('activity_tracker')
      .select('*')
      .eq('project_code', projectCode.trim())
      .order('created_at', { ascending: false });

    if (error) {
      // Table may not exist yet — return empty list gracefully
      if (error.code === 'PGRST205' || error.code === '42P01' || (error.message && error.message.includes('does not exist'))) {
        console.warn('[Tracker] activity_tracker table not found, returning empty list.');
        return [];
      }
      throw error;
    }

    return (data || []).map(mapTrackerToJs);
  },

  createTrackerRecord: async (userEmail, record) => {
    await checkUserPermission(userEmail, ["System Administrator", "Project Manager"]);

    const projectCode = (record.projectCode || '').toUpperCase().trim();
    const activityCode = (record.activityCode || '').toUpperCase().trim();

    // Auto-generate Group Code and Site Code
    const timestamp = Date.now().toString().slice(-6);
    const groupCode = `GRP-${projectCode}-${activityCode}-${timestamp}`;
    const siteCode  = `SITE-${projectCode}-${timestamp}`;

    const dbRecord = mapTrackerToDb({
      ...record,
      groupCode,
      siteCode,
      projectCode,
      activityCode
    });

    const { data, error } = await supabase
      .from('activity_tracker')
      .insert(dbRecord)
      .select()
      .single();

    if (error) throw error;

    await writeAuditLog(userEmail, "CREATE_TRACKER_RECORD", `Logged tracker record ${groupCode} for project ${projectCode}`, projectCode, activityCode);
    return mapTrackerToJs(data);
  },

  deleteTrackerRecord: async (userEmail, id) => {
    await checkUserPermission(userEmail, ["System Administrator", "Project Manager"]);

    const { error } = await supabase
      .from('activity_tracker')
      .delete()
      .eq('id', id);

    if (error) throw error;

    await writeAuditLog(userEmail, "DELETE_TRACKER_RECORD", `Deleted tracker record id=${id}`, null, null);
    return { status: "success" };
  },

  bulkUploadTrackerRecords: async (userEmail, projectCode, rows) => {
    await checkUserPermission(userEmail, ["System Administrator", "Project Manager"]);

    const cleanProject = (projectCode || '').toUpperCase().trim();
    let inserted = 0;
    let skipped  = 0;

    for (const row of rows) {
      try {
        const activityType = (row['Activity type'] || '').toString().trim();
        const activityTypeFull = (row['Activity type (Full Name)'] || row['Activity type'] || '').toString().trim();
        const staffResponsible = (row['Staff responsible'] || '').toString().trim();
        const locationNameEn   = (row['Activity Location (Site Name EN)'] || '').toString().trim();
        const locationNameAr   = (row['Activity Location (Site Name AR)'] || '').toString().trim();
        const latitude         = (row['Latitude'] || '').toString().trim();
        const longitude        = (row['Longitude'] || '').toString().trim();
        const trainingProvider = (row['Traning provider'] || '').toString().trim();
        const movLink          = (row['MOVsAttached attendance (Provide the link)'] || '').toString().trim();
        const numberOfAttendees = Number(row['Number of attendees']) || 0;

        // Use existing codes from the sheet if provided, else auto-generate
        const groupCode = (row['Group Code (THE CODE WILL BE GENERATED AUTOMATICALLY)'] || '').toString().trim()
          || `GRP-${cleanProject}-${Date.now().toString().slice(-6)}`;
        const siteCode  = (row['Site Code  (THE CODE WILL BE GENERATED AUTOMATICALLY)'] || '').toString().trim()
          || `SITE-${cleanProject}-${Date.now().toString().slice(-6)}`;

        if (!locationNameEn && !locationNameAr) { skipped++; continue; }

        const dbRecord = {
          project_code:        cleanProject,
          activity_code:       activityType,
          group_code:          groupCode,
          site_code:           siteCode,
          activity_type:       activityType,
          activity_type_full:  activityTypeFull,
          staff_responsible:   staffResponsible,
          location_name_en:    locationNameEn,
          location_name_ar:    locationNameAr,
          latitude:            latitude,
          longitude:           longitude,
          training_provider:   trainingProvider,
          mov_link:            movLink,
          number_of_attendees: numberOfAttendees
        };

        const { error } = await supabase.from('activity_tracker').insert(dbRecord);
        if (error) { console.error('[TrackerBulk] row error:', error.message); skipped++; }
        else inserted++;
      } catch (e) {
        console.error('[TrackerBulk] unexpected row error:', e.message);
        skipped++;
      }
    }

    await writeAuditLog(userEmail, "BULK_UPLOAD_TRACKER", `Bulk-uploaded ${inserted} tracker records for ${cleanProject}`, cleanProject, null);
    return { inserted, skipped, total: rows.length };
  },

  getIndicators: async (userEmail, projectCode) => {
    await checkUserPermission(userEmail, ["System Administrator", "Project Manager", "MEAL Officer", "Data Entry Officer"]);
    let query = supabase.from('project_indicators').select('*');
    if (projectCode && projectCode !== 'All') {
      query = query.eq('project_code', projectCode);
    }
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapIndicatorToJs);
  },

  createIndicator: async (userEmail, record) => {
    await checkUserPermission(userEmail, ["System Administrator", "Project Manager", "MEAL Officer"]);
    const dbRecord = mapIndicatorToDb(record);
    const { data, error } = await supabase
      .from('project_indicators')
      .insert(dbRecord)
      .select()
      .single();
    if (error) throw error;
    await writeAuditLog(userEmail, "CREATE_INDICATOR", `Created indicator for project ${record.projectCode}`, record.projectCode, null);
    return mapIndicatorToJs(data);
  },

  updateIndicator: async (userEmail, id, record) => {
    await checkUserPermission(userEmail, ["System Administrator", "Project Manager", "MEAL Officer"]);
    const dbRecord = mapIndicatorToDb(record);
    const { data, error } = await supabase
      .from('project_indicators')
      .update(dbRecord)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    await writeAuditLog(userEmail, "UPDATE_INDICATOR", `Updated indicator ${id} for project ${record.projectCode}`, record.projectCode, null);
    return mapIndicatorToJs(data);
  },

  deleteIndicator: async (userEmail, id) => {
    await checkUserPermission(userEmail, ["System Administrator", "Project Manager", "MEAL Officer"]);
    const { error } = await supabase
      .from('project_indicators')
      .delete()
      .eq('id', id);
    if (error) throw error;
    await writeAuditLog(userEmail, "DELETE_INDICATOR", `Deleted indicator id=${id}`, null, null);
    return { status: "success" };
  },

  bulkUploadIndicators: async (userEmail, projectCode, rows) => {
    await checkUserPermission(userEmail, ["System Administrator", "Project Manager", "MEAL Officer"]);
    const cleanProject = (projectCode || '').toUpperCase().trim();
    let successCount = 0;
    let errorCount = 0;

    for (const row of rows) {
      try {
        const rawDesc = row['Indicator Description'] || row['indicatorDescription'] || row['indicator_description'] || '';
        const rawTarget = Number(row['Target Value'] || row['targetValue'] || row['target_value']) || 0;
        const rawAchieved = Number(row['Achieved Target'] || row['achievedTarget'] || row['achieved_target']) || 0;
        const rawBnfType = row['Type of Beneficiaries (BNFs)'] || row['bnfType'] || row['bnf_type'] || '';
        const rawMen = Number(row['Number of Men'] || row['numMen'] || row['num_men']) || 0;
        const rawWomen = Number(row['Number of Women'] || row['numWomen'] || row['num_women']) || 0;

        if (!rawDesc) { errorCount++; continue; }

        const dbRecord = {
          project_code:          cleanProject,
          indicator_description: rawDesc,
          target_value:          rawTarget,
          achieved_target:       rawAchieved,
          bnf_type:              rawBnfType,
          num_men:               rawMen,
          num_women:             rawWomen,
          total_beneficiaries:   rawMen + rawWomen
        };

        const { error } = await supabase.from('project_indicators').insert(dbRecord);
        if (error) {
          console.error('[IndicatorsBulk] row error:', error.message);
          errorCount++;
        } else {
          successCount++;
        }
      } catch (e) {
        console.error('[IndicatorsBulk] unexpected row error:', e.message);
        errorCount++;
      }
    }

    await writeAuditLog(userEmail, "BULK_UPLOAD_INDICATORS", `Bulk-uploaded ${successCount} indicators for ${cleanProject}`, cleanProject, null);
    return { status: "success", successCount, errorCount };
  }
};
