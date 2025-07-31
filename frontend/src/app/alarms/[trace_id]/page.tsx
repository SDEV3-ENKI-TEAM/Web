"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DashboardLayout from "@/components/DashboardLayout";
import ReactFlow, {
  useNodesState,
  useEdgesState,
  MarkerType,
  useReactFlow,
  ReactFlowProvider,
  Position,
} from "reactflow";
import "reactflow/dist/style.css";
import { useParams } from "next/navigation";
import CustomNode from "@/components/CustomNode";

interface Trace {
  trace_id: string;
  timestamp: string;
  host: string;
  os: string;
  label: string;
  events: any[];
  sigma_match: string[];
  prompt_input: string;
}

const eventTypeExplanations: { [key: string]: string } = {
  process_creation: "프로그램 실행 - 새로운 프로그램이 시작되었습니다",
  processcreate: "프로그램 실행 - 새로운 프로그램이 시작되었습니다",
  processterminated: "프로세스 종료 - 실행 중인 프로그램이 종료되었습니다",
  network_connection: "네트워크 연결 - 인터넷이나 다른 컴퓨터와 통신합니다",
  file_access: "파일 접근 - 파일을 읽거나 수정하려고 합니다",
  registry_modification: "시스템 설정 변경 - 윈도우 시스템 설정을 수정합니다",
  privilege_escalation: "권한 상승 - 더 높은 권한을 얻으려고 시도합니다",
  data_exfiltration: "데이터 유출 - 중요한 정보를 외부로 전송합니다",
};

const NODES_PER_COLUMN = 5;

const getNodeStyle = (hasAlert: boolean, totalNodes: number) => ({
  background: hasAlert ? "rgba(239, 68, 68, 0.1)" : "rgba(15, 23, 42, 0.8)",
  border: hasAlert
    ? "2px solid rgba(239, 68, 68, 0.8)"
    : "1px solid rgba(59, 130, 246, 0.5)",
  borderRadius: "8px",
  color: "#e2e8f0",
  fontFamily: "ui-monospace, SFMono-Regular, monospace",
  fontSize: totalNodes > 12 ? "12px" : "14px",
  backdropFilter: "blur(8px)",
  padding: totalNodes > 12 ? "10px" : "12px",
  minWidth: totalNodes > 12 ? "200px" : "250px",
  minHeight: totalNodes > 12 ? "70px" : "80px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center" as const,
  boxShadow: hasAlert
    ? "0 4px 8px rgba(239, 68, 68, 0.2)"
    : "0 2px 4px rgba(0, 0, 0, 0.1)",
});

const getDisplayLabelStyle = (hasAlert: boolean, totalNodes: number) => ({
  textAlign: "center" as const,
  fontSize: totalNodes > 12 ? "12px" : "13px",
  lineHeight: "1.2",
  color: hasAlert ? "#ef4444" : "#e2e8f0",
  fontWeight: hasAlert ? "bold" : "normal",
});

const getEdgeStyle = (hasAlert: boolean) => ({
  stroke: hasAlert ? "#ef4444" : "#3b82f6",
  strokeWidth: hasAlert ? 3 : 2,
  strokeDasharray: hasAlert ? "4,4" : "none",
});

const getMarkerEnd = (hasAlert: boolean) => ({
  type: MarkerType.ArrowClosed,
  color: hasAlert ? "#ef4444" : "#3b82f6",
  width: 20,
  height: 20,
});
function getNodeLayout(idx: number, totalNodes: number) {
  const colIndex = Math.floor(idx / NODES_PER_COLUMN);
  const rowIndex = idx % NODES_PER_COLUMN;
  const x = colIndex * 350;
  const y = rowIndex * 120;
  const isLastInColumn = rowIndex === NODES_PER_COLUMN - 1;
  const isLastNode = idx === totalNodes - 1;
  return {
    x,
    y,
    sourcePosition:
      isLastInColumn && !isLastNode ? Position.Right : Position.Bottom,
    targetPosition: rowIndex === 0 && idx !== 0 ? Position.Left : Position.Top,
  };
}

function getProcessDisplayName(event: any): string {
  const tag = event.tag || {};
  if (
    tag.ProcessName &&
    tag.ProcessName !== "unknown" &&
    tag.ProcessName.trim() !== ""
  ) {
    return tag.ProcessName;
  }
  if (tag.Image) return tag.Image;
  if (tag.EventName) return tag.EventName.split("(")[0];
  if (tag.TaskName) return tag.TaskName.split("(")[0];
  return "알 수 없는 활동";
}

const ruleNameKorean: { [key: string]: string } = {
  ProcessTerminate: "프로세스 종료",
  ProcessCreate: "프로세스 생성",
  NetworkConnection: "네트워크 연결",
  FileCreate: "파일 생성",
  FileDelete: "파일 삭제",
  RegistrySet: "레지스트리 설정",
  RegistryDelete: "레지스트리 삭제",
  ServiceCreate: "서비스 생성",
  ServiceDelete: "서비스 삭제",
  DriverLoad: "드라이버 로드",
  ImageLoad: "이미지 로드",
  ClipboardChange: "클립보드 변경",
  DNSQuery: "DNS 쿼리",
  WmiEventFilter: "WMI 이벤트 필터",
  WmiEventConsumer: "WMI 이벤트 컨슈머",
  WmiConsumerFilter: "WMI 컨슈머 필터",
  FileAccess: "파일 접근",
  ProcessAccess: "프로세스 접근",
  ThreadCreate: "스레드 생성",
  PipeEvent: "파이프 이벤트",
  FileStreamCreated: "파일 스트림 생성",
  RegistryEvent: "레지스트리 이벤트",
  RegistryValueSet: "레지스트리 값 설정",
  RegistryKeyRename: "레지스트리 키 이름변경",
  FileDeleteDetected: "파일 삭제 탐지",
  ProcessTampering: "프로세스 변조",
};

function AlarmDetailContent() {
  const { trace_id } = useParams();
  const [trace, setTrace] = useState<Trace | null>(null);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"report" | "response">("report");
  const [showRaw, setShowRaw] = useState(false);

  const handleTabChange = useCallback((tab: "report" | "response") => {
    setActiveTab(tab);
  }, []);
  const reactFlowInstance = useRef<any>(null);

  const onNodeClick = useCallback((_: any, node: any) => {
    setSelectedNode(node);
  }, []);

  const handleLogout = useCallback(() => {}, []);

  const onLoad = useCallback((inst: any) => {
    reactFlowInstance.current = inst;
    setTimeout(() => {
      inst.fitView({ padding: 0.1, includeHiddenNodes: false });
    }, 100);
  }, []);

  const onCloseModal = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const nodeDetail = useMemo(() => {
    if (!selectedNode || !trace) return null;
    const event = selectedNode.data?.event;
    if (!event) return null;
    const tag = event.tag || {};
    return {
      event: event,
      index: Number(selectedNode.id),
      host:
        typeof trace.host === "object"
          ? JSON.stringify(trace.host)
          : trace.host,
      os: typeof trace.os === "object" ? JSON.stringify(trace.os) : trace.os,
      sigma: tag["sigma@alert"] ? [tag["sigma@alert"]] : [],
      explanation: selectedNode.data.explanation,
    };
  }, [selectedNode, trace]);

  const generateLLMAnalysis = useCallback((trace: Trace) => {
    const alertEvents = trace.events.filter((event) => {
      const tag = event.tag || {};
      return !!tag["sigma@alert"] || tag.error === true || tag.error === "true";
    });
    const hasAlerts = alertEvents.length > 0;
    return {
      riskLevel: hasAlerts ? "높음" : "낮음",
      affectedSystems: [
        typeof trace.host === "object"
          ? JSON.stringify(trace.host)
          : trace.host,
      ],
      attackVector:
        trace.events.length > 0 ? trace.events[0].event_type : "알 수 없음",
      totalSteps: trace.events.length,
      criticalEvents: alertEvents.length,
      recommendation: hasAlerts
        ? "즉시 보안팀에 신고하고 해당 시스템을 점검하세요"
        : "현재 안전한 상태이지만 지속적인 모니터링을 권장합니다",
      summary: trace.prompt_input || "분석 중...",
    };
  }, []);
  const currentAnalysis = useMemo(() => {
    if (!trace) return null;
    return generateLLMAnalysis(trace);
  }, [trace, generateLLMAnalysis]);

  const memoizedDefaultViewport = useMemo(
    () => ({
      x: 0,
      y: 0,
      zoom: 0.7,
    }),
    []
  );

  useEffect(() => {
    const fetchTrace = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/traces/search/${trace_id}`);
        const data = await res.json();
        setTrace(data.data || null);
      } catch (error) {
        console.error("Trace fetch failed:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTrace();
  }, [trace_id]);

  const memoizedNodesAndEdges = useMemo(() => {
    if (!trace || !trace.events) {
      return { nodes: [], edges: [] };
    }

    const filteredEvents = trace.events.filter(
      (event: any, index: number, arr: any[]) => {
        const source = event._source || event;
        const tag = source.tag || {};

        const eventId = tag.ID;
        const isSysmonId = eventId && eventId >= 1 && eventId <= 26;

        let eventType = "";
        if (tag.EventName) {
          eventType = tag.EventName.split("(")[0]
            .trim()
            .toLowerCase()
            .replace(/ /g, "_");
        }

        const isValidEvent =
          isSysmonId ||
          eventType.includes("process") ||
          eventType.includes("file") ||
          eventType.includes("network") ||
          eventType.includes("registry") ||
          eventType.includes("driver");

        if (!isValidEvent) return false;

        const duplicateIndex = arr.findIndex(
          (e: any) => JSON.stringify(e) === JSON.stringify(event)
        );
        return duplicateIndex === index;
      }
    );

    const totalNodes = filteredEvents.length;

    const newNodes = filteredEvents.map((event: any, idx: number) => {
      const source = event._source || event;
      const tag = source.tag || {};

      let eventType = "";
      if (tag.EventName) {
        eventType = tag.EventName.split("(")[0]
          .replace(/[^a-zA-Z]/g, "")
          .toLowerCase();
      } else {
        eventType = "unknownevent";
      }

      let processName =
        tag.ProcessName || tag.Image || tag.EventName || "알 수 없는 활동";
      if (typeof processName === "string" && processName.includes(".exe")) {
        const match = processName.match(/([^\\/]+\.exe)/i);
        if (match) processName = match[1];
      }

      const eventId = tag.ID;
      const op = event.operationName || "";
      let eventKor = "";

      const newFormatMatch = op.match(/\(rule:([^)]+)\)/);
      if (newFormatMatch) {
        const ruleName = newFormatMatch[1];
        eventKor = ruleNameKorean[ruleName] || ruleName;
      } else {
        eventKor = tag.EventName || "알 수 없는 이벤트";
      }
      const explanation = eventTypeExplanations[eventType] || eventType;
      const hasAlert =
        !!tag["sigma@alert"] || tag.error === true || tag.error === "true";
      const layout = getNodeLayout(idx, totalNodes);
      return {
        id: String(idx),
        data: {
          idx,
          processName,
          eventKor,
          hasAlert,
          totalNodes,
          event: event,
          explanation: explanation,
          sourcePosition: layout.sourcePosition,
          targetPosition: layout.targetPosition,
        },
        position: { x: layout.x, y: layout.y },
        sourcePosition: layout.sourcePosition,
        targetPosition: layout.targetPosition,
        type: "customNode",
      };
    });

    const newEdges = filteredEvents.slice(1).map((_: any, idx: number) => {
      const sourceEvent = filteredEvents[idx];
      const targetEvent = filteredEvents[idx + 1];

      const sourceTag = sourceEvent.tag || {};
      const targetTag = targetEvent.tag || {};

      const hasSourceAlert =
        sourceTag["sigma@alert"] ||
        sourceTag.error === true ||
        sourceTag.error === "true";
      const hasTargetAlert =
        targetTag["sigma@alert"] ||
        targetTag.error === true ||
        targetTag.error === "true";

      const hasAlert = hasSourceAlert || hasTargetAlert;
      const sourceColIndex = Math.floor(idx / NODES_PER_COLUMN);
      const targetColIndex = Math.floor((idx + 1) / NODES_PER_COLUMN);
      const isColumnTransition = sourceColIndex !== targetColIndex;

      return {
        id: `e${idx}-${idx + 1}`,
        source: String(idx),
        target: String(idx + 1),
        sourceHandle: "right",
        targetHandle: "left",
        type: isColumnTransition ? "smoothstep" : "default",
        style: getEdgeStyle(hasAlert),
        markerEnd: getMarkerEnd(hasAlert),
      };
    });

    return { nodes: newNodes, edges: newEdges };
  }, [trace?.events]);

  useEffect(() => {
    setNodes(memoizedNodesAndEdges.nodes);
    setEdges(memoizedNodesAndEdges.edges);
  }, [memoizedNodesAndEdges, setNodes, setEdges]);

  const nodeTypes = useMemo(() => ({ customNode: CustomNode }), []);

  return (
    <DashboardLayout onLogout={() => {}}>
      <div className="relative z-10 p-6 space-y-6">
        <div className="bg-gradient-to-r from-blue-500/20 to-purple-600/20 backdrop-blur-md border border-blue-500/30 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white mb-2">
                보안 알림 센터
              </h1>
              <p className="text-slate-300 text-sm">
                의심스러운 활동을 발견했을 때 단계별로 어떤 일이 일어났는지
                보여드립니다
              </p>
            </div>
          </div>
        </div>

        <div className="h-[600px] bg-slate-900/70 backdrop-blur-md border border-slate-700/50 rounded-lg overflow-hidden">
          <div className="bg-slate-800/80 px-4 py-2 border-b border-slate-700/50 flex items-center gap-2">
            <div className="flex gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            </div>
            <span className="text-slate-400 text-sm font-mono ml-2">
              AI 분석 결과
            </span>
          </div>
          <div className="p-6 overflow-y-auto h-[540px]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-cyan-400">
                AI 위협 분석 보고서
              </h2>

              <div className="flex space-x-2">
                <button
                  onClick={() => handleTabChange("report")}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                    activeTab === "report"
                      ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                      : "bg-slate-700/50 text-slate-400 hover:bg-slate-600/50"
                  }`}
                >
                  종합보고
                </button>
                <button
                  onClick={() => handleTabChange("response")}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                    activeTab === "response"
                      ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                      : "bg-slate-700/50 text-slate-400 hover:bg-slate-600/50"
                  }`}
                >
                  대응제안
                </button>
              </div>
            </div>

            {activeTab === "report" && currentAnalysis && (
              <div className="space-y-4">
                <div className="p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg border border-blue-500/20">
                  <div className="text-slate-200 text-sm leading-relaxed space-y-2">
                    <p>
                      {currentAnalysis.riskLevel === "높음"
                        ? "• 현재 컴퓨터에서 위험한 활동이 발견되었습니다. 누군가 허가없이 컴퓨터에 접근하려고 시도한 흔적이 보입니다."
                        : "• 현재 컴퓨터 상태는 안전한 것으로 보입니다. 일부 의심스러운 활동이 있었지만 위험하지 않습니다."}
                    </p>
                    <p>
                      • 총{" "}
                      <span className="text-cyan-400 font-semibold">
                        {currentAnalysis.totalSteps}단계
                      </span>
                      의 활동이 있었고, 그 중{" "}
                      <span className="text-purple-400 font-semibold">
                        {currentAnalysis.criticalEvents}개
                      </span>
                      가 중요한 이벤트입니다.
                    </p>
                    <p>
                      • 사용자:{" "}
                      <span className="text-cyan-400 font-semibold">
                        {(() => {
                          if (trace?.events && trace.events.length > 0) {
                            const firstEvent = trace.events[0];
                            const tag = firstEvent.tag || {};
                            return tag.User || "-";
                          }
                          return "-";
                        })()}
                      </span>
                    </p>
                    <div className="mt-3 p-3 bg-slate-800/50 rounded-lg">
                      <div className="text-xs text-slate-400 mb-1">
                        • 간단 요약
                      </div>
                      <div className="text-sm text-slate-200">
                        {currentAnalysis.summary}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-md font-semibold text-white mb-3">
                      위험도 평가
                    </h3>
                    <div className="space-y-3">
                      <div className="p-3 bg-slate-800/50 rounded-lg">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">위험 등급</span>
                          <span
                            className={`font-semibold ${
                              currentAnalysis.riskLevel === "높음"
                                ? "text-red-400"
                                : "text-green-400"
                            }`}
                          >
                            {currentAnalysis.riskLevel}
                          </span>
                        </div>
                      </div>
                      <div className="p-3 bg-slate-800/50 rounded-lg">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">사용자</span>
                          <span className="text-cyan-400">
                            {(() => {
                              if (trace?.events && trace.events.length > 0) {
                                const firstEvent = trace.events[0];
                                const tag = firstEvent.tag || {};
                                return tag.User || "-";
                              }
                              return "-";
                            })()}
                          </span>
                        </div>
                      </div>
                      <div className="p-3 bg-slate-800/50 rounded-lg">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">공격 벡터</span>
                          <span className="text-yellow-400">
                            {eventTypeExplanations[
                              currentAnalysis.attackVector
                            ] || currentAnalysis.attackVector}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-md font-semibold text-white mb-3">
                      분석 통계
                    </h3>
                    <div className="space-y-3">
                      <div className="p-3 bg-slate-800/50 rounded-lg">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">총 단계 수</span>
                          <span className="text-blue-400">
                            {currentAnalysis.totalSteps}
                          </span>
                        </div>
                      </div>
                      <div className="p-3 bg-slate-800/50 rounded-lg">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">중요 이벤트</span>
                          <span className="text-purple-400">
                            {currentAnalysis.criticalEvents}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "response" && (
              <div className="space-y-4">
                <div className="mb-4">
                  <h3 className="text-md font-semibold text-white mb-2">
                    즉시 대응 조치
                  </h3>
                  <div className="p-4 bg-gradient-to-r from-red-500/10 to-orange-500/10 rounded-lg border border-red-500/20">
                    <div className="text-red-400 font-semibold mb-2">
                      • 긴급 조치 (지금 즉시)
                    </div>
                    <div className="text-slate-300 text-sm leading-relaxed space-y-2">
                      <div>• 1단계: 현재 작업을 저장하고 중단하세요</div>
                      <div>
                        • 2단계: 실행 중인 의심스러운 프로그램을 종료하세요
                      </div>
                      <div>• 3단계: 관리자에게 즉시 신고하세요</div>
                    </div>
                  </div>
                </div>
                <div className="mb-4">
                  <h3 className="text-md font-semibold text-white mb-2">
                    단기 대응
                  </h3>
                  <div className="p-4 bg-gradient-to-r from-orange-500/10 to-yellow-500/10 rounded-lg border border-orange-500/20">
                    <div className="text-orange-400 font-semibold mb-2">
                      • 단기 대응 (30분 내)
                    </div>
                    <div className="text-slate-300 text-sm leading-relaxed space-y-2">
                      <div>• 백신 프로그램으로 전체 검사 실행</div>
                      <div>• 시스템 복원 지점 확인</div>
                      <div>• 중요한 파일 백업 상태 점검</div>
                    </div>
                  </div>
                </div>
                <div className="mb-4">
                  <h3 className="text-md font-semibold text-white mb-2">
                    예방 조치
                  </h3>
                  <div className="p-4 bg-gradient-to-r from-green-500/10 to-blue-500/10 rounded-lg border border-green-500/20">
                    <div className="text-slate-200 text-sm leading-relaxed space-y-2">
                      <div>• 정기적인 보안 업데이트 설치</div>
                      <div>• 의심스러운 이메일 첨부파일 열지 않기</div>
                      <div>• 중요한 데이터 정기적 백업</div>
                      <div>• 강력한 비밀번호 사용 및 정기적 변경</div>
                      <div>• 출처 불분명한 소프트웨어 설치 금지</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="h-[600px] flex flex-col bg-slate-900/70 backdrop-blur-md border border-slate-700/50 rounded-lg overflow-hidden mt-6">
          <div className="bg-slate-800/80 px-4 py-2 border-b border-slate-700/50 flex items-center gap-2">
            <div className="flex gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            </div>
            <span className="text-slate-400 text-sm font-mono ml-2">
              공격 흐름 시각화 - 클릭하면 자세한 정보를 볼 수 있습니다
            </span>
          </div>
          <div className="flex-1 w-full bg-slate-900/50 relative flex items-center justify-center">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              className="bg-transparent"
              defaultViewport={memoizedDefaultViewport}
              minZoom={0.3}
              maxZoom={4}
              attributionPosition="bottom-left"
              panOnDrag
              panOnScroll
              zoomOnScroll
              zoomOnPinch
              zoomOnDoubleClick
              fitView={true}
              onLoad={onLoad}
              style={{
                backgroundColor: "transparent",
                width: "100%",
                height: "100%",
              }}
              onNodeClick={onNodeClick}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable={false}
              selectNodesOnDrag={false}
              multiSelectionKeyCode={null}
              deleteKeyCode={null}
              snapToGrid={false}
              snapGrid={[15, 15]}
              onlyRenderVisibleElements={true}
              proOptions={{ hideAttribution: true }}
            />
          </div>
        </div>
        <AnimatePresence>
          {selectedNode && nodeDetail && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
              onClick={onCloseModal}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 50 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: 50 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-slate-900/90 backdrop-blur-md border border-slate-700/50 rounded-xl shadow-2xl p-8 min-w-[500px] max-w-4xl max-h-[90vh] overflow-y-auto relative font-mono"
              >
                <div className="bg-slate-800/80 px-4 py-2 -mx-8 -mt-8 mb-6 border-b border-slate-700/50 flex items-center gap-2">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  </div>
                  <span className="text-slate-400 text-sm font-mono ml-2">
                    보안 이벤트 상세 정보
                  </span>
                  <button
                    className="ml-auto text-slate-400 hover:text-red-400 text-lg font-bold"
                    onClick={onCloseModal}
                  >
                    ×
                  </button>
                </div>
                <h3 className="text-lg font-bold mb-4 text-cyan-400">
                  단계별 상세 정보
                </h3>
                <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <div className="text-blue-300 font-semibold mb-2">
                    이벤트 타입
                  </div>
                  <div className="text-slate-300">{nodeDetail.explanation}</div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="min-w-0">
                    <span className="text-slate-400">활동 유형:</span>
                    <div className="text-purple-300 font-bold break-words text-sm">
                      {(() => {
                        const tag = nodeDetail.event.tag || {};
                        let eventType = "";
                        if (tag.EventName) {
                          eventType = tag.EventName.split("(")[0]
                            .replace(/[^a-zA-Z]/g, "")
                            .toLowerCase();
                        } else if (tag.TaskName) {
                          eventType = tag.TaskName.split("(")[0]
                            .replace(/[^a-zA-Z]/g, "")
                            .toLowerCase();
                        } else {
                          eventType = "unknownevent";
                        }
                        return eventType;
                      })()}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <span className="text-slate-400">단계 번호:</span>
                    <div className="text-blue-300 text-sm">
                      {Number(nodeDetail.index) + 1}
                    </div>
                  </div>
                  <div className="min-w-0 md:col-span-2">
                    <span className="text-slate-400">Trace ID:</span>
                    <div className="text-cyan-300 bg-cyan-500/10 p-2 rounded border border-cyan-500/20 mt-1 break-all text-sm font-mono">
                      {nodeDetail.event.trace_id ||
                        trace?.trace_id ||
                        "데이터 없음"}
                    </div>
                  </div>
                  <div className="min-w-0 md:col-span-2">
                    <span className="text-slate-400">실행 시간:</span>
                    <div className="text-amber-300 bg-amber-500/10 p-2 rounded border border-amber-500/20 mt-1 text-sm font-mono break-words">
                      {nodeDetail.event.tag?.UtcTime ||
                        nodeDetail.event.timestamp ||
                        "시간 정보 없음"}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div className="min-w-0">
                    <span className="text-slate-400">실행된 프로그램:</span>
                    <div className="text-green-300 bg-green-500/10 p-2 rounded border border-green-500/20 mt-1 break-words text-sm">
                      {(() => {
                        const tag = nodeDetail.event.tag || {};
                        let processName =
                          tag.ProcessName ||
                          tag.Image ||
                          tag.EventName ||
                          tag.TaskName ||
                          "알 수 없는 활동";
                        if (
                          typeof processName === "string" &&
                          processName.includes(".exe")
                        ) {
                          const match = processName.match(/([^\\/]+\.exe)/i);
                          if (match) processName = match[1];
                        }
                        return processName;
                      })()}
                    </div>
                  </div>
                  <div className="min-w-0 md:col-span-2">
                    <span className="text-slate-400">명령어:</span>
                    <div className="text-yellow-300 bg-yellow-500/10 p-2 rounded border border-yellow-500/20 mt-1 break-all text-sm">
                      {nodeDetail.event.tag?.CommandLine || "-"}
                    </div>
                  </div>
                  <div className="min-w-0 md:col-span-2">
                    <span className="text-slate-400">부모 프로세스:</span>
                    <div className="text-orange-300 break-all text-sm">
                      {nodeDetail.event.tag?.ParentImage || "-"}
                    </div>
                  </div>
                  <div className="min-w-0 md:col-span-2">
                    <span className="text-slate-400">부모 명령어:</span>
                    <div className="text-orange-300 break-all text-sm">
                      {nodeDetail.event.tag?.ParentCommandLine || "-"}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <span className="text-slate-400">사용자:</span>
                    <div className="text-cyan-300 break-words text-sm">
                      {nodeDetail.event.tag?.User || "-"}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <span className="text-slate-400">경로:</span>
                    <div className="text-cyan-300 break-words text-sm">
                      {nodeDetail.event.tag?.CurrentDirectory || "-"}
                    </div>
                  </div>
                </div>
                {nodeDetail.event.tag?.["sigma@alert"] && (
                  <div className="mt-4">
                    <span className="text-slate-400">탐지된 Sigma 룰:</span>
                    <div className="text-yellow-300 bg-yellow-500/10 p-2 rounded border border-yellow-500/20 text-sm break-words">
                      {nodeDetail.event.tag["sigma@alert"]}
                    </div>
                  </div>
                )}
                {/* Raw 데이터 (토글 버튼) */}
                <div className="mt-8">
                  <button
                    className="mb-2 px-4 py-2 rounded bg-slate-700 text-slate-200 hover:bg-slate-600 border border-slate-600 text-xs"
                    onClick={() => setShowRaw((v) => !v)}
                  >
                    {showRaw ? "Raw 데이터 숨기기" : "Raw 데이터 보기"}
                  </button>
                  {showRaw && (
                    <pre className="text-xs bg-slate-800 p-3 rounded border border-slate-700/50 overflow-auto text-slate-300 max-h-48">
                      {JSON.stringify(nodeDetail.event, null, 2)}
                    </pre>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}

export default function AlarmDetailPage() {
  return (
    <ReactFlowProvider>
      <AlarmDetailContent />
    </ReactFlowProvider>
  );
}
