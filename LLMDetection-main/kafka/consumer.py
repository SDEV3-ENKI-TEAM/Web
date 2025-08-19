from kafka import KafkaConsumer
import json

# LangGraph 결과 토픽 구독
consumer = KafkaConsumer(
    'ai-result-topic',
    bootstrap_servers='localhost:9092',
)

print("=== LangGraph Result Consumer Started ===")

for message in consumer:
    data = message.value.decode("utf-8")
    print(data)
