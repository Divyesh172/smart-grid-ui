import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';

const ANOMALY_THRESHOLD = 100;
const METER_COLORS = ['#2563eb', '#16a34a', '#dc2626', '#d97706', '#7c3aed'];

const colorRegistry = {};
let colorIndex = 0;
function colorFor(id) {
  if (!colorRegistry[id]) {
    colorRegistry[id] = METER_COLORS[colorIndex++ % METER_COLORS.length];
  }
  return colorRegistry[id];
}

const styles = {
  root: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    padding: '16px 24px',
    fontFamily: '"DM Sans", system-ui, sans-serif',
    color: '#111',
    background: '#f9fafb',
    boxSizing: 'border-box',
    gap: 12,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    margin: 0,
    fontSize: 18,
    fontWeight: 600,
    letterSpacing: '-0.3px',
  },
  subtitle: {
    margin: '2px 0 0',
    fontSize: 13,
    color: '#6b7280',
  },
  badge: (isAttack) => ({
    fontSize: 12,
    fontWeight: 600,
    padding: '4px 12px',
    borderRadius: 6,
    background: isAttack ? '#fee2e2' : '#dcfce7',
    color: isAttack ? '#991b1b' : '#166534',
  }),
  banner: {
    background: '#fef2f2',
    border: '1px solid #fca5a5',
    borderRadius: 6,
    padding: '10px 14px',
    fontSize: 13,
    color: '#991b1b',
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 10,
  },
  statCard: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    padding: '12px 16px',
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  statValue: (color) => ({
    fontSize: 22,
    fontWeight: 700,
    color: color || '#111',
    margin: 0,
  }),
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 280px',
    gap: 12,
    flex: 1,
    minHeight: 0,
  },
  leftCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    minHeight: 0,
  },
  card: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    padding: '14px 16px',
  },
  cardTitle: {
    margin: '0 0 10px',
    fontSize: 13,
    fontWeight: 600,
    color: '#374151',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
  },
  th: {
    textAlign: 'left',
    padding: '5px 8px',
    fontSize: 12,
    color: '#6b7280',
    fontWeight: 500,
    borderBottom: '1px solid #e5e7eb',
  },
  td: {
    padding: '6px 8px',
    borderBottom: '1px solid #f3f4f6',
  },
  pill: (isAnomaly) => ({
    fontSize: 11,
    padding: '2px 8px',
    borderRadius: 4,
    fontWeight: 500,
    background: isAnomaly ? '#fee2e2' : '#dcfce7',
    color: isAnomaly ? '#991b1b' : '#166534',
  }),
  alertCard: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    overflow: 'hidden',
  },
  alertEntry: {
    borderBottom: '1px solid #f3f4f6',
    paddingBottom: 8,
    marginBottom: 8,
  },
  alertTime: {
    fontSize: 11,
    color: '#9ca3af',
    marginBottom: 2,
  },
  alertText: {
    fontSize: 13,
    color: '#991b1b',
  },
};

export default function App() {
  const [allData, setAllData] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [meters, setMeters] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [status, setStatus] = useState(null);
  const alertRef = useRef([]);

  const fetchData = useCallback(async () => {
    try {
      const [telRes, statRes] = await Promise.all([
        axios.get('/api/telemetry'),
        axios.get('/api/status'),
      ]);

      const raw = telRes.data;
      setAllData(raw);
      setStatus(statRes.data);

      const ids = [...new Set(raw.map((d) => d.meter_id))];
      setMeters(ids);

      const byTime = {};
      raw.forEach((d) => {
        if (!byTime[d.time]) byTime[d.time] = { time: d.time };
        byTime[d.time][d.meter_id] = d.load_kw;
      });
      setChartData(Object.values(byTime).slice(-60));

      const anomalies = raw.filter((d) => d.status === 'CRITICAL_ANOMALY');
      if (anomalies.length > 0) {
        const latest = anomalies[anomalies.length - 1];
        const prev = alertRef.current[0];
        if (!prev || prev.timestamp !== latest.timestamp) {
          const entry = {
            id: Date.now(),
            text: `${latest.meter_id} injected ${latest.load_kw} kW`,
            time: latest.time,
            timestamp: latest.timestamp,
          };
          alertRef.current = [entry, ...alertRef.current].slice(0, 10);
          setAlerts([...alertRef.current]);
        }
      }
    } catch (err) {
      console.error('Fetch error:', err);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 2000);
    return () => clearInterval(id);
  }, [fetchData]);

  const isUnderAttack = allData.some(
    (d) =>
      d.status === 'CRITICAL_ANOMALY' &&
      Date.now() - new Date(d.timestamp).getTime() < 10000
  );

  return (
    <div style={styles.root}>

      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Smart Grid Monitor</h1>
          <p style={styles.subtitle}>Live telemetry dashboard</p>
        </div>
        <span style={styles.badge(isUnderAttack)}>
          {isUnderAttack ? 'Under Attack' : 'Nominal'}
        </span>
      </div>

      {isUnderAttack && alerts[0] && (
        <div style={styles.banner}>
          <strong>Attack detected</strong> — {alerts[0].text}
        </div>
      )}

      {status && (
        <div style={styles.statsRow}>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>Total Readings</div>
            <div style={styles.statValue()}>
              {status.total_readings}
            </div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>Normal</div>
            <div style={styles.statValue('#15803d')}>
              {status.normal_count}
            </div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>Anomalies</div>
            <div style={styles.statValue('#dc2626')}>
              {status.anomaly_count}
            </div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>Status</div>
            <div style={styles.statValue(isUnderAttack ? '#dc2626' : '#15803d')}>
              {isUnderAttack ? 'Attack' : 'OK'}
            </div>
          </div>
        </div>
      )}

      <div style={styles.grid}>
        <div style={styles.leftCol}>

          <div style={{ ...styles.card, flex: 1, minHeight: 0 }}>
            <h2 style={styles.cardTitle}>Live Load (kW)</h2>
            {chartData.length === 0 ? (
              <div style={{ color: '#9ca3af', fontSize: 13, padding: '40px 0', textAlign: 'center' }}>
                Waiting for telemetry data
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="90%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="time" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11 }} domain={[0, 'auto']} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <ReferenceLine
                    y={ANOMALY_THRESHOLD}
                    stroke="#dc2626"
                    strokeDasharray="4 2"
                    label={{ value: 'Threshold', fill: '#dc2626', fontSize: 11 }}
                  />
                  {meters.map((id) => (
                    <Line
                      key={id}
                      type="monotone"
                      dataKey={id}
                      stroke={colorFor(id)}
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div style={styles.card}>
            <h2 style={styles.cardTitle}>Recent Readings</h2>
            <table style={styles.table}>
              <thead>
                <tr>
                  {['Time', 'Meter', 'Load (kW)', 'Status'].map((h) => (
                    <th key={h} style={styles.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...allData].reverse().slice(0, 8).map((row, i) => {
                  const isAnomaly = row.status === 'CRITICAL_ANOMALY';
                  return (
                    <tr
                      key={i}
                      style={{ background: isAnomaly ? '#fef2f2' : 'transparent' }}
                    >
                      <td style={{ ...styles.td, color: '#6b7280' }}>{row.time}</td>
                      <td style={styles.td}>{row.meter_id}</td>
                      <td style={{
                        ...styles.td,
                        fontWeight: 600,
                        color: row.load_kw > ANOMALY_THRESHOLD ? '#dc2626' : '#15803d',
                      }}>
                        {row.load_kw}
                      </td>
                      <td style={styles.td}>
                        <span style={styles.pill(isAnomaly)}>
                          {isAnomaly ? 'Anomaly' : 'OK'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

        </div>

        <div style={styles.alertCard}>
          <h2 style={styles.cardTitle}>Alert Log</h2>
          {alerts.length === 0 ? (
            <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>
              No alerts. System is normal.
            </p>
          ) : (
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {alerts.map((a) => (
                <div key={a.id} style={styles.alertEntry}>
                  <div style={styles.alertTime}>{a.time}</div>
                  <div style={styles.alertText}>{a.text}</div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}