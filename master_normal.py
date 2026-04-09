import pika
import json
import time
import random
from datetime import datetime

def start_meter(meter_id, base_load):
    connection = pika.BlockingConnection(pika.ConnectionParameters('localhost'))
    channel = connection.channel()
    
    # Using a topic exchange to route different types of telemetry
    channel.exchange_declare(exchange='smart_grid', exchange_type='topic')
    
    print(f"[*] Starting normal telemetry for {meter_id}. Press CTRL+C to exit.")
    
    try:
        while True:
            # Simulate normal load fluctuations
            current_load = round(base_load + random.uniform(-0.5, 1.5), 2)
            
            payload = {
                "meter_id": meter_id,
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "load_kw": current_load,
                "type": "residential",
                "status": "OK"
            }
            
            channel.basic_publish(
                exchange='smart_grid',
                routing_key='telemetry.normal',
                body=json.dumps(payload)
            )
            print(f"[+] Sent: {payload['load_kw']} kW")
            time.sleep(1)
            
    except KeyboardInterrupt:
        print("\n[*] Stopping meter.")
        connection.close()

if __name__ == "__main__":
    start_meter(meter_id="RES_METER_001", base_load=3.0)
