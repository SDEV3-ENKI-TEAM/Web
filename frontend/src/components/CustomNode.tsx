import React, { memo } from "react";
import { Handle, Position } from "reactflow";

interface CustomNodeProps {
  data: {
    idx: number;
    processName: string;
    eventKor: string;
    hasAlert: boolean;
    totalNodes: number;
    event: any;
    explanation: string;
    sourcePosition: any;
    targetPosition: any;
  };
}

const CustomNode = memo(({ data }: CustomNodeProps) => {
  const {
    idx,
    processName,
    eventKor,
    hasAlert,
    totalNodes,
    sourcePosition,
    targetPosition,
  } = data;
  return (
    <div
      style={{
        textAlign: "center",
        fontSize: totalNodes > 12 ? "12px" : "13px",
        lineHeight: "1.2",
        color: hasAlert ? "#ef4444" : "#e2e8f0",
        fontWeight: hasAlert ? "bold" : "normal",
        minWidth: totalNodes > 12 ? "200px" : "250px",
        minHeight: totalNodes > 12 ? "70px" : "80px",
        padding: totalNodes > 12 ? "10px" : "12px",
        borderRadius: "8px",
        background: hasAlert
          ? "rgba(239, 68, 68, 0.1)"
          : "rgba(15, 23, 42, 0.8)",
        border: hasAlert
          ? "2px solid rgba(239, 68, 68, 0.8)"
          : "1px solid rgba(59, 130, 246, 0.5)",
        boxShadow: hasAlert
          ? "0 4px 8px rgba(239, 68, 68, 0.2)"
          : "0 2px 4px rgba(0, 0, 0, 0.1)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Handle type="target" position={targetPosition} />
      <Handle type="source" position={sourcePosition} />
      <div>
        {idx + 1}. {processName}
      </div>
      {eventKor && (
        <div style={{ fontSize: "11px", opacity: 0.8 }}>({eventKor})</div>
      )}
    </div>
  );
});

export default CustomNode;
