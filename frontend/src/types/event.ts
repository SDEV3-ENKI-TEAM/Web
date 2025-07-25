export interface Event {
  id: number;
  timestamp: string;
  user: string;
  anomaly: number;
  label: "Normal" | "Anomaly";
  event: string;
}

export interface EventDetail {
  id: number;
  date: string;
  anomalyScore: number;
  incident: string;
  rowData: {
    ip_address: string;
    user: string;
    number: string;
    location: string;
    [key: string]: string;
  };
}

export interface Stats {
  totalEvents: number;
  anomalies: number;
  avgAnomaly: number;
  highestScore: number;
}
