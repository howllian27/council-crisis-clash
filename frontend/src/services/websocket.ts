import { useEffect, useRef, useCallback } from "react";

type WebSocketMessage = {
  type: string;
  payload: any;
};

type WebSocketCallbacks = {
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
};

export class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout = 1000;

  constructor(
    private url: string,
    private sessionId: string,
    private callbacks: WebSocketCallbacks = {}
  ) {}

  connect() {
    try {
      this.ws = new WebSocket(`${this.url}/ws/game/${this.sessionId}`);

      this.ws.onopen = () => {
        console.log("WebSocket connected");
        this.reconnectAttempts = 0;
        this.callbacks.onConnect?.();
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.callbacks.onMessage?.(message);
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };

      this.ws.onclose = () => {
        console.log("WebSocket disconnected");
        this.callbacks.onDisconnect?.();
        this.reconnect();
      };

      this.ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        this.callbacks.onError?.(error);
      };
    } catch (error) {
      console.error("Error creating WebSocket connection:", error);
      this.reconnect();
    }
  }

  private reconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(
        `Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`
      );
      setTimeout(
        () => this.connect(),
        this.reconnectTimeout * this.reconnectAttempts
      );
    } else {
      console.error("Max reconnection attempts reached");
    }
  }

  send(message: WebSocketMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.error("WebSocket is not connected");
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export function useWebSocket(
  url: string,
  sessionId: string,
  callbacks: WebSocketCallbacks = {}
) {
  const wsRef = useRef<WebSocketService | null>(null);

  useEffect(() => {
    wsRef.current = new WebSocketService(url, sessionId, callbacks);
    wsRef.current.connect();

    return () => {
      wsRef.current?.disconnect();
    };
  }, [url, sessionId]);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    wsRef.current?.send(message);
  }, []);

  return { sendMessage };
}
