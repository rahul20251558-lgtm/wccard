import { useMemo } from "react";
import { 
  ScanLine, 
  CalendarClock, 
  History, 
  Copy, 
  Building2, 
  Users, 
  Camera, 
  FileSpreadsheet,
  BadgeCheck
} from "lucide-react";
import { ContactRecord, ActivityLog } from "../types";

interface DashboardProps {
  records: ContactRecord[];
  activity: ActivityLog[];
  onExport: (recs: ContactRecord[], filename: string) => void;
  goScan: () => void;
  goContacts: () => void;
  setSearch: (val: string) => void;
}

export default function Dashboard({
  records,
  activity,
  onExport,
  goScan,
  goContacts,
  setSearch,
}: DashboardProps) {
  
  const we = (val: string) => (val || "").replace(/\D/g, "").slice(-10);

  // Helper to count duplicates (by phone digits or email address)
  const countDuplicates = (recs: ContactRecord[]): number => {
    const seen = new Set<string>();
    let duplicates = 0;
    recs.forEach((r) => {
      const keys = [we(r.mobile), (r.email || "").trim().toLowerCase()].filter(
        (val) => val && val.length > 3
      );
      if (keys.some((key) => seen.has(key))) {
        duplicates++;
      }
      keys.forEach((key) => seen.add(key));
    });
    return duplicates;
  };

  const stats = useMemo(() => {
    const now = new Date();
    
    const isToday = (dateStr: string) => {
      const d = new Date(dateStr);
      return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate()
      );
    };

    const isThisMonth = (dateStr: string) => {
      const d = new Date(dateStr);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    };

    const companiesSet = new Set(
      records.map((r) => (r.company || "").trim().toLowerCase()).filter(Boolean)
    );

    return {
      total: records.length,
      today: records.filter((r) => isToday(r.scanDate)).length,
      month: records.filter((r) => isThisMonth(r.scanDate)).length,
      duplicates: countDuplicates(records),
      companies: companiesSet.size,
      contacts: records.length,
    };
  }, [records]);

  const statCards = [
    {
      value: stats.total,
      label: "Total Cards",
      icon: <ScanLine size={18} className="text-[var(--blue)]" />,
    },
    {
      value: stats.today,
      label: "Today's Scans",
      icon: <CalendarClock size={18} className="text-[var(--blue)]" />,
    },
    {
      value: stats.month,
      label: "Monthly Scans",
      icon: <History size={18} className="text-[var(--blue)]" />,
    },
    {
      value: stats.duplicates,
      label: "Duplicate Cards",
      icon: <Copy size={18} className="text-[var(--warn)]" />,
    },
    {
      value: stats.companies,
      label: "Total Companies",
      icon: <Building2 size={18} className="text-[var(--blue)]" />,
    },
    {
      value: stats.contacts,
      label: "Total Contacts",
      icon: <Users size={18} className="text-[var(--blue)]" />,
    },
  ];

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

  // Sort and filter upcoming follow-ups
  const upcomingFollowUps = useMemo(() => {
    return records
      .filter((r) => r.followUpDate)
      .sort((a, b) => new Date(a.followUpDate).getTime() - new Date(b.followUpDate).getTime())
      .slice(0, 7);
  }, [records]);

  const initials = (nameStr: string) => {
    const parts = (nameStr || "?").trim().split(/\s+/);
    return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
  };

  return (
    <div className="content">
      {/* Hero Welcome Banner */}
      <div
        className="card p-8 bg-[var(--hero-grad)] text-white border-none relative overflow-hidden shadow-lg rounded-2xl"
      >
        <div className="absolute right-[-40px] top-[-60px] w-[260px] h-[260px] rounded-full bg-white/10" />
        <div className="absolute right-[60px] bottom-[-90px] w-[200px] h-[200px] rounded-full bg-white/5" />
        
        <h1 className="h1 text-white text-2xl font-extrabold tracking-tight">
          Business Card Intelligence
        </h1>
        <p className="mt-2 text-sm opacity-90 max-w-xl leading-relaxed">
          Scan visiting cards from doctors, hospitals, distributors, and partners. 
          Our AI extracts, validates, and uploads every detail into your West-Coast CRM instantly.
        </p>
        
        <div className="flex gap-3 mt-6 flex-wrap">
          <button
            onClick={goScan}
            className="btn bg-white text-[var(--navy)] hover:text-[var(--blue)] font-bold px-5 py-2.5 rounded-xl border-none shadow-sm flex items-center gap-2"
          >
            <Camera size={16} /> Scan a Card
          </button>
          <button
            onClick={() => onExport(records, "all")}
            className="btn bg-white/15 text-white border border-white/30 hover:bg-white/25 hover:border-white/40 font-bold px-5 py-2.5 rounded-xl flex items-center gap-2"
          >
            <FileSpreadsheet size={16} /> Export to Excel
          </button>
        </div>
      </div>

      {/* Stats Cards Grid */}
      <div className="stat-grid">
        {statCards.map((c, i) => (
          <div key={i} className="stat relative p-6 bg-[var(--panel)] border border-[var(--border)] rounded-2xl shadow-sm overflow-hidden">
            <span className="ic absolute right-4 top-4 opacity-40">{c.icon}</span>
            <div className="n text-3xl font-extrabold tracking-tight mt-1 text-[var(--text)]">{c.value}</div>
            <div className="l text-xs font-semibold text-[var(--muted)] mt-1 uppercase tracking-wider">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Activities and Follow-ups Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activities */}
        <div className="card pad p-6 bg-[var(--panel)] border border-[var(--border)] rounded-2xl">
          <h2 className="h2 text-base font-bold text-[var(--text)] mb-4">Recent Activity</h2>
          <div className="space-y-3">
            {activity.slice(0, 9).map((act, i) => (
              <div
                key={i}
                className="flex gap-3 text-sm py-3 border-t border-[var(--border)] first:border-0"
              >
                <BadgeCheck size={16} className="text-[var(--blue)] mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[var(--text)] font-medium leading-relaxed">{act.msg}</p>
                  <div className="sub text-[11px] text-[var(--muted)] mt-1 flex gap-2">
                    <span>{formatDateTime(act.at)}</span>
                    <span>•</span>
                    <span className="font-semibold text-[var(--blue)]">{act.by}</span>
                  </div>
                </div>
              </div>
            ))}

            {activity.length === 0 && (
              <div className="text-center py-8 text-[var(--muted)] text-sm">
                Activity logs will appear here as your team scans and registers cards.
              </div>
            )}
          </div>
        </div>

        {/* Upcoming Follow-ups */}
        <div className="card pad p-6 bg-[var(--panel)] border border-[var(--border)] rounded-2xl">
          <h2 className="h2 text-base font-bold text-[var(--text)] mb-4">Upcoming Follow-ups</h2>
          <div className="space-y-3">
            {upcomingFollowUps.map((rec) => (
              <div
                key={rec.recordId}
                onClick={() => {
                  setSearch(rec.name || rec.company || "");
                  goContacts();
                }}
                className="flex items-center gap-3 py-3 border-t border-[var(--border)] first:border-0 hover:bg-[var(--bg2)] px-2 rounded-xl transition cursor-pointer"
              >
                <div className="avatar w-8 h-8 rounded-lg bg-[var(--hero-grad)] text-white font-bold text-xs flex items-center justify-center">
                  {initials(rec.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-[var(--text)] truncate">
                    {rec.name || rec.company || "Unnamed Lead"}
                  </div>
                  <div className="sub text-xs text-[var(--muted)] truncate">{rec.company}</div>
                </div>
                <span className="chip flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-[var(--warn)]/10 text-[var(--warn)]">
                  <CalendarClock size={11} /> {formatDate(rec.followUpDate)}
                </span>
              </div>
            ))}

            {upcomingFollowUps.length === 0 && (
              <div className="text-center py-8 text-[var(--muted)] text-sm">
                No active follow-ups scheduled. Assign a next follow-up date on a contact card.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
