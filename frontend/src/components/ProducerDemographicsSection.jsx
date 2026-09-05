import React, { useMemo } from 'react';
import { Card, Row, Col } from 'react-bootstrap';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { getProducerDemographics } from '../services/dataService';
import { GENDER, BRAND } from '../theme/colors';
import ChartCaption from './ChartCaption';

function BarTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="admin-chart-tooltip">
      {label != null ? <div className="ct-label">{label}</div> : null}
      <div className="ct-value">{Number(payload[0].value).toLocaleString()} producers</div>
    </div>
  );
}

function PieTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0];
  return (
    <div className="admin-chart-tooltip">
      <div className="ct-label">{p.name}</div>
      <div className="ct-value">{Number(p.value).toLocaleString()} producers</div>
    </div>
  );
}

export default function ProducerDemographicsSection() {
  const demographics = useMemo(() => getProducerDemographics(), []);
  const ageData = useMemo(
    () => Object.entries(demographics.ageGroups).map(([age, count]) => ({ age, count })),
    [demographics]
  );
  const genderData = useMemo(
    () =>
      Object.entries(demographics.genderDistribution).map(([gender, count]) => ({
        gender: gender === 'notSpecified' ? 'Not Specified' : gender.charAt(0).toUpperCase() + gender.slice(1),
        count,
      })),
    [demographics]
  );

  const topAge = ageData.length ? ageData.reduce((best, e) => (e.count > best.count ? e : best), ageData[0]) : null;

  const genderTotal = genderData.reduce((sum, g) => sum + g.count, 0);
  const maleEntry = genderData.find((g) => g.gender === 'Male');
  const femaleEntry = genderData.find((g) => g.gender === 'Female');
  let genderCaption = '';
  if (genderTotal > 0 && maleEntry) {
    const malePct = (maleEntry.count / genderTotal) * 100;
    genderCaption = maleEntry.count >= (femaleEntry ? femaleEntry.count : 0)
      ? `Male producers make up ${malePct.toFixed(1)}% of the ${genderTotal.toLocaleString()} recorded producers.`
      : `Female producers make up ${((femaleEntry.count / genderTotal) * 100).toFixed(1)}% of the ${genderTotal.toLocaleString()} recorded producers.`;
  } else {
    genderCaption = 'Gender is evenly represented among recorded producers.';
  }

  const genderColor = (name) => {
    const key = name === 'Male' ? 'male' : name === 'Female' ? 'female' : '';
    return key ? GENDER[key] : '#9E9E9E';
  };

  return (
    <section className="public-section">
      <Card className="encoder-card">
        <Card.Header>
          <div className="admin-card-head">
            <h5 className="admin-card-head-title">Producer Demographics</h5>
            <span className="fw-normal text-muted small ms-1">Province-wide aggregated demographic information from recorded salt producer data</span>
          </div>
        </Card.Header>
        <Card.Body>
          <Row className="g-4">
            <Col lg={6}>
              <h3 className="h6 fw-bold text-uppercase text-muted mb-3">Age Distribution</h3>
              {topAge && (
                <ChartCaption>
                  Producers aged {topAge.age} are the largest recorded age cohort at {topAge.count.toLocaleString()}.
                </ChartCaption>
              )}
              <div className="chart-container" style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ageData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <XAxis dataKey="age" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip cursor={{ fill: 'rgba(41, 176, 57, 0.08)' }} content={<BarTooltip />} />
                    <Bar dataKey="count" fill={BRAND.green} radius={[6, 6, 0, 0]} maxBarSize={46} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Col>
            <Col lg={6}>
              <h3 className="h6 fw-bold text-uppercase text-muted mb-3">Gender Distribution</h3>
              <ChartCaption>{genderCaption}</ChartCaption>
              <div className="chart-container" style={{ height: 300 }}>
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
                      {genderData.map((entry) => (
                        <Cell key={entry.gender} fill={genderColor(entry.gender)} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>
    </section>
  );
}