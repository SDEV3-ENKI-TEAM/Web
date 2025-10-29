"use strict";

export class SSEManager {
  private es: EventSource | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private url: string;
  private onMessageCallback: ((data: any) => void) | null = null;
  private onConnectCallback: (() => void) | null = null;
  private onDisconnectCallback: (() => void) | null = null;

  constructor(url: string) {
    this.url = url;
  }

  connect(): void {
    const token =
      typeof window !== "undefined" ? sessionStorage.getItem("token") : null;
    if (!token) {
      // console.error("JWT 토큰이 없습니다. 로그인이 필요합니다.");
      return;
    }

    const sseUrl = `${this.url}?token=${encodeURIComponent(token)}`;

    try {
      this.es = new EventSource(sseUrl);
    } catch (e) {
      // console.error("SSE 연결 생성 실패:", e);
      this.attemptReconnect();
      return;
    }

    this.es.onopen = () => {
      // console.log("SSE 연결됨");
      this.reconnectAttempts = 0;
      if (this.onConnectCallback) {
        this.onConnectCallback();
      }
    };

    this.es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (this.onMessageCallback) {
          this.onMessageCallback(data);
        }
      } catch (error) {
        // console.error("SSE 메시지 파싱 오류:", error);
      }
    };

    this.es.onerror = (event: any) => {
      // console.warn("SSE 오류/연결 해제 감지:", event);
      if (this.onDisconnectCallback) {
        this.onDisconnectCallback();
      }
      try {
        this.es?.close();
      } catch (closeError) {
        // console.warn(
          "Failed to close SSE connection during error handling:",
          closeError
        );
        // SSE close failure during error handling is not critical
      }
      this.attemptReconnect();
    };
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      // console.error("최대 재연결 시도 횟수 초과");
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    // console.log(
      `${delay}ms 후 재연결 시도 ${this.reconnectAttempts}/${this.maxReconnectAttempts}`
    );

    setTimeout(() => {
      this.connect();
    }, delay);
  }

  send(_message: string): void {}

  onMessage(callback: (data: any) => void): void {
    this.onMessageCallback = callback;
  }

  onConnect(callback: () => void): void {
    this.onConnectCallback = callback;
  }

  onDisconnect(callback: () => void): void {
    this.onDisconnectCallback = callback;
  }

  isConnected(): boolean {
    return this.es !== null;
  }
}

export class AlarmSSEManager extends SSEManager {
  constructor() {
    super("http://localhost:8004/sse/alarms");
  }

  onAlarmData(callback: (alarms: any[]) => void): void {
    this.onMessage((data) => {
      if (data.type === "initial_data") {
        callback(data.alarms || []);
        return;
      }
      if (
        data.type === "alarm_update" ||
        data.type === "new_trace" ||
        data.type === "trace_update"
      ) {
        if (Array.isArray(data.alarms)) {
          callback(data.alarms);
        } else if (Array.isArray(data.data)) {
          callback(data.data);
        } else if (data.data) {
          callback([data.data]);
        }
      }
    });
  }

  onConnectionStatus(callback: (connected: boolean) => void): void {
    this.onConnect(() => callback(true));
    this.onDisconnect(() => callback(false));
  }
}

export const alarmSSE = new AlarmSSEManager();
