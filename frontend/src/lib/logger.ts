"use strict";

/**
 * 프로덕션 환경용 안전한 로깅 시스템
 * 민감한 정보 노출을 방지하고 환경별 로깅 레벨을 관리
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, any>;
}

class ProductionLogger {
  private logLevel: LogLevel;
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === "development";
    this.logLevel = this.isDevelopment ? LogLevel.DEBUG : LogLevel.WARN;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.logLevel;
  }

  private sanitizeData(data: any): any {
    if (typeof data === "string") {
      // 민감한 정보 패턴 제거
      return data
        .replace(/password[=:]\s*[^\s,}]+/gi, "password=***")
        .replace(/token[=:]\s*[^\s,}]+/gi, "token=***")
        .replace(/key[=:]\s*[^\s,}]+/gi, "key=***")
        .replace(/secret[=:]\s*[^\s,}]+/gi, "secret=***")
        .replace(/authorization[=:]\s*[^\s,}]+/gi, "authorization=***");
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.sanitizeData(item));
    }

    if (data && typeof data === "object") {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(data)) {
        const lowerKey = key.toLowerCase();
        if (
          lowerKey.includes("password") ||
          lowerKey.includes("token") ||
          lowerKey.includes("key") ||
          lowerKey.includes("secret") ||
          lowerKey.includes("authorization")
        ) {
          sanitized[key] = "***";
        } else {
          sanitized[key] = this.sanitizeData(value);
        }
      }
      return sanitized;
    }

    return data;
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: any
  ): LogEntry {
    return {
      level,
      message: this.sanitizeData(message),
      timestamp: new Date().toISOString(),
      context: context ? this.sanitizeData(context) : undefined,
    };
  }

  private log(level: LogLevel, message: string, context?: any): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const logEntry = this.createLogEntry(level, message, context);

    // 개발 환경에서는 콘솔에 출력
    if (this.isDevelopment) {
      const consoleMethod = this.getConsoleMethod(level);
      consoleMethod(logEntry.message, logEntry.context || "");
    }

    // 프로덕션 환경에서는 안전한 로깅만 수행
    if (!this.isDevelopment) {
      this.productionLog(logEntry);
    }
  }

  private getConsoleMethod(level: LogLevel): (...args: any[]) => void {
    switch (level) {
      case LogLevel.DEBUG:
        return console.debug;
      case LogLevel.INFO:
        return console.info;
      case LogLevel.WARN:
        return console.warn;
      case LogLevel.ERROR:
        return console.error;
      default:
        return console.log;
    }
  }

  private productionLog(logEntry: LogEntry): void {
    // 프로덕션에서는 에러 레벨만 로깅
    if (logEntry.level >= LogLevel.ERROR) {
      // 실제 프로덕션 환경에서는 외부 로깅 서비스로 전송
      // 예: Sentry, LogRocket, DataDog 등
      this.sendToExternalLogger(logEntry);
    }
  }

  private sendToExternalLogger(logEntry: LogEntry): void {
    // 외부 로깅 서비스로 전송하는 로직
    // 현재는 구현하지 않음 (필요시 추가)
    // 예시: Sentry로 전송
    // if (typeof window !== 'undefined' && window.Sentry) {
    //   window.Sentry.captureException(new Error(logEntry.message), {
    //     extra: logEntry.context,
    //     tags: { level: LogLevel[logEntry.level] }
    //   });
    // }
  }

  debug(message: string, context?: any): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: any): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: any): void {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, context?: any): void {
    this.log(LogLevel.ERROR, message, context);
  }

  // API 에러 전용 로깅
  apiError(endpoint: string, error: any, requestData?: any): void {
    this.error(`API Error: ${endpoint}`, {
      endpoint,
      error: error?.message || error,
      status: error?.status,
      requestData: this.sanitizeData(requestData),
    });
  }

  // 인증 관련 에러 전용 로깅
  authError(action: string, error: any): void {
    this.error(`Auth Error: ${action}`, {
      action,
      error: error?.message || error,
    });
  }

  // SSE 연결 관련 에러 전용 로깅
  sseError(action: string, error: any): void {
    this.error(`SSE Error: ${action}`, {
      action,
      error: error?.message || error,
    });
  }
}

// 싱글톤 인스턴스 생성
export const logger = new ProductionLogger();

// 편의 함수들
export const logDebug = (message: string, context?: any) =>
  logger.debug(message, context);
export const logInfo = (message: string, context?: any) =>
  logger.info(message, context);
export const logWarn = (message: string, context?: any) =>
  logger.warn(message, context);
export const logError = (message: string, context?: any) =>
  logger.error(message, context);
export const logApiError = (endpoint: string, error: any, requestData?: any) =>
  logger.apiError(endpoint, error, requestData);
export const logAuthError = (action: string, error: any) =>
  logger.authError(action, error);
export const logSseError = (action: string, error: any) =>
  logger.sseError(action, error);
