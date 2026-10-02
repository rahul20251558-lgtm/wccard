import { History, ShieldAlert } from "lucide-react";
import { ActivityLog } from "../types";

interface ActivityLogsProps {
  activity: ActivityLog[];
}

export default function ActivityLogs({ activity }: ActivityLogsProps) {
  
  const formatDateTime = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="content">
      <div>
        <h1 className="h1 text-2xl font-extrabold tracking-tight flex items-center gap-2">
          <ShieldAlert className="text-[var(--blue)]" size={24} /> Activity Logs
        </h1>
        <p className="sub text-sm text-[var(--muted)]">
          Permanent chronological audit logs of all scanned cards, status transitions, imports, and exports.
        </p>
      </div>

      <div className="card pad p-6 bg-[var(--panel)] border border-[var(--border)] rounded-2xl shadow-sm">
        <div className="space-y-4">
          {activity.map((log, i) => (
            <div
              key={i}
              className="flex gap-4 text-sm py-4 border-t border-[var(--border)] first:border-0 items-start"
            >
              <div className="p-2 bg-[var(--bg2)] rounded-lg text-[var(--muted)] mt-0.5 flex-shrink-0">
                <History size={15} />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-[var(--text)] font-semibold leading-relaxed">
                  {log.msg}
                </p>
                <div className="sub text-xs text-[var(--faint)] mt-1.5">
                  Operated by <span className="font-bold text-[var(--blue)]">{log.by}</span> • {formatDateTime(log.at)}
                </div>
              </div>
            </div>
          ))}

          {activity.length === 0 && (
            <div className="text-center py-10 text-[var(--muted)] text-sm">
              No activity logs have been recorded yet. Get started by signing in and scanning cards.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
