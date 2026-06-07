import React, { useState, useEffect } from 'react';
import api from '../api';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function Dashboard({ theme, showToast }) {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  
  // KPI data state
  const [kpis, setKpis] = useState({
    totalProjects: 0,
    activeProjects: 0,
    completedProjects: 0,
    totalActivities: 0,
    totalBeneficiaries: 0,
    maleBeneficiaries: 0,
    femaleBeneficiaries: 0,
    otherBeneficiaries: 0,
    idpBeneficiaries: 0,
    returneeBeneficiaries: 0,
    hostBeneficiaries: 0,
    avgPreTestScore: 0,
    avgPostTestScore: 0,
    chartGender: { male: 0, female: 0 },
    chartActType: {},
    chartMonthly: {},
    chartGov: {},
    chartDist: {},
    ageBreakdown: {
      male: { "<1": 0, "1-4 years": 0, "5-14 years": 0, "15-17 years": 0, "18-30 years": 0, "31-49 years": 0, "50-60 years": 0, "60+ years": 0 },
      female: { "<1": 0, "1-4 years": 0, "5-14 years": 0, "15-17 years": 0, "18-30 years": 0, "31-49 years": 0, "50-60 years": 0, "60+ years": 0 }
    },
    activityGenderBreakdown: []
  });

  // Fetch projects dropdown
  useEffect(() => {
    api.getProjects()
      .then(data => {
        setProjects(data);
      })
      .catch(err => {
        showToast(err.message || 'Failed to load projects list', 'danger');
      });
  }, []);

  // Fetch KPI statistics
  const fetchKPIs = () => {
    setLoading(true);
    api.getDashboardKPIs(selectedProject, startDate, endDate)
      .then(data => {
        setKpis(data);
      })
      .catch(err => {
        showToast(err.message || 'Failed to load dashboard KPIs', 'danger');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchKPIs();
  }, [selectedProject]);

  const handleApplyFilters = () => {
    fetchKPIs();
  };

  // Theme-sensitive styles
  const isDark = theme === 'dark';
  const gridColor = isDark ? '#27272a' : '#e2e8f0';
  const textColor = isDark ? '#a1a1aa' : '#64748b';

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: textColor }
      }
    },
    scales: {
      x: {
        grid: { color: gridColor },
        ticks: { color: textColor }
      },
      y: {
        grid: { color: gridColor },
        ticks: { color: textColor }
      }
    }
  };

  // 1. Gender breakdown
  const genderData = {
    labels: ['Male', 'Female'],
    datasets: [{
      data: [kpis.chartGender?.male || 0, kpis.chartGender?.female || 0],
      backgroundColor: ['#3b82f6', '#ec4899'],
      borderColor: isDark ? '#18181b' : '#ffffff',
      borderWidth: 2
    }]
  };

  // 2. Beneficiaries by Activity Type
  const actKeys = Object.keys(kpis.chartActType || {});
  const actVals = Object.values(kpis.chartActType || {});
  const actTypeData = {
    labels: actKeys.length ? actKeys : ['No Data'],
    datasets: [{
      label: 'Registered',
      data: actVals.length ? actVals : [0],
      backgroundColor: '#F49600',
      borderRadius: 4
    }]
  };

  // 3. Monthly registrations timeline
  const monthKeys = Object.keys(kpis.chartMonthly || {}).sort();
  const monthVals = monthKeys.map(k => kpis.chartMonthly[k]);
  const monthlyTimelineData = {
    labels: monthKeys.length ? monthKeys : ['No Data'],
    datasets: [{
      label: 'Registrations',
      data: monthVals.length ? monthVals : [0],
      borderColor: '#10b981',
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
      fill: true,
      tension: 0.3,
      borderWidth: 2
    }]
  };

  // 4. Pre/Post test averages
  const scoresData = {
    labels: ['Average Score'],
    datasets: [
      {
        label: 'Pre-Test',
        data: [kpis.avgPreTestScore],
        backgroundColor: '#ef4444',
        borderRadius: 4
      },
      {
        label: 'Post-Test',
        data: [kpis.avgPostTestScore],
        backgroundColor: '#10b981',
        borderRadius: 4
      }
    ]
  };

  // 5. Governorate distribution
  const govKeys = Object.keys(kpis.chartGov || {});
  const govVals = Object.values(kpis.chartGov || {});
  const govData = {
    labels: govKeys.length ? govKeys : ['No Data'],
    datasets: [{
      label: 'Registered',
      data: govVals.length ? govVals : [0],
      backgroundColor: '#8b5cf6',
      borderRadius: 4
    }]
  };

  // 6. District distribution
  const distKeys = Object.keys(kpis.chartDist || {});
  const distVals = Object.values(kpis.chartDist || {});
  const distData = {
    labels: distKeys.length ? distKeys : ['No Data'],
    datasets: [{
      label: 'Registered',
      data: distVals.length ? distVals : [0],
      backgroundColor: '#3b82f6',
      borderRadius: 4
    }]
  };

  // Grouped Bar Chart for Activity Gender Breakdown
  const activityLabels = (kpis.activityGenderBreakdown || []).map(a => a.activityCode);
  const activityMaleCounts = (kpis.activityGenderBreakdown || []).map(a => a.male);
  const activityFemaleCounts = (kpis.activityGenderBreakdown || []).map(a => a.female);

  const activityGenderChartData = {
    labels: activityLabels.length ? activityLabels : ['No Data'],
    datasets: [
      {
        label: 'Male',
        data: activityMaleCounts.length ? activityMaleCounts : [0],
        backgroundColor: '#3b82f6',
        borderRadius: 4
      },
      {
        label: 'Female',
        data: activityFemaleCounts.length ? activityFemaleCounts : [0],
        backgroundColor: '#ec4899',
        borderRadius: 4
      }
    ]
  };

  // Percent calculation helpers
  const totalReach = kpis.totalBeneficiaries || 1;
  const malePct = Math.round((kpis.maleBeneficiaries / totalReach) * 100);
  const femalePct = Math.round((kpis.femaleBeneficiaries / totalReach) * 100);

  return (
    <div className="container-fluid p-0">
      
      {/* FILTER BAR */}
      <div className="glass-card mb-4">
        <div className="row g-3 align-items-end">
          <div className="col-md-4">
            <label htmlFor="db-project-filter" className="form-label fw-bold">Select Project Scope</label>
            <select 
              id="db-project-filter" 
              className="form-select form-control"
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
            >
              <option value="All">All Projects</option>
              {projects.map(p => (
                <option key={p.projectCode} value={p.projectCode}>
                  {p.projectCode} - {p.projectName}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-3">
            <label htmlFor="db-start-date" className="form-label fw-bold">Start Date</label>
            <input 
              type="date" 
              id="db-start-date" 
              className="form-control"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="col-md-3">
            <label htmlFor="db-end-date" className="form-label fw-bold">End Date</label>
            <input 
              type="date" 
              id="db-end-date" 
              className="form-control"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className="col-md-2">
            <button 
              className="btn btn-primary w-100 py-2" 
              onClick={handleApplyFilters}
              disabled={loading}
            >
              <i className="bi bi-filter"></i> Apply Filters
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-warning" role="status" style={{ width: '3rem', height: '3rem' }}>
            <span className="visually-hidden">Loading...</span>
          </div>
          <h5 className="mt-3 text-muted">Analyzing KPI Datasets...</h5>
        </div>
      ) : (
        <>
          {/* KPI CARDS */}
          <div className="kpi-grid mb-4">
            <div className="glass-card kpi-card">
              <div className="kpi-icon-wrap bg-primary-glow text-primary"><i className="bi bi-folder"></i></div>
              <div className="kpi-data">
                <div className="kpi-label">Projects Reach</div>
                <div className="kpi-value">{kpis.totalProjects}</div>
                <div className="small text-muted">{kpis.activeProjects} Active / {kpis.completedProjects} Archived</div>
              </div>
            </div>
            
            <div className="glass-card kpi-card">
              <div className="kpi-icon-wrap bg-info-glow text-info"><i className="bi bi-calendar-check"></i></div>
              <div className="kpi-data">
                <div className="kpi-label">Activities Conducted</div>
                <div className="kpi-value">{kpis.totalActivities}</div>
                <div className="kpi-progress-bar"><div className="kpi-progress-fill" style={{ width: '100%' }}></div></div>
              </div>
            </div>
            
            <div className="glass-card kpi-card">
              <div className="kpi-icon-wrap bg-success-glow text-success"><i className="bi bi-people"></i></div>
              <div className="kpi-data">
                <div className="kpi-label">Total Beneficiaries</div>
                <div className="kpi-value">{kpis.totalBeneficiaries}</div>
                <div className="small text-muted">
                  M: {kpis.maleBeneficiaries} | F: {kpis.femaleBeneficiaries}
                  {kpis.otherBeneficiaries > 0 && ` | O: ${kpis.otherBeneficiaries}`}
                </div>
              </div>
            </div>
            
            <div className="glass-card kpi-card">
              <div className="kpi-icon-wrap bg-warning-glow text-warning"><i className="bi bi-person-exclamation"></i></div>
              <div className="kpi-data">
                <div className="kpi-label">Displaced Reach (IDPs)</div>
                <div className="kpi-value">{kpis.idpBeneficiaries}</div>
                <div className="small text-muted">{kpis.returneeBeneficiaries} Returnees / {kpis.hostBeneficiaries} Host</div>
              </div>
            </div>
          </div>

          {/* BENEFICIARY AGE & GENDER BREAKDOWN TABLE */}
          <div className="glass-card mb-4">
            <div className="glass-card-header mb-3">
              <div className="glass-card-title text-main">
                <i className="bi bi-people text-warning"></i> Beneficiary Age &amp; Gender Breakdown
              </div>
            </div>
            <div className="table-responsive">
              <table className="table table-bordered text-center custom-table" style={{ minWidth: '1000px', fontSize: '0.875rem' }}>
                <thead>
                  <tr>
                    <th colSpan="8" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', borderBottom: '2px solid #3b82f6', fontWeight: 'bold' }}>Male</th>
                    <th colSpan="8" style={{ backgroundColor: 'rgba(236, 72, 153, 0.1)', color: '#ec4899', borderBottom: '2px solid #ec4899', fontWeight: 'bold' }}>Female</th>
                    <th rowSpan="2" className="align-middle" style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)', fontWeight: 'bold' }}>Male Total</th>
                    <th rowSpan="2" className="align-middle" style={{ backgroundColor: 'rgba(236, 72, 153, 0.15)', fontWeight: 'bold' }}>Female Total</th>
                    <th rowSpan="2" className="align-middle" style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', fontWeight: 'bold' }}>Total</th>
                  </tr>
                  <tr>
                    {/* Male headers */}
                    <th style={{ fontSize: '0.8rem', fontWeight: '500' }}>&lt;1</th>
                    <th style={{ fontSize: '0.8rem', fontWeight: '500' }}>1-4</th>
                    <th style={{ fontSize: '0.8rem', fontWeight: '500' }}>5-14</th>
                    <th style={{ fontSize: '0.8rem', fontWeight: '500' }}>15-17</th>
                    <th style={{ fontSize: '0.8rem', fontWeight: '500' }}>18-30</th>
                    <th style={{ fontSize: '0.8rem', fontWeight: '500' }}>31-49</th>
                    <th style={{ fontSize: '0.8rem', fontWeight: '500' }}>50-60</th>
                    <th style={{ fontSize: '0.8rem', fontWeight: '500' }}>60+</th>
                    {/* Female headers */}
                    <th style={{ fontSize: '0.8rem', fontWeight: '500' }}>&lt;1</th>
                    <th style={{ fontSize: '0.8rem', fontWeight: '500' }}>1-4</th>
                    <th style={{ fontSize: '0.8rem', fontWeight: '500' }}>5-14</th>
                    <th style={{ fontSize: '0.8rem', fontWeight: '500' }}>15-17</th>
                    <th style={{ fontSize: '0.8rem', fontWeight: '500' }}>18-30</th>
                    <th style={{ fontSize: '0.8rem', fontWeight: '500' }}>31-49</th>
                    <th style={{ fontSize: '0.8rem', fontWeight: '500' }}>50-60</th>
                    <th style={{ fontSize: '0.8rem', fontWeight: '500' }}>60+</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {/* Male counts */}
                    <td>{kpis.ageBreakdown?.male?.["<1"] || 0}</td>
                    <td>{kpis.ageBreakdown?.male?.["1-4 years"] || 0}</td>
                    <td>{kpis.ageBreakdown?.male?.["5-14 years"] || 0}</td>
                    <td>{kpis.ageBreakdown?.male?.["15-17 years"] || 0}</td>
                    <td>{kpis.ageBreakdown?.male?.["18-30 years"] || 0}</td>
                    <td>{kpis.ageBreakdown?.male?.["31-49 years"] || 0}</td>
                    <td>{kpis.ageBreakdown?.male?.["50-60 years"] || 0}</td>
                    <td>{kpis.ageBreakdown?.male?.["60+ years"] || 0}</td>
                    
                    {/* Female counts */}
                    <td>{kpis.ageBreakdown?.female?.["<1"] || 0}</td>
                    <td>{kpis.ageBreakdown?.female?.["1-4 years"] || 0}</td>
                    <td>{kpis.ageBreakdown?.female?.["5-14 years"] || 0}</td>
                    <td>{kpis.ageBreakdown?.female?.["15-17 years"] || 0}</td>
                    <td>{kpis.ageBreakdown?.female?.["18-30 years"] || 0}</td>
                    <td>{kpis.ageBreakdown?.female?.["31-49 years"] || 0}</td>
                    <td>{kpis.ageBreakdown?.female?.["50-60 years"] || 0}</td>
                    <td>{kpis.ageBreakdown?.female?.["60+ years"] || 0}</td>

                    {/* Totals */}
                    <td style={{ fontWeight: 'bold', backgroundColor: 'rgba(59, 130, 246, 0.05)' }}>
                      {Object.values(kpis.ageBreakdown?.male || {}).reduce((a, b) => a + b, 0)}
                    </td>
                    <td style={{ fontWeight: 'bold', backgroundColor: 'rgba(236, 72, 153, 0.05)' }}>
                      {Object.values(kpis.ageBreakdown?.female || {}).reduce((a, b) => a + b, 0)}
                    </td>
                    <td style={{ fontWeight: 'bold', backgroundColor: 'rgba(16, 185, 129, 0.08)' }}>
                      {Object.values(kpis.ageBreakdown?.male || {}).reduce((a, b) => a + b, 0) + 
                       Object.values(kpis.ageBreakdown?.female || {}).reduce((a, b) => a + b, 0)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* CHARTS */}
          <div className="row g-4 mb-4">
            <div className="col-lg-4">
              <div className="glass-card h-100 d-flex flex-column justify-content-between">
                <div className="glass-card-header">
                  <div className="glass-card-title text-main"><i className="bi bi-gender-ambiguous"></i> Gender Breakdown</div>
                </div>
                <div style={{ position: 'relative', height: '230px', width: '100%' }}>
                  <Doughnut 
                    data={genderData} 
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { position: 'bottom', labels: { color: textColor } } }
                    }} 
                  />
                </div>
                 <div className="mt-3 text-center small text-muted">
                  {malePct || 0}% Male vs {femalePct || 0}% Female
                </div>
              </div>
            </div>
            
            <div className="col-lg-8">
              <div className="glass-card h-100 d-flex flex-column justify-content-between">
                <div className="glass-card-header">
                  <div className="glass-card-title text-main"><i className="bi bi-diagram-3"></i> Beneficiaries by Activity Type</div>
                </div>
                <div style={{ position: 'relative', height: '230px', width: '100%' }}>
                  <Bar data={actTypeData} options={chartOptions} />
                </div>
              </div>
            </div>
          </div>

          <div className="row g-4 mb-4">
            <div className="col-lg-6">
              <div className="glass-card h-100">
                <div className="glass-card-header">
                  <div className="glass-card-title text-main"><i className="bi bi-graph-up-arrow"></i> Monthly Registrations</div>
                </div>
                <div style={{ position: 'relative', height: '250px', width: '100%' }}>
                  <Line data={monthlyTimelineData} options={chartOptions} />
                </div>
              </div>
            </div>
            
            <div className="col-lg-6">
              <div className="glass-card h-100">
                <div className="glass-card-header">
                  <div className="glass-card-title text-main"><i className="bi bi-mortarboard"></i> Training Performance (Scores)</div>
                </div>
                <div style={{ position: 'relative', height: '250px', width: '100%' }}>
                  <Bar 
                    data={scoresData} 
                    options={{
                      ...chartOptions,
                      scales: {
                        ...chartOptions.scales,
                        y: { ...chartOptions.scales.y, min: 0, max: 100 }
                      }
                    }} 
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="row g-4">
            <div className="col-lg-6">
              <div className="glass-card h-100">
                <div className="glass-card-header">
                  <div className="glass-card-title text-main"><i className="bi bi-geo-alt"></i> Beneficiaries by Governorate</div>
                </div>
                <div style={{ position: 'relative', height: '250px', width: '100%' }}>
                  <Bar data={govData} options={chartOptions} />
                </div>
              </div>
            </div>
            
            <div className="col-lg-6">
              <div className="glass-card h-100">
                <div className="glass-card-header">
                  <div className="glass-card-title text-main"><i className="bi bi-geo"></i> Beneficiaries by District</div>
                </div>
                <div style={{ position: 'relative', height: '250px', width: '100%' }}>
                  <Bar data={distData} options={chartOptions} />
                </div>
              </div>
            </div>
          </div>

          {/* ACTIVITY GENDER REPORTING SECTION */}
          <div className="glass-card mb-4 mt-4">
            <div className="glass-card-header mb-3">
              <div className="glass-card-title text-main">
                <i className="bi bi-gender-ambiguous text-primary"></i> Activity-wise Gender Reporting
              </div>
            </div>
            
            <div className="row g-4 mb-4">
              <div className="col-12">
                <div style={{ position: 'relative', height: '280px', width: '100%' }}>
                  <Bar data={activityGenderChartData} options={chartOptions} />
                </div>
              </div>
            </div>

            <div className="table-responsive">
              <table className="custom-table text-center" style={{ fontSize: '0.875rem' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Activity Code</th>
                    <th style={{ textAlign: 'left' }}>Activity Name</th>
                    <th>Project</th>
                    <th>Male</th>
                    <th>Female</th>
                    <th style={{ fontWeight: 'bold' }}>Total Enrolled</th>
                  </tr>
                </thead>
                <tbody>
                  {!kpis.activityGenderBreakdown || kpis.activityGenderBreakdown.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-muted py-4">No activity registrations found in the query results.</td>
                    </tr>
                  ) : (
                    kpis.activityGenderBreakdown.map((item, index) => (
                      <tr key={index}>
                        <td style={{ textAlign: 'left' }}><code>{item.activityCode}</code></td>
                        <td style={{ textAlign: 'left' }}><strong>{item.activityName}</strong></td>
                        <td><span className="badge bg-secondary text-dark">{item.projectCode}</span></td>
                        <td>{item.male}</td>
                        <td>{item.female}</td>
                        <td style={{ fontWeight: 'bold' }}>{item.total}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

    </div>
  );
}
