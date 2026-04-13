# Smart Grid Monitor

A real-time dashboard for detecting false data injection attacks on smart grid meters. It connects a React frontend to a Python backend that listens for live telemetry published over RabbitMQ.

---

## What it does

Normal meters continuously publish their electricity load readings (in kilowatts) to a message broker. An attacker can spoof a meter and inject extremely high load values to deceive the grid. This system monitors all incoming readings, flags anything above a threshold as an anomaly, and displays everything live on a dashboard.

---

## How it works

```
meter_normal.py  ─┐
                   ├──> RabbitMQ (smart_grid exchange) ──> backend.py ──> React frontend
meter_attack.py  ─┘
```

1. Meters publish readings to a RabbitMQ topic exchange called `smart_grid`.
2. The FastAPI backend subscribes to all `telemetry.#` messages and stores the last 200 readings in memory.
3. Readings above 100 kW are marked `CRITICAL_ANOMALY`, regardless of what the publisher reports in its own `status` field.
4. The React frontend polls `/api/telemetry` and `/api/status` every 2 seconds and renders the data as a live chart, a readings table, and an alert log.

---

## Project structure

```
backend.py         FastAPI server + RabbitMQ listener
grid_monitor.py    Standalone CLI monitor (logs to terminal only)
master_normal.py   Simulates a normal residential meter
meter_attack.py    Simulates a false data injection attack
App.jsx            React dashboard (Recharts, Axios)
```

---

## Prerequisites

- Python 3.9+
- Node.js 18+
- RabbitMQ running locally on the default port (5672)

Install RabbitMQ on macOS:

```bash
brew install rabbitmq
brew services start rabbitmq
```

On Ubuntu/Debian:

```bash
sudo apt install rabbitmq-server
sudo systemctl start rabbitmq-server
```

---

## Setup

### Backend

```bash
pip install fastapi uvicorn pika
uvicorn backend:app --reload --port 8000
```

### Frontend

The frontend expects an existing React project with Recharts and Axios installed.

```bash
npm install recharts axios
```

Copy `App.jsx` into your `src/` directory, then start the dev server:

```bash
npm run dev
```

The Vite dev server runs on `http://localhost:5173` by default, which is already allowed in the backend CORS config.

---

## Running a simulation

Open three separate terminals.

**Terminal 1 — start the backend:**
```bash
uvicorn backend:app --reload --port 8000
```

**Terminal 2 — start a normal meter:**
```bash
python master_normal.py
```

This publishes a reading around 3 kW every second using the routing key `telemetry.normal`.

**Terminal 3 — trigger an attack:**
```bash
python meter_attack.py
```

This floods the broker with readings between 500–999 kW every 200ms using the routing key `telemetry.anomalous`, spoofing the same meter ID as the normal script (`RES_METER_001`).

The dashboard will immediately show the attack banner, highlight anomalous rows in red, and log alerts on the right panel.

---

## API endpoints

| Endpoint | Description |
|---|---|
| `GET /api/telemetry` | Returns all readings in the buffer (up to 200), oldest first |
| `GET /api/telemetry/{meter_id}` | Returns readings filtered to a specific meter |
| `GET /api/status` | Returns total, normal, and anomaly counts |

---

## Detection logic

The backend ignores the `status` field sent by the publisher. It applies its own check:

```python
is_anomaly = "anomalous" in routing_key or data["load_kw"] > 100.0
```

This means an attacker cannot evade detection simply by setting `"status": "OK"` in the payload, as the attack script attempts to do.

---

## Configuration

| Setting | Location | Default |
|---|---|---|
| Anomaly threshold | `backend.py` → `ANOMALY_THRESHOLD` | `100.0` kW |
| Buffer size | `backend.py` → `deque(maxlen=200)` | 200 readings |
| Poll interval | `App.jsx` → `setInterval` | 2000 ms |
| Readings shown in table | `App.jsx` → `.slice(0, 8)` | 8 rows |
| Chart window | `App.jsx` → `.slice(-60)` | Last 60 time points |
| Attack alert retention | `App.jsx` → `alertRef` | Last 10 alerts |

---

## Notes

- The RabbitMQ listener in `backend.py` automatically reconnects if the broker goes down.
- `grid_monitor.py` is a lightweight alternative that only prints to the terminal. It does not feed the web dashboard.
- The frontend uses module-level state (`colorRegistry`) for consistent meter colors across re-renders. If you hot-reload the page, color assignments reset.
- All anomaly detection happens server-side. The frontend only displays what the backend marks.
