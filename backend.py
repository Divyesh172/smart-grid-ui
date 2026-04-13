"""
Smart Grid Backend — FastAPI + RabbitMQ bridge
Run with: uvicorn backend:app --reload --port 8000
"""

import json
import threading
from collections import deque
from datetime import datetime

import pika
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rolling buffer — keeps last 100 readings per meter
ANOMALY_THRESHOLD = 100.0
telemetry_buffer: deque = deque(maxlen=200)


def process_message(ch, method, properties, body):
    data = json.loads(body)
    routing_key = method.routing_key

    is_anomaly = "anomalous" in routing_key or data["load_kw"] > ANOMALY_THRESHOLD

    record = {
        "meter_id": data["meter_id"],
        "load_kw": data["load_kw"],
        "timestamp": data.get("timestamp", datetime.utcnow().isoformat() + "Z"),
        "type": data.get("type", "residential"),
        # time field for the X-axis in recharts
        "time": datetime.utcnow().strftime("%H:%M:%S"),
        "status": "CRITICAL_ANOMALY" if is_anomaly else "OK",
        "routing_key": routing_key,
    }

    telemetry_buffer.append(record)

    tag = "ANOMALY" if is_anomaly else "✅ normal"
    print(f"[{tag}] {data['meter_id']} → {data['load_kw']} kW")


def rabbitmq_listener():
    """Runs in a background thread, feeding data into telemetry_buffer."""
    while True:
        try:
            connection = pika.BlockingConnection(
                pika.ConnectionParameters("localhost")
            )
            channel = connection.channel()
            channel.exchange_declare(exchange="smart_grid", exchange_type="topic")

            result = channel.queue_declare(queue="", exclusive=True)
            queue_name = result.method.queue

            # Subscribe to ALL telemetry (normal + anomalous)
            channel.queue_bind(
                exchange="smart_grid",
                queue=queue_name,
                routing_key="telemetry.#",
            )

            print("[*] RabbitMQ listener connected. Waiting for messages…")
            channel.basic_consume(
                queue=queue_name,
                on_message_callback=process_message,
                auto_ack=True,
            )
            channel.start_consuming()

        except pika.exceptions.AMQPConnectionError:
            print("[!] RabbitMQ not reachable — retrying in 3 s…")
            import time; time.sleep(3)
        except Exception as e:
            print(f"[!] Listener error: {e} — restarting…")
            import time; time.sleep(2)


# Start the RabbitMQ consumer in a daemon thread on startup
@app.on_event("startup")
def startup_event():
    t = threading.Thread(target=rabbitmq_listener, daemon=True)
    t.start()


@app.get("/api/telemetry")
def get_telemetry():
    """
    Returns the last N readings, newest-last (so recharts draws left→right).
    """
    return list(telemetry_buffer)


@app.get("/api/telemetry/{meter_id}")
def get_meter_telemetry(meter_id: str):
    """Filter telemetry for a specific meter."""
    return [r for r in telemetry_buffer if r["meter_id"] == meter_id]


@app.get("/api/status")
def get_status():
    total = len(telemetry_buffer)
    anomalies = sum(1 for r in telemetry_buffer if r["status"] == "CRITICAL_ANOMALY")
    return {
        "total_readings": total,
        "anomaly_count": anomalies,
        "normal_count": total - anomalies,
        "buffer_size": telemetry_buffer.maxlen,
    }