import { useState, useEffect } from 'react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

function App() {
  const [data, setData] = useState([]);
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Ensure this matches your FastAPI port
        const response = await axios.get('http://localhost:8000/api/telemetry'); 
        setData(response.data);

        // Scan for the False Data Injection Attack
        const anomaly = response.data.find(d => d.status === "CRITICAL_ANOMALY");
        if (anomaly) {
          setAlert(`CYBERATTACK DETECTED: Node ${anomaly.meter_id} injecting massive load (${anomaly.load_kw}kW)`);
        } else {
          setAlert(null);
        }
      } catch (error) {
        console.error("Error fetching telemetry:", error);
      }
    };

    // Poll every 2 seconds
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace', backgroundColor: '#1e1e1e', color: '#fff', minHeight: '100vh' }}>
      <h1>Smart Grid Command Center</h1>
      
      {/* Alert Banner */}
      {alert && (
        <div style={{ backgroundColor: '#ff4444', color: 'white', padding: '15px', margin: '20px 0', fontWeight: 'bold', border: '2px solid red' }}>
          ⚠️ {alert} ⚠️
        </div>
      )}

      {/* Telemetry Chart */}
      <div style={{ height: '500px', backgroundColor: '#2d2d2d', padding: '20px', borderRadius: '8px' }}>
        <h3>Live Grid Load (kW)</h3>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#444" />
            <XAxis dataKey="time" stroke="#888" />
            <YAxis stroke="#888" domain={['auto', 'auto']} />
            <Tooltip contentStyle={{ backgroundColor: '#333', border: 'none' }} />
            <Legend />
            {/* This maps all incoming meter IDs. 
              In a real scenario, you'd dynamically generate these Lines based on unique meter_ids.
            */}
            <Line type="monotone" dataKey="load_kw" stroke="#00ff00" strokeWidth={2} dot={true} isAnimationActive={false} connetNulls={true} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default App;
