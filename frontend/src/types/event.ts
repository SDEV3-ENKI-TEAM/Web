export interface Event {
  id: number;
  timestamp: string;
  user: string;
  label: "Normal" | "Anomaly";
  event: string;
  host?: string;
  os?: string;
  duration?: number;
  traceID?: string;
  operationName?: string;
}

export interface EventDetail {
  id: number;
  date: string;
  incident: string;
  rowData?: {
    ip_address: string;
    user: string;
    number: string;
    location: string;
    [key: string]: string;
  };
  timestamp?: string;
  user?: string;
  host?: string;
  os?: string;
  event?: string;
  label?: string;
  duration?: number;
  details?: {
    process_id: string;
    parent_process_id: string;
    command_line: string;
    image_path: string;
    sigma_rule: string;
    error_details: string;
  };
}

export interface Stats {
  totalEvents: number;
  anomalies: number;
  avgAnomaly: number;
  highestScore: number;
}
