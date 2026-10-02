import { useState, useMemo, useRef } from "react";
import { 
  Funnel, 
  FileSpreadsheet, 
  Download, 
  FileUp, 
  Search,
  CalendarClock
} from "lucide-react";
import * as XLSX from "xlsx";
import { 
  ContactRecord, 
  CATEGORIES, 
  LEAD_STATUSES, 
  LEAD_STATUS_COLORS,
  EXPORT_HEADERS
} from "../types";

interface ContactsListProps {
  records: ContactRecord[];
  search: string;
  setSearch: (val: string) => void;
  onOpen: (record: ContactRecord) => void;
  onExport: (recs: ContactRecord[], filename: string) => void;
  onImport: (recs: any[]) => void;
  isAdmin: boolean;
  employees: string[];
  toast: (msg: string, type?: "ok" | "warn" | "err") => void;
}

// Low-case headers mapping for imports
const IMPORT_MAPPINGS: Record<string, string[]> = {
  name: ["name", "full name", "contact", "contact person"],
  company: ["company", "company name", "organisation", "organization", "firm"],
  designation: ["designation", "title", "job title", "role"],
  department: ["department", "dept"],
  mobile: ["mobile", "phone", "mobile number", "phone number", "contact number"],
  whatsapp: ["whatsapp", "whatsapp number"],
  altPhone: ["alternate mobile", "alternate number", "alt phone", "phone 2"],
  email: ["email", "e-mail", "email address"],
  website: ["website", "web", "url"],
  address: ["address", "address line"],
  city: ["city"],
  state: ["state"],
  country: ["country"],
  pin: ["pin", "pin code", "pincode", "zip", "postal code"],
  gst: ["gst", "gst number", "gstin"],
  businessType: ["business type"],
  category: ["category", "type"],
  leadStatus: ["lead status", "status"],
  priority: ["priority"],
  assignedTo: ["assigned employee", "assigned to", "owner"],
  remarks: ["remarks", "comment", "comments"],
  notes: ["notes", "note"],
  linkedin: ["linkedin"],
  facebook: ["facebook"],
  instagram: ["instagram"],
  twitter: ["twitter", "x"],
  recordId: [],
  scanDate: [],
  addedBy: [],
  followUpDate: [],
  history: []
};

export default function ContactsList({
  records,
  search,
  setSearch,
  onOpen,
  onExport,
  onImport,
  isAdmin,
  employees,
  toast,
}: ContactsListProps) {
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const fileInputRef = useRef<HTMLInputElement>(null);

  const we = (val: string) => (val || "").replace(/\D/g, "").slice(-10);

  // Parse Excel sheets with robust fuzzy mapping
  const handleExcelImport = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheetName];
      const rawRows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      const mappedRows = rawRows.map((row) => {
        // Clean keys to lowercase and trim spaces
        const cleanedRow: any = {};
        Object.keys(row).forEach((key) => {
          cleanedRow[key.trim().toLowerCase()] = String(row[key]).trim();
        });

        const mappedRecord: any = {};
        Object.entries(IMPORT_MAPPINGS).forEach(([targetKey, variants]) => {
          for (const variant of variants) {
            if (cleanedRow[variant] !== undefined && cleanedRow[variant] !== "") {
              mappedRecord[targetKey] = cleanedRow[variant];
              break;
            }
          }
        });
        return mappedRecord;
      }).filter((r) => r.name || r.company || r.mobile || r.email);

      if (mappedRows.length === 0) {
        toast("No readable rows found. Please make sure the sheet has headers like 'Name', 'Company', 'Mobile', or 'Email'.", "warn");
        return;
      }

      onImport(mappedRows);
    } catch (err) {
      toast("Failed to parse the uploaded spreadsheet. Please check the file format.", "err");
    }
  };

  // Filtering records
  const filteredRecords = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = new Date();

    const isSameDate = (d1Str: string, d2: Date) => {
      const d1 = new Date(d1Str);
      return (
        d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate()
      );
    };

    const isThisWeek = (dateStr: string) => {
      const t = new Date(dateStr);
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - (now.getDay() + 6) % 7);
      startOfWeek.setHours(0, 0, 0, 0);
      return t >= startOfWeek;
    };

    const isThisMonth = (dateStr: string) => {
      const t = new Date(dateStr);
      return t.getFullYear() === now.getFullYear() && t.getMonth() === now.getMonth();
    };

    return records
      .filter((rec) => {
        // General text search matching
        const searchPool = [
          rec.name,
          rec.company,
          rec.mobile,
          rec.whatsapp,
          rec.email,
          rec.gst,
          rec.city,
          rec.state,
          rec.category,
          rec.leadStatus,
        ]
          .join(" ")
          .toLowerCase();

        if (q && !searchPool.includes(q)) return false;

        // Structured Filters
        if (categoryFilter && rec.category !== categoryFilter) return false;
        if (statusFilter && rec.leadStatus !== statusFilter) return false;
        if (employeeFilter && rec.assignedTo !== employeeFilter) return false;

        // Date Filters
        if (dateFilter === "today" && !isSameDate(rec.scanDate, now)) return false;
        if (dateFilter === "week" && !isThisWeek(rec.scanDate)) return false;
        if (dateFilter === "month" && !isThisMonth(rec.scanDate)) return false;
        if (dateFilter === "custom") {
          const recTime = new Date(rec.scanDate).getTime();
          if (customStart && recTime < new Date(customStart).getTime()) return false;
          if (customEnd) {
            const endBoundary = new Date(customEnd);
            endBoundary.setHours(23, 59, 59);
            if (recTime > endBoundary.getTime()) return false;
          }
        }

        return true;
      })
      .sort((a, b) => new Date(b.scanDate).getTime() - new Date(a.scanDate).getTime());
  }, [records, search, categoryFilter, statusFilter, employeeFilter, dateFilter, customStart, customEnd]);

  // Bulk checking
  const handleToggleSelectAll = () => {
    if (selectedIds.size === filteredRecords.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRecords.map((r) => r.recordId)));
    }
  };

  const handleToggleSelectRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const isAllSelected = filteredRecords.length > 0 && selectedIds.size === filteredRecords.length;

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

  const initials = (nameStr: string) => {
    const parts = (nameStr || "?").trim().split(/\s+/);
    return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
  };

  return (
    <div className="content">
      {/* Header and bulk excel actions */}
      <div className="flex flex-wrap gap-4 items-end justify-between">
        <div>
          <h1 className="h1 text-2xl font-extrabold tracking-tight">Contacts</h1>
          <p className="sub text-sm text-[var(--muted)]">
            {filteredRecords.length} of {records.length} records matching 
            {selectedIds.size > 0 && ` • ${selectedIds.size} selected`}
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {selectedIds.size > 0 && (
            <button
              onClick={() => onExport(records.filter((r) => selectedIds.has(r.recordId)), "selected")}
              className="btn bg-[var(--panel)] font-bold text-xs flex items-center gap-1.5 cursor-pointer text-[var(--text)] border border-[var(--border2)]"
            >
              <FileSpreadsheet size={14} /> Export Selected ({selectedIds.size})
            </button>
          )}
          <button
            onClick={() => onExport(filteredRecords, "filtered")}
            className="btn bg-[var(--panel)] font-bold text-xs flex items-center gap-1.5 cursor-pointer text-[var(--text)] border border-[var(--border2)]"
          >
            <FileSpreadsheet size={14} /> Export Filtered
          </button>
          <button
            onClick={() => onExport(records, "all")}
            className="btn primary font-bold text-xs flex items-center gap-1.5 cursor-pointer border-none shadow"
          >
            <Download size={14} /> Export All
          </button>

          {isAdmin && (
            <>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="btn bg-[var(--panel)] font-bold text-xs flex items-center gap-1.5 cursor-pointer border border-[var(--border2)] text-[var(--text)]"
              >
                <FileUp size={14} /> Import Spreadsheet
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleExcelImport(file);
                  e.target.value = "";
                }}
              />
            </>
          )}
        </div>
      </div>

      {/* Query Filters Panel */}
      <div className="card pad p-4 bg-[var(--panel)] border border-[var(--border)] rounded-2xl flex flex-wrap gap-3 items-center">
        <Funnel size={15} className="text-[var(--faint)] flex-shrink-0" />
        
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="text-xs rounded-xl py-1.5 px-3 max-w-[150px]"
        >
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-xs rounded-xl py-1.5 px-3 max-w-[150px]"
        >
          <option value="">All Statuses</option>
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          value={employeeFilter}
          onChange={(e) => setEmployeeFilter(e.target.value)}
          className="text-xs rounded-xl py-1.5 px-3 max-w-[150px]"
        >
          <option value="">All Employees</option>
          {employees.map((emp) => (
            <option key={emp} value={emp}>
              {emp}
            </option>
          ))}
        </select>

        <select
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="text-xs rounded-xl py-1.5 px-3 max-w-[140px]"
        >
          <option value="">Any Date</option>
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="custom">Custom Range</option>
        </select>

        {dateFilter === "custom" && (
          <div className="flex gap-2 items-center flex-wrap">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="text-xs py-1 px-2.5 max-w-[125px] rounded-lg border border-[var(--border2)]"
            />
            <span className="text-xs text-[var(--muted)]">to</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="text-xs py-1 px-2.5 max-w-[125px] rounded-lg border border-[var(--border2)]"
            />
          </div>
        )}
      </div>

      {/* Main CRM Table list view */}
      <div className="card bg-[var(--panel)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="table w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[var(--bg2)]/40 border-b border-[var(--border)]">
                <th className="p-3 text-left w-10">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={handleToggleSelectAll}
                    className="cursor-pointer"
                  />
                </th>
                <th className="p-3 text-left text-xs font-bold uppercase tracking-wider text-[var(--faint)]">
                  Contact
                </th>
                <th className="p-3 text-left text-xs font-bold uppercase tracking-wider text-[var(--faint)]">
                  Company
                </th>
                <th className="p-3 text-left text-xs font-bold uppercase tracking-wider text-[var(--faint)]">
                  Mobile
                </th>
                <th className="p-3 text-left text-xs font-bold uppercase tracking-wider text-[var(--faint)]">
                  Email
                </th>
                <th className="p-3 text-left text-xs font-bold uppercase tracking-wider text-[var(--faint)]">
                  City
                </th>
                <th className="p-3 text-left text-xs font-bold uppercase tracking-wider text-[var(--faint)]">
                  Category
                </th>
                <th className="p-3 text-left text-xs font-bold uppercase tracking-wider text-[var(--faint)]">
                  Status
                </th>
                <th className="p-3 text-left text-xs font-bold uppercase tracking-wider text-[var(--faint)]">
                  Assigned
                </th>
                <th className="p-3 text-left text-xs font-bold uppercase tracking-wider text-[var(--faint)]">
                  Scanned
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((rec) => {
                const isSelected = selectedIds.has(rec.recordId);
                const statusColor = LEAD_STATUS_COLORS[rec.leadStatus] || "#8a94a6";

                return (
                  <tr
                    key={rec.recordId}
                    onClick={() => onOpen(rec)}
                    className="border-b border-[var(--border)] hover:bg-[var(--blue)]/5 cursor-pointer transition"
                  >
                    <td
                      onClick={(e) => e.stopPropagation()}
                      className="p-3 align-middle"
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelectRow(rec.recordId)}
                        className="cursor-pointer"
                      />
                    </td>
                    <td className="p-3 align-middle">
                      <div className="flex items-center gap-2.5">
                        <div className="avatar w-8 h-8 rounded-lg bg-[var(--hero-grad)] text-white text-xs font-bold flex items-center justify-center">
                          {initials(rec.name)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-sm text-[var(--text)]">
                            {rec.name || "Unnamed lead"}
                          </div>
                          <div className="text-[11px] text-[var(--muted)] truncate">
                            {rec.designation || ""}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 align-middle text-[var(--text)] font-medium">
                      {rec.company || "—"}
                    </td>
                    <td className="p-3 align-middle text-[var(--text)] whitespace-nowrap">
                      {rec.mobile || "—"}
                    </td>
                    <td className="p-3 align-middle text-[var(--muted)]">
                      {rec.email || "—"}
                    </td>
                    <td className="p-3 align-middle text-[var(--text)]">
                      {rec.city || "—"}
                    </td>
                    <td className="p-3 align-middle">
                      <span className="chip text-[10px] font-bold py-0.5 px-2.5 rounded-full bg-[var(--blue)]/10 text-[var(--blue)] border border-[var(--blue)]/20">
                        {rec.category}
                      </span>
                    </td>
                    <td className="p-3 align-middle">
                      <span
                        className="chip text-[10px] font-bold py-0.5 px-2.5 rounded-full border"
                        style={{
                          backgroundColor: `${statusColor}10`,
                          color: statusColor,
                          borderColor: `${statusColor}30`,
                        }}
                      >
                        {rec.leadStatus}
                      </span>
                    </td>
                    <td className="p-3 align-middle text-xs font-semibold text-[var(--muted)]">
                      {rec.assignedTo || "—"}
                    </td>
                    <td className="p-3 align-middle text-xs text-[var(--faint)] whitespace-nowrap">
                      {formatDate(rec.scanDate)}
                    </td>
                  </tr>
                );
              })}

              {filteredRecords.length === 0 && (
                <tr>
                  <td
                    colSpan={10}
                    className="p-10 text-center text-sm text-[var(--muted)]"
                  >
                    No contacts matched your search query. Adjust filters or scan some cards to populate the list.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
