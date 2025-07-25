#!/usr/bin/env python3
from opensearch_analyzer import OpenSearchAnalyzer

def main():
    print("=== Trace ID 알럿 디버깅 ===")
    
    analyzer = OpenSearchAnalyzer()
    trace_id = "b21aaad4dec67b9a9e849ff9a0fee737"
    
    print(f"\n🔍 Trace ID {trace_id} 검색:")
    
    # 해당 trace_id의 모든 스팬 가져오기
    events = analyzer.get_process_tree_events(trace_id)
    
    print(f"\n📊 총 {len(events)}개 이벤트 발견")
    
    # 알럿 정보 분석
    alert_events = []
    for i, event in enumerate(events):
        print(f"\n--- 이벤트 {i+1} ---")
        print(f"  - process_name: {event.get('process_name', 'N/A')}")
        print(f"  - event_type: {event.get('event_type', 'N/A')}")
        print(f"  - has_alert: {event.get('has_alert', False)}")
        print(f"  - alert_message: {event.get('alert_message', 'N/A')}")
        print(f"  - sysmon_event_id: {event.get('sysmon_event_id', 'N/A')}")
        
        if event.get('has_alert'):
            alert_events.append(event)
    
    print(f"\n🚨 알럿이 있는 이벤트: {len(alert_events)}개")
    
    # 고유한 알럿 메시지 수집
    unique_alerts = set()
    for event in alert_events:
        if event.get('alert_message'):
            unique_alerts.add(event['alert_message'])
    
    print(f"📋 고유한 알럿 메시지: {len(unique_alerts)}개")
    for alert in unique_alerts:
        print(f"  - {alert}")
    
    # 프론트엔드에서 표시될 정보
    print(f"\n📱 프론트엔드 표시 정보:")
    print(f"  - 총 이벤트 수: {len(events)}개")
    print(f"  - 알럿이 있는 이벤트: {len(alert_events)}개")
    print(f"  - 고유한 탐지 규칙: {len(unique_alerts)}개")

if __name__ == "__main__":
    main() 