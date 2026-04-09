import pika
import json

def callback(ch, method, properties, body):
    data = json.loads(body)
    routing_key = method.routing_key
    
    if "anomalous" in routing_key or data['load_kw'] > 100:
        print(f"[WARNING] Anomaly Detected from {data['meter_id']}: {data['load_kw']} kW")
    else:
        print(f"[LOG] Normal read from {data['meter_id']}: {data['load_kw']} kW")

def start_listening():
    connection = pika.BlockingConnection(pika.ConnectionParameters('localhost'))
    channel = connection.channel()
    
    channel.exchange_declare(exchange='smart_grid', exchange_type='topic')
    
    # Create a temporary, exclusive queue for this consumer
    result = channel.queue_declare(queue='', exclusive=True)
    queue_name = result.method.queue
    
    # Bind the queue to listen to ALL telemetry data
    channel.queue_bind(exchange='smart_grid', queue=queue_name, routing_key='telemetry.#')
    
    print('[*] Waiting for grid telemetry. To exit press CTRL+C')
    
    channel.basic_consume(
        queue=queue_name,
        on_message_callback=callback,
        auto_ack=True
    )
    
    channel.start_consuming()

if __name__ == "__main__":
    try:
        start_listening()
    except KeyboardInterrupt:
        print("\n[*] Shutting down monitor.")
