import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { getProducerDemographics } from '../services/dataService';

export default function ProducerDemographicsSection() {
  const demographics = getProducerDemographics();
  const ageData = Object.entries(demographics.ageGroups).map(([age, count]) => ({ age, count }));
  const genderData = Object.entries(demographics.genderDistribution).map(([gender, count]) => ({
    gender: gender === 'notSpecified' ? 'Not Specified' : gender.charAt(0).toUpperCase() + gender.slice(1),
    count,
  }));

  return (
    <section className="mb-5">
      <div className="section-card">
        <div className="card-body">
          <h2 className="section-title">Producer Demographics</h2>
          <p className="text-muted small">Province-wide aggregated demographic information from recorded salt producer data.</p>
          <div className="row g-3">
            <div className="col-lg-6">
              <h3 className="h6 mb-3">Age Distribution</h3>
              <div className="chart-container" style={{ height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ageData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <XAxis dataKey="age" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip formatter={(value) => [value, 'Producers']} />
                    <Bar dataKey="count" fill="#198754" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="col-lg-6">
              <h3 className="h6 mb-3">Gender Distribution</h3>
              <div className="chart-container" style={{ height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={genderData}
                      dataKey="count"
                      nameKey="gender"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ gender, count }) => `${gender}: ${count}`}
                    >
                      {genderData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={['#0d6efd', '#dc3545', '#6c757d'][index % 3]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [value, '']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
