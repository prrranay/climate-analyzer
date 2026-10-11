import React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { ApiError } from "@/lib/api";

interface ErrorAlertProps {
  error: Error | ApiError | string | null;
  onRetry?: () => void;
  className?: string;
}

export const ErrorAlert: React.FC<ErrorAlertProps> = ({ error, onRetry, className }) => {
  if (!error) return null;

  const isApiError = error instanceof ApiError;
  const message = typeof error === "string" ? error : error.message;
  const errorCode = isApiError ? error.errorCode : undefined;
  const details = isApiError ? error.details : undefined;

  return (
    <div
      className={`rounded-xl border border-rose-500/30 bg-rose-950/20 p-5 text-rose-200 backdrop-blur-md ${className || ""}`}
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-rose-400 mt-0.5 shrink-0" />
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-rose-300 text-sm">
              {errorCode ? `Request Error: ${errorCode}` : "An error occurred"}
            </h4>
          </div>
          <p className="text-sm text-rose-200/90 leading-relaxed">{message}</p>

          {details && details.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-rose-300/80 list-disc list-inside">
              {details.map((d, idx) => (
                <li key={idx}>
                  {d.field ? <span className="font-mono text-rose-200">{d.field}: </span> : null}
                  {d.issue}
                </li>
              ))}
            </ul>
          )}

          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/30 transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry Analysis
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
