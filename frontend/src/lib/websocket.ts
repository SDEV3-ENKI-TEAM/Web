export class WebSocketManager {
  private ws: WebSocket | null = null;
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
    const token = localStorage.getItem("token");
    if (!token) {
      console.error("JWT 토큰이 없습니다. 로그인이 필요합니다.");
      return;
    }

    const wsUrl = `${this.url}?token=${encodeURIComponent(token)}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log("WebSocket 연결됨");
      this.reconnectAttempts = 0;
      if (this.onConnectCallback) {
        this.onConnectCallback();
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (this.onMessageCallback) {
          this.onMessageCallback(data);
        }
      } catch (error) {
        console.error("WebSocket 메시지 파싱 오류:", error);
      }
    };

    this.ws.onclose = (event) => {
      console.log("WebSocket 연결 해제:", event.code, event.reason);

      if (this.onDisconnectCallback) {
        this.onDisconnectCallback();
      }

      if (event.code === 4001 || event.code === 4002) {
        console.error("JWT 토큰 오류:", event.reason);
        return;
      }

      this.attemptReconnect();
    };

    this.ws.onerror = (error) => {
      console.error("WebSocket 오류:", error);
    };
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("최대 재연결 시도 횟수 초과");
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(
      `${delay}ms 후 재연결 시도 ${this.reconnectAttempts}/${this.maxReconnectAttempts}`
    );

    setTimeout(() => {
      this.connect();
    }, delay);
  }

  send(message: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(message);
    }
  }

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
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

export class AlarmWebSocketManager extends WebSocketManager {
  constructor() {
    super("ws://localhost:8004/ws/alarms");
  }

  onAlarmData(callback: (alarms: any[]) => void): void {
    this.onMessage((data) => {
      if (data.type === "initial_data" || data.type === "alarm_update") {
        callback(data.alarms || []);
      }
    });
  }

  onConnectionStatus(callback: (connected: boolean) => void): void {
    this.onConnect(() => callback(true));
    this.onDisconnect(() => callback(false));
  }
}

export const alarmWebSocket = new AlarmWebSocketManager();
