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
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import CustomNode from "@/components/CustomNode";
import axiosInstance from "@/lib/axios";
import { useAuth } from "@/context/AuthContext";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Trace {
  trace_id: string;
  timestamp: string;
  host: string;
  os: string;
  label: string;
  severity?: string;
  events: any[];
  sigma_match: string[];
  prompt_input: string;
  ai_summary?: string;
  ai_long_summary?: string;
  ai_decision?: string;
  ai_score?: number;
  ai_mitigation?: string;
  ai_similar_traces?: string[];
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
  NetworkConnect: "네트워크 연결",
  FileCreate: "파일 생성",
  FileDelete: "파일 삭제",
  RegistrySet: "레지스트리 설정",
  RegistryDelete: "레지스트리 삭제",
  ServiceCreate: "서비스 생성",
  ServiceDelete: "서비스 삭제",
  DriverLoad: "드라이버 로드",
  ImageLoad: "이미지 로드",
  ClipboardChange: "클립보드 변경",
  DnsQuery: "DNS 쿼리",
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
  useEffect(() => {
    if (selectedNode) {
      const prevOverflow = document.body.style.overflow;
      const prevTouchAction = (document.body.style as any).touchAction;
      document.body.style.overflow = "hidden";
      (document.body.style as any).touchAction = "none";
      return () => {
        document.body.style.overflow = prevOverflow;
        (document.body.style as any).touchAction = prevTouchAction;
      };
    }
  }, [selectedNode]);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"report" | "response">("report");
  const [showRaw, setShowRaw] = useState(false);
  const [rawDataMode, setRawDataMode] = useState(false);
  const [sigmaTitles, setSigmaTitles] = useState<{ [key: string]: string }>({});
  const router = useRouter();
  const { logout } = useAuth();

  // 대응제안 마크다운을 섹션(## 제목 기준)으로 분리
  const mitigationSections = useMemo(() => {
    const raw = trace?.ai_mitigation;
    if (!raw || typeof raw !== "string")
      return [] as { title: string; content: string }[];
    try {
      const stripped = raw
        .replace(/```markdown\n?/, "")
        .replace(/\n?```$/, "")
        .trim();
      const lines = stripped.split(/\r?\n/);
      const sections: { title: string; content: string }[] = [];
      let currentTitle = "";
      let currentBody: string[] = [];
      for (const line of lines) {
        if (/^#\s+/.test(line)) {
          // H1은 무시 (전체 제목)
          continue;
        }
        if (/^##\s+/.test(line)) {
          if (currentTitle) {
            sections.push({
              title: currentTitle,
              content: currentBody.join("\n").trim(),
            });
            currentBody = [];
          }
          currentTitle = line.replace(/^##\s+/, "").trim();
        } else {
          currentBody.push(line);
        }
      }
      if (currentTitle) {
        sections.push({
          title: currentTitle,
          content: currentBody.join("\n").trim(),
        });
      }
      return sections;
    } catch {
      return [] as { title: string; content: string }[];
    }
  }, [trace?.ai_mitigation]);

  // 대응제안 섹션 색상(번호별 로테이션)
  const mitigationColorVariants = useMemo(
    () => [
      {
        container: "bg-blue-500/10 border-blue-500/30",
        title: "text-blue-300",
      },
      {
        container: "bg-emerald-500/10 border-emerald-500/30",
        title: "text-emerald-300",
      },
      {
        container: "bg-amber-500/10 border-amber-500/30",
        title: "text-amber-300",
      },
      {
        container: "bg-purple-500/10 border-purple-500/30",
        title: "text-purple-300",
      },
      {
        container: "bg-cyan-500/10 border-cyan-500/30",
        title: "text-cyan-300",
      },
    ],
    []
  );
  const fetchSigmaTitle = async (sigmaId: string) => {
    try {
      const response = await fetch(`/api/sigma-rule/${sigmaId}`, {
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.title || sigmaId;
    } catch (error) {
      console.error("Sigma rule 조회 실패:", error);
    }
    return sigmaId; // 실패 시 ID 반환
  };

  const parseSigmaAlert = (sigmaAlert: any): string[] => {
    if (!sigmaAlert) return [];

    try {
      // JSON 배열 문자열인 경우 파싱
      if (typeof sigmaAlert === "string" && sigmaAlert.trim().startsWith("[")) {
        return JSON.parse(sigmaAlert);
      }
      // 배열인 경우
      if (Array.isArray(sigmaAlert)) {
        return sigmaAlert;
      }
      // 단일 값인 경우
      return [sigmaAlert];
    } catch {
      // 파싱 실패 시 단일 값으로 처리
      return [String(sigmaAlert)];
    }
  };

  const fetchAllSigmaTitles = async (events: any[]) => {
    const sigmaIds: string[] = [];

    events.forEach((event) => {
      const sigmaAlert = event.tag?.["sigma@alert"];
      if (sigmaAlert) {
        const parsedIds = parseSigmaAlert(sigmaAlert);
        parsedIds.forEach((id) => {
          if (id && !sigmaIds.includes(id)) {
            sigmaIds.push(id);
          }
        });
      }
    });

    const titles: { [key: string]: string } = {};
    for (const sigmaId of sigmaIds) {
      const title = await fetchSigmaTitle(sigmaId);
      titles[sigmaId] = title;
    }

    setSigmaTitles(titles);
  };

  const handleTabChange = useCallback((tab: "report" | "response") => {
    setActiveTab(tab);
  }, []);
  const reactFlowInstance = useRef<any>(null);

  const onNodeClick = useCallback((_: any, node: any) => {
    setSelectedNode(node);
  }, []);

  const handleLogout = useCallback(() => {
    logout();
    router.push("/login");
  }, [logout, router]);

  const onLoad = useCallback((inst: any) => {
    reactFlowInstance.current = inst;
    setTimeout(() => {
      inst.fitView({ padding: 0.1, includeHiddenNodes: false });
    }, 100);
  }, []);

  const onCloseModal = useCallback(() => {
    setSelectedNode(null);
  }, []);

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
        const response = await fetch(`/api/alarms/${trace_id}`, {
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        setTrace(data.data || null);

        if (data.data && data.data.events) {
          await fetchAllSigmaTitles(data.data.events);
        }
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
      let eventKor = "";

      // EventName에서 rule 추출: "Processterminated(rule:ProcessTerminate)"
      const eventName = tag.EventName || "";
      const ruleMatch = eventName.match(/\(rule:([^)]+)\)/);
      if (ruleMatch) {
        const ruleName = ruleMatch[1];
        eventKor = ruleNameKorean[ruleName] || ruleName;
      } else {
        eventKor = eventName || "알 수 없는 이벤트";
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

        <div className="h-[600px] w-full min-w-0 box-border bg-slate-900/70 backdrop-blur-md border border-slate-700/50 rounded-lg overflow-hidden">
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
          <div
            className="p-6 overflow-y-scroll overflow-x-hidden h-[540px] w-full min-w-0 max-w-full box-border"
            style={{
              scrollbarGutter: "stable both-edges",
              contain: "inline-size",
            }}
          >
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
              <div className="space-y-4 min-h-[480px] w-full">
                {/* 기본 정보 */}
                <div className="w-full p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg border border-blue-500/20">
                  <div className="text-slate-200 text-sm leading-relaxed space-y-2">
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
                    <div className="mt-3 p-3 bg-slate-800/50 rounded-lg w-full">
                      <div className="text-xs text-slate-400 mb-1">• 설명</div>
                      <div className="text-slate-200 text-sm leading-relaxed prose prose-invert prose-sm max-w-none">
                        {trace?.ai_long_summary ? (
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              h1: ({ children }) => (
                                <h1 className="text-sm font-semibold mt-3 mb-2 text-slate-200">
                                  {children}
                                </h1>
                              ),
                              h2: ({ children }) => (
                                <h2 className="text-sm font-semibold mt-3 mb-2 text-slate-200">
                                  {children}
                                </h2>
                              ),
                              h3: ({ children }) => (
                                <h3 className="text-sm font-semibold mt-3 mb-2 text-slate-200">
                                  {children}
                                </h3>
                              ),
                              p: ({ children }) => (
                                <p className="mb-2 text-slate-300 leading-7 break-words whitespace-normal">
                                  {children}
                                </p>
                              ),
                              ul: ({ children }) => (
                                <ul className="list-disc list-outside pl-5 mb-2 space-y-1 leading-7">
                                  {children}
                                </ul>
                              ),
                              ol: ({ children }) => (
                                <ol className="list-decimal list-outside pl-5 mb-2 space-y-1 leading-7">
                                  {children}
                                </ol>
                              ),
                              li: ({ children }) => (
                                <li className="text-slate-300 break-words">
                                  {children}
                                </li>
                              ),
                              code: ({ inline, children }: any) =>
                                inline ? (
                                  <code className="bg-slate-800 px-1 py-0.5 rounded text-cyan-400">
                                    {children}
                                  </code>
                                ) : (
                                  <code className="block bg-slate-900 p-3 rounded my-2 text-cyan-400 overflow-x-auto">
                                    {children}
                                  </code>
                                ),
                              pre: ({ children }) => (
                                <pre className="bg-slate-900 p-3 rounded my-3 overflow-x-auto">
                                  {children}
                                </pre>
                              ),
                            }}
                          >
                            {trace.ai_long_summary
                              .replace(/```markdown\n?/, "")
                              .replace(/\n?```$/, "")}
                          </ReactMarkdown>
                        ) : (
                          "분석 중..."
                        )}
                      </div>
                    </div>
                    {trace?.ai_similar_traces &&
                      trace.ai_similar_traces.length > 0 && (
                        <div className="mt-3 p-3 bg-slate-800/50 rounded-lg w-full">
                          <div className="text-xs text-slate-400 mb-2">
                            • 유사 트레이스
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {trace.ai_similar_traces.map((id, idx) => (
                              <Link
                                key={`${id}-${idx}`}
                                href={`/alarms/${id}`}
                                className="px-2 py-1 rounded border border-slate-600/50 bg-slate-900/50 text-cyan-300 hover:text-cyan-200 hover:border-cyan-500/40 font-mono text-xs break-all"
                              >
                                {id}
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}
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
                          <span className="text-slate-400">
                            위험 등급 (Sigma)
                          </span>
                          <span
                            className={`uppercase ${
                              trace?.severity === "critical"
                                ? "text-red-600"
                                : trace?.severity === "high"
                                ? "text-red-400"
                                : trace?.severity === "medium"
                                ? "text-orange-400"
                                : "text-yellow-400"
                            }`}
                          >
                            {trace?.severity || "low"}
                          </span>
                        </div>
                      </div>
                      {trace?.ai_decision && (
                        <div className="p-3 bg-slate-800/50 rounded-lg">
                          <div className="flex justify-between items-center">
                            <span className="text-slate-400">AI 판정</span>
                            <span
                              className={`${
                                trace.ai_decision === "malicious"
                                  ? "text-red-400"
                                  : "text-green-400"
                              }`}
                            >
                              {trace.ai_decision === "malicious"
                                ? "악성"
                                : "정상"}
                            </span>
                          </div>
                        </div>
                      )}
                      {trace?.ai_score !== undefined && (
                        <div className="p-3 bg-slate-800/50 rounded-lg">
                          <div className="flex justify-between items-center">
                            <span className="text-slate-400">AI Score</span>
                            <span className="text-blue-400">
                              {(trace.ai_score * 100).toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      )}
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
              <div className="space-y-4 min-h-[480px]">
                {trace?.ai_mitigation && (
                  <div className="w-full p-4 bg-slate-800/40 rounded-lg border border-slate-700/40">
                    <div className="text-slate-300 text-xs mb-2 font-semibold">
                      AI 추천 대응 방안
                    </div>
                    {mitigationSections.length > 0 ? (
                      <div className="space-y-3">
                        {mitigationSections.map((sec, idx) => {
                          const variant =
                            mitigationColorVariants[
                              idx % mitigationColorVariants.length
                            ];
                          return (
                            <div
                              key={`${idx}-${sec.title}`}
                              className={`w-full p-3 rounded-lg border ${variant.container}`}
                            >
                              <div
                                className={`${variant.title} font-semibold mb-2`}
                              >
                                {sec.title}
                              </div>
                              <div className="text-slate-200 text-sm leading-relaxed prose prose-invert prose-sm max-w-none">
                                <ReactMarkdown
                                  remarkPlugins={[remarkGfm]}
                                  components={{
                                    p: ({ children }) => (
                                      <p className="mb-2 text-slate-300 leading-7">
                                        {children}
                                      </p>
                                    ),
                                    ul: ({ children }) => (
                                      <ul className="list-disc list-outside pl-5 mb-2 space-y-1 leading-7">
                                        {children}
                                      </ul>
                                    ),
                                    ol: ({ children }) => (
                                      <ol className="list-decimal list-outside pl-5 mb-2 space-y-1 leading-7">
                                        {children}
                                      </ol>
                                    ),
                                    li: ({ children }) => (
                                      <li className="text-slate-300 break-words">
                                        {children}
                                      </li>
                                    ),
                                    code: ({ inline, children }: any) =>
                                      inline ? (
                                        <code className="bg-slate-800 px-1 py-0.5 rounded text-cyan-400">
                                          {children}
                                        </code>
                                      ) : (
                                        <code className="block bg-slate-900 p-3 rounded my-2 text-cyan-400 overflow-x-auto">
                                          {children}
                                        </code>
                                      ),
                                    pre: ({ children }) => (
                                      <pre className="bg-slate-900 p-3 rounded my-3 overflow-x-auto">
                                        {children}
                                      </pre>
                                    ),
                                  }}
                                >
                                  {sec.content}
                                </ReactMarkdown>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-slate-200 text-sm leading-relaxed prose prose-invert prose-sm max-w-none">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            p: ({ children }) => (
                              <p className="mb-2 text-slate-300 leading-7">
                                {children}
                              </p>
                            ),
                            ul: ({ children }) => (
                              <ul className="list-disc list-outside pl-5 mb-2 space-y-1 leading-7">
                                {children}
                              </ul>
                            ),
                            ol: ({ children }) => (
                              <ol className="list-decimal list-outside pl-5 mb-2 space-y-1 leading-7">
                                {children}
                              </ol>
                            ),
                            li: ({ children }) => (
                              <li className="text-slate-300 break-words">
                                {children}
                              </li>
                            ),
                            code: ({ inline, children }: any) =>
                              inline ? (
                                <code className="bg-slate-800 px-1 py-0.5 rounded text-cyan-400">
                                  {children}
                                </code>
                              ) : (
                                <code className="block bg-slate-900 p-3 rounded my-2 text-cyan-400 overflow-x-auto">
                                  {children}
                                </code>
                              ),
                            pre: ({ children }) => (
                              <pre className="bg-slate-900 p-3 rounded my-3 overflow-x-auto">
                                {children}
                              </pre>
                            ),
                          }}
                        >
                          {trace.ai_mitigation
                            .replace(/```markdown\n?/, "")
                            .replace(/\n?```$/, "")}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                )}

                {/* 대응제안 데이터 없을 때 */}
                {!trace?.ai_mitigation && (
                  <div className="p-4 bg-slate-800/40 rounded-lg border border-slate-700/40 text-slate-300 text-sm">
                    대응제안 생성중...
                  </div>
                )}
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
          {selectedNode && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm m-0 !mt-0"
              style={{ margin: 0, marginTop: 0 }}
              onWheel={(e) => e.preventDefault()}
              onTouchMove={(e) => e.preventDefault()}
              onClick={onCloseModal}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 50 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: 50 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-slate-900/90 backdrop-blur-md border border-slate-700/50 rounded-xl shadow-2xl p-8 w-[600px] h-[1000px] overflow-y-auto relative font-mono"
              >
                <div className="bg-slate-800/80 px-4 py-2 -mx-8 -mt-8 mb-6 border-b border-slate-700/50 flex items-center gap-2">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  </div>
                  <span className="text-slate-400 text-sm font-mono ml-2">
                    {rawDataMode ? "Raw 데이터 뷰어" : "보안 이벤트 상세 정보"}
                  </span>
                  <div className="ml-auto flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-xs">상세 정보</span>
                      <button
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                          rawDataMode ? "bg-blue-600" : "bg-slate-600"
                        }`}
                        onClick={() => setRawDataMode(!rawDataMode)}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            rawDataMode ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                      <span className="text-slate-400 text-xs">Raw 데이터</span>
                    </div>
                    <button
                      className="text-slate-400 hover:text-red-400 text-lg font-bold"
                      onClick={onCloseModal}
                    >
                      ×
                    </button>
                  </div>
                </div>
                {!rawDataMode ? (
                  <>
                    <h3 className="text-lg font-bold mb-4 text-cyan-400">
                      단계별 상세 정보
                    </h3>
                    <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                      <div className="text-blue-300 font-semibold mb-2">
                        이벤트 타입
                      </div>
                      <div className="text-slate-300">
                        {selectedNode.data.explanation}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="min-w-0">
                        <span className="text-slate-400">활동 유형:</span>
                        <div className="text-purple-300 font-bold break-words text-sm">
                          {(() => {
                            const tag = selectedNode.data.event.tag || {};
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
                          {Number(selectedNode.id) + 1}
                        </div>
                      </div>
                      <div className="min-w-0 md:col-span-2">
                        <span className="text-slate-400">Trace ID:</span>
                        <div className="text-cyan-300 bg-cyan-500/10 p-2 rounded border border-cyan-500/20 mt-1 break-all text-sm font-mono">
                          {selectedNode.data.event.trace_id ||
                            trace?.trace_id ||
                            "데이터 없음"}
                        </div>
                      </div>
                      <div className="min-w-0 md:col-span-2">
                        <span className="text-slate-400">실행 시간:</span>
                        <div className="text-amber-300 bg-amber-500/10 p-2 rounded border border-amber-500/20 mt-1 text-sm font-mono break-words">
                          {selectedNode.data.event.tag?.UtcTime ||
                            selectedNode.data.event.timestamp ||
                            "시간 정보 없음"}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <div className="min-w-0">
                        <span className="text-slate-400">실행된 프로그램:</span>
                        <div className="text-green-300 bg-green-500/10 p-2 rounded border border-green-500/20 mt-1 break-words text-sm">
                          {(() => {
                            const tag = selectedNode.data.event.tag || {};
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
                              const match =
                                processName.match(/([^\\/]+\.exe)/i);
                              if (match) processName = match[1];
                            }
                            return processName;
                          })()}
                        </div>
                      </div>
                      <div className="min-w-0 md:col-span-2">
                        <span className="text-slate-400">명령어:</span>
                        <div className="text-yellow-300 bg-yellow-500/10 p-2 rounded border border-yellow-500/20 mt-1 break-all text-sm">
                          {selectedNode.data.event.tag?.CommandLine || "-"}
                        </div>
                      </div>
                      <div className="min-w-0 md:col-span-2">
                        <span className="text-slate-400">부모 프로세스:</span>
                        <div className="text-orange-300 break-all text-sm">
                          {selectedNode.data.event.tag?.ParentImage || "-"}
                        </div>
                      </div>
                      <div className="min-w-0 md:col-span-2">
                        <span className="text-slate-400">부모 명령어:</span>
                        <div className="text-orange-300 break-all text-sm">
                          {selectedNode.data.event.tag?.ParentCommandLine ||
                            "-"}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <span className="text-slate-400">사용자:</span>
                        <div className="text-cyan-300 break-words text-sm">
                          {selectedNode.data.event.tag?.User || "-"}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <span className="text-slate-400">경로:</span>
                        <div className="text-cyan-300 break-words text-sm">
                          {selectedNode.data.event.tag?.CurrentDirectory || "-"}
                        </div>
                      </div>
                    </div>
                    {selectedNode.data.event.tag?.["sigma@alert"] && (
                      <div className="mt-4">
                        <span className="text-slate-400">탐지된 Sigma 룰:</span>
                        <div className="space-y-2 mt-2">
                          {parseSigmaAlert(
                            selectedNode.data.event.tag["sigma@alert"]
                          ).map((sigmaId, idx) => (
                            <div
                              key={idx}
                              className="text-yellow-300 bg-yellow-500/10 p-2 rounded border border-yellow-500/20 text-sm break-words"
                            >
                              {sigmaTitles[sigmaId] || sigmaId}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="mb-6 flex flex-col">
                    <h3 className="text-lg font-bold mb-4 text-cyan-400">
                      Raw 데이터
                    </h3>
                    <pre className="text-xs bg-slate-800 p-4 rounded border border-slate-700/50 overflow-auto text-slate-300 max-h-[725px] whitespace-pre-wrap">
                      {JSON.stringify(selectedNode.data.event, null, 2)}
                    </pre>
                  </div>
                )}
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
