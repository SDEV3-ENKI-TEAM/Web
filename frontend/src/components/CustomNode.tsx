import React, { memo } from "react";
import { Handle, Position } from "reactflow";

interface CustomNodeProps {
  data: {
    idx: number;
    processName: string;
    eventKor: string;
    hasAlert: boolean;
    totalNodes: number;
    event: any; // 원본 event 객체
    explanation: string; // explanation
    sourcePosition: any; // source handle 위치
    targetPosition: any; // target handle 위치
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

  const isMaliciousFile = (name: string) => {
    const maliciousExtensions = [
      ".pif",
      ".scr",
      ".bat",
      ".cmd",
      ".com",
      ".vbs",
      ".js",
      ".jar",
      ".ps1",
    ];
    return maliciousExtensions.some((ext) =>
      name.toLowerCase().includes(ext.toLowerCase())
    );
  };

  const isMalicious = hasAlert || isMaliciousFile(processName);

  return (
    <div
      style={{
        textAlign: "center",
        fontSize: totalNodes > 12 ? "12px" : "13px",
        lineHeight: "1.2",
        color: isMalicious ? "#ef4444" : "#e2e8f0",
        fontWeight: isMalicious ? "bold" : "normal",
        minWidth: totalNodes > 12 ? "200px" : "250px",
        minHeight: totalNodes > 12 ? "70px" : "80px",
        padding: totalNodes > 12 ? "10px" : "12px",
        borderRadius: "8px",
        background: isMalicious
          ? "rgba(239, 68, 68, 0.1)"
          : "rgba(15, 23, 42, 0.8)",
        border: isMalicious
          ? "2px solid rgba(239, 68, 68, 0.8)"
          : "1px solid rgba(59, 130, 246, 0.5)",
        boxShadow: isMalicious
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
      <div style={{ fontSize: "11px", opacity: 0.8 }}>({eventKor})</div>
    </div>
  );
});

export default CustomNode;
