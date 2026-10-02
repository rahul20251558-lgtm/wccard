import { 
  CalendarClock,
  ArrowRight
} from "lucide-react";
import { 
  ContactRecord, 
  LEAD_STATUSES, 
  LEAD_STATUS_COLORS, 
  PRIORITY_COLORS 
} from "../types";

interface LeadPipelineProps {
  records: ContactRecord[];
  onOpen: (record: ContactRecord) => void;
}

export default function LeadPipeline({ records, onOpen }: LeadPipelineProps) {
  
  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="content">
      <div>
        <h1 className="h1 text-2xl font-extrabold tracking-tight">Lead Pipeline</h1>
        <p className="sub text-sm text-[var(--muted)]">
          Manage and track leads dynamically through client acquisition stages. Click on any card to update.
        </p>
      </div>

      {/* Kanban Board Container */}
      <div className="kanban flex gap-4 overflow-x-auto pb-4 pt-1">
        {LEAD_STATUSES.map((status) => {
          const colRecords = records.filter((r) => r.leadStatus === status);
          const headerColor = LEAD_STATUS_COLORS[status] || "#8a94a6";

          return (
            <div
              key={status}
              className="kcol w-[260px] flex-shrink-0 bg-[var(--panel)]/40 border border-[var(--border)] rounded-2xl p-4 flex flex-col min-h-[480px]"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-3 mb-2 border-b border-[var(--border)]">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: headerColor }}
                  />
                  <span className="font-bold text-xs text-[var(--text)] uppercase tracking-wider">
                    {status}
                  </span>
                </div>
                <span className="bg-[var(--bg2)] text-[var(--muted)] text-[11px] font-bold px-2 py-0.5 rounded-full">
                  {colRecords.length}
                </span>
              </div>

              {/* Cards list */}
              <div className="space-y-3 flex-1 overflow-y-auto max-h-[500px] pr-1">
                {colRecords.map((rec) => {
                  const priorityColor = PRIORITY_COLORS[rec.priority] || "#8a94a6";

                  return (
                    <div
                      key={rec.recordId}
                      onClick={() => onOpen(rec)}
                      className="kcard p-4 bg-[var(--panel)] border border-[var(--border)] hover:border-[var(--blue)] rounded-xl shadow-sm cursor-pointer hover:shadow-md transition group"
                    >
                      <div className="font-bold text-[13px] text-[var(--text)] leading-snug group-hover:text-[var(--blue)] truncate">
                        {rec.name || rec.company || "Unnamed Lead"}
                      </div>
                      
                      {rec.company && (
                        <div className="sub text-[11px] text-[var(--muted)] truncate mt-0.5">
                          {rec.company}
                        </div>
                      )}

                      <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
                        {/* Priority Chip */}
                        <span
                          className="chip text-[10px] font-extrabold px-2 py-0.5 rounded-full border"
                          style={{
                            backgroundColor: `${priorityColor}15`,
                            color: priorityColor,
                            borderColor: `${priorityColor}30`,
                          }}
                        >
                          {rec.priority}
                        </span>

                        {/* Follow-up Indicator */}
                        {rec.followUpDate ? (
                          <span className="text-[10px] text-[var(--warn)] font-bold flex items-center gap-1">
                            <CalendarClock size={10} />
                            {formatDate(rec.followUpDate)}
                          </span>
                        ) : (
                          <span className="text-[10px] text-[var(--faint)] flex items-center gap-0.5">
                            Quick Edit <ArrowRight size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {colRecords.length === 0 && (
                  <div className="h-full flex items-center justify-center border-2 border-dashed border-[var(--border2)]/50 rounded-xl p-8 mt-2 text-center text-xs text-[var(--faint)]">
                    Drag/file contacts here to see pipeline.
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
