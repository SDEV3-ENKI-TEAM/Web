"use client";

import React, { useCallback, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  Position,
  useNodesState,
  useEdgesState,
  MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";

interface TraceData {
  trace_id: string;
  host: {
    hostname: string;
    ip: string;
    os: string;
  };
  label: string;
  sequence: string[];
  sigma_match: string;
  prompt_input: string;
}

interface TraceFlowChartProps {
  nodes: any[];
  edges: any[];
  onNodeClick?: (event: any, node: any) => void;
}

const nodeStyle = {
  borderRadius: 12,
  border: "2px solid #4a5568",
  background: "#e2e8f0",
  color: "#2d3748",
  padding: 16,
  fontWeight: 500,
  minWidth: 180,
  boxShadow: "0 2px 8px 0 rgba(74,85,104,0.08)",
};

const selectedNodeStyle = {
  ...nodeStyle,
  border: "2.5px solid #6366f1",
  background: "#f1f5f9",
};

const edgeStyle = {
  stroke: "#6366f1",
  strokeWidth: 2,
};

const TraceFlowChart: React.FC<TraceFlowChartProps> = ({
  nodes,
  edges,
  onNodeClick,
}) => {
  return (
    <div className="w-full h-full relative bg-transparent p-0 m-0">
      <div className="w-full h-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          className="bg-transparent w-full h-full"
          style={{ width: "100%", height: "100%" }}
          onNodeClick={onNodeClick}
        />
      </div>
    </div>
  );
};

export default TraceFlowChart;
