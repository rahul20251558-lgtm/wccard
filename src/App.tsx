import { useState, useEffect, useCallback, useRef } from "react";
import { 
  LayoutDashboard, 
  Camera, 
  Users, 
  SquareKanban, 
  History, 
  LogOut, 
  Search, 
  Sun, 
  Moon, 
  ChevronRight,
  ShieldAlert,
  CircleCheck,
  TriangleAlert,
  LoaderCircle
} from "lucide-react";
import * as XLSX from "xlsx";

import { 
  ContactRecord, 
  ActivityLog, 
  QueueItem, 
  EXPORT_HEADERS,
  CATEGORIES
} from "./types";
import {
  fetchDb,
  saveRecord,
  saveRecords,
  deleteRecord,
  saveEmployees,
  logActivity,
  getToken,
  clearToken,
  onSaveState,
  AuthError,
  SaveState
} from "./lib/api";
import { WEST_COAST_LOGO } from "./lib/logo";

// Frontend Views
import LoginScreen from "./components/LoginScreen";
import Dashboard from "./components/Dashboard";
import ScanCards from "./components/ScanCards";
import ContactsList from "./components/ContactsList";
import LeadPipeline from "./components/LeadPipeline";
import ActivityLogs from "./components/ActivityLogs";
import CardDetailDrawer from "./components/CardDetailDrawer";
import ManageEmployees from "./components/ManageEmployees";

interface ToastItem {
  id: number;
  msg: string;
  type?: "ok" | "warn" | "err";
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<{ name: string; role: string } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    try { return (localStorage.getItem("wc_theme") as any) || "light"; } catch { return "light"; }
  });
  const [view, setView] = useState<"dashboard" | "scan" | "contacts" | "leads" | "activity" | "employees">("dashboard");
  const [records, setRecords] = useState<ContactRecord[]>([]);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [employees, setEmployees] = useState<string[]>([]);
  const [employeePasswords, setEmployeePasswords] = useState<Record<string, string>>({});
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [search, setSearch] = useState("");
  const [activeRecord, setActiveRecord] = useState<ContactRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const userRef = useRef(currentUser);
  userRef.current = currentUser;

  useEffect(() => { try { localStorage.setItem("wc_theme", theme); } catch {} }, [theme]);
  useEffect(() => onSaveState(setSaveState), []);

  // Helper trigger notifications/toasts
  const triggerToast = useCallback((msg: string, type: "ok" | "warn" | "err" = "ok") => {
    const tid = Math.random();
    setToasts((prev) => [...prev, { id: tid, msg, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== tid)), 4500);
  }, []);

  const handleAuthLost = useCallback(() => {
    clearToken();
    setCurrentUser(null);
    setAuthChecked(true);
  }, []);

  // Load full cloud database (same data on every PC / laptop / mobile)
  const loadDatabase = useCallback(async (silent = false) => {
    if (!getToken()) { setAuthChecked(true); setIsLoading(false); return; }
    if (!silent) setIsLoading(true);
    try {
      const data = await fetchDb();
      setCurrentUser(data.me);
      setRecords(data.records || []);
      setActivity(data.activity || []);
      setEmployees(data.employees || []);
      setEmployeePasswords(data.employeePasswords || {});
    } catch (err) {
      if (err instanceof AuthError) handleAuthLost();
      else if (!silent) triggerToast("Cloud se data load nahi hua. Internet check karein.", "err");
    } finally {
      setAuthChecked(true);
      setIsLoading(false);
    }
  }, [handleAuthLost, triggerToast]);

  // Auto-login with remembered session
  useEffect(() => { loadDatabase(); }, [loadDatabase]);

  // Refresh when user comes back to the tab (doosre device ka naya data bhi dikhe)
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === "visible" && userRef.current) loadDatabase(true); };
    document.addEventListener("visibilitychange", onVis);
    const iv = setInterval(() => { if (document.visibilityState === "visible" && userRef.current) loadDatabase(true); }, 60000);
    return () => { document.removeEventListener("visibilitychange", onVis); clearInterval(iv); };
  }, [loadDatabase]);

  const addLog = useCallback((msg: string) => {
    const log: ActivityLog = { at: new Date().toISOString(), by: userRef.current?.name || "System", msg };
    setActivity((prev) => [log, ...prev].slice(0, 300));
    logActivity(msg);
  }, []);

  const onWriteError = useCallback((err: any) => {
    if (err instanceof AuthError) { triggerToast("Session expire ho gaya. Dobara login karein.", "err"); handleAuthLost(); }
    else triggerToast("Save nahi hua: " + (err?.message || "internet check karein"), "err");
  }, [triggerToast, handleAuthLost]);

  // Login
  const handleLogin = (me: { name: string; role: string }) => {
    setCurrentUser(me);
    loadDatabase();
  };

  const handleLogout = () => {
    if (currentUser) logActivity(`${currentUser.name} signed out`);
    clearToken();
    setCurrentUser(null);
    setRecords([]);
    setActivity([]);
    setView("dashboard");
  };

  const handleSyncEmployees = (updatedEmps: string[], updatedPwds: Record<string, string>) => {
    setEmployees(updatedEmps);
    setEmployeePasswords(updatedPwds);
    saveEmployees(updatedEmps, updatedPwds).catch(onWriteError);
  };

  // AUTO-SAVE: scanned card is saved to cloud immediately (no Save button)
  const handleSaveScannedRecord = useCallback(async (item: QueueItem, fields: Partial<ContactRecord>): Promise<ContactRecord> => {
    const me = userRef.current!;
    const fullRecord: ContactRecord = {
      recordId: item.id,
      scanDate: new Date().toISOString(),
      addedBy: me.name,
      assignedTo: fields.assignedTo || me.name,
      category: (CATEGORIES.includes(fields.category as any) ? fields.category : "Other") as any,
      leadStatus: fields.leadStatus || "New",
      priority: fields.priority || "Medium",
      followUpDate: fields.followUpDate || "",
      remarks: fields.remarks || "",
      history: fields.history || [],
      name: fields.name || "",
      designation: fields.designation || "",
      department: fields.department || "",
      company: fields.company || "",
      businessType: fields.businessType || "",
      gst: fields.gst || "",
      mobile: fields.mobile || "",
      whatsapp: fields.whatsapp || "",
      altPhone: fields.altPhone || "",
      email: fields.email || "",
      website: fields.website || "",
      address: fields.address || "",
      city: fields.city || "",
      state: fields.state || "",
      country: fields.country || "",
      pin: fields.pin || "",
      linkedin: fields.linkedin || "",
      facebook: fields.facebook || "",
      instagram: fields.instagram || "",
      twitter: fields.twitter || "",
      qrData: fields.qrData || "",
      notes: fields.notes || "",
    };
    setRecords((prev) => [fullRecord, ...prev.filter((r) => r.recordId !== fullRecord.recordId)]);
    await saveRecord(fullRecord);
    addLog(`Created new contact lead card for ${fullRecord.name || fullRecord.company || fullRecord.recordId}`);
    return fullRecord;
  }, [addLog]);

  // AUTO-SAVE: every edit in the drawer is saved automatically
  const handleUpdateRecord = useCallback((updated: ContactRecord, log?: boolean) => {
    setRecords((prev) => prev.map((r) => (r.recordId === updated.recordId ? updated : r)));
    saveRecord(updated).catch(onWriteError);
    if (log) addLog(`Updated profile details for lead contact: ${updated.name || updated.recordId}`);
  }, [addLog, onWriteError]);

  // Delete (password checked on server for employees)
  const handleDeleteRecord = async (toDelete: ContactRecord, password?: string) => {
    await deleteRecord(toDelete.recordId, password);
    setRecords((prev) => prev.filter((r) => r.recordId !== toDelete.recordId));
    addLog(`Permanently deleted lead contact: ${toDelete.name || toDelete.recordId}`);
    setActiveRecord(null);
    triggerToast("Record delete ho gaya.", "ok");
  };

  // Import external rows from Excel/CSV
  const handleImportRecords = async (imported: any[]) => {
    if (!currentUser) return;
    const formattedRecords: ContactRecord[] = imported.map((row) => ({
      recordId: "WC-IMP-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 8).toUpperCase(),
      scanDate: new Date().toISOString(),
      addedBy: currentUser.name,
      assignedTo: row.assignedTo || currentUser.name,
      category: row.category || "Other",
      leadStatus: row.leadStatus || "New",
      priority: row.priority || "Medium",
      followUpDate: row.followUpDate || "",
      remarks: row.remarks || "",
      history: [],
      name: row.name || "",
      designation: row.designation || "",
      department: row.department || "",
      company: row.company || "",
      businessType: row.businessType || "",
      gst: row.gst || "",
      mobile: row.mobile || "",
      whatsapp: row.whatsapp || "",
      altPhone: row.altPhone || "",
      email: row.email || "",
      website: row.website || "",
      address: row.address || "",
      city: row.city || "",
      state: row.state || "",
      country: row.country || "",
      pin: row.pin || "",
      linkedin: row.linkedin || "",
      facebook: row.facebook || "",
      instagram: row.instagram || "",
      twitter: row.twitter || "",
      qrData: row.qrData || "",
      notes: row.notes || "",
    }));
    setRecords((prev) => [...formattedRecords, ...prev]);
    try {
      await saveRecords(formattedRecords);
      addLog(`Imported ${formattedRecords.length} contacts from external spreadsheet`);
      triggerToast(`${formattedRecords.length} records import ho gaye.`, "ok");
    } catch (e) { onWriteError(e); }
  };

  // Download client Excel sheets using sheets library
  const handleExportExcel = (data: ContactRecord[], exportType: string) => {
    if (!data.length) {
      triggerToast("No records available to export.", "warn");
      return;
    }
    const exportRows = data.map((rec) => {
      const row: Record<string, any> = {};
      EXPORT_HEADERS.forEach(([key, label]) => { row[label] = (rec as any)[key] ?? ""; });
      return row;
    });
    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    worksheet["!cols"] = EXPORT_HEADERS.map(([, label]) => ({ wch: Math.max(14, label.length + 2) }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "WestCoast Contacts");
    XLSX.writeFile(workbook, `WestCoast_CRM_Contacts_${exportType}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    addLog(`Exported ${data.length} records to Excel spreadsheet (${exportType} list)`);
    triggerToast(`Excel sheet exported: ${data.length} records processed.`, "ok");
  };

  const isUserAdmin = currentUser?.role === "Admin";

  const initials = (nameStr: string) => {
    const parts = (nameStr || "?").trim().split(/\s+/);
    return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
  };

  // Define sidebar navigation items based on authorization
  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={17} /> },
    { id: "scan", label: "Scan Cards", icon: <Camera size={17} /> },
    { id: "contacts", label: "Contacts", icon: <Users size={17} /> },
    { id: "leads", label: "Lead Pipeline", icon: <SquareKanban size={17} /> },
    ...(isUserAdmin ? [
      { id: "activity", label: "Activity Logs", icon: <History size={17} /> },
      { id: "employees", label: "Manage Employees", icon: <Users size={17} /> }
    ] : []),
  ];

  if (!authChecked) {
    return (
      <div className="wcp min-h-screen flex items-center justify-center" data-theme={theme}>
        <LoaderCircle size={28} className="spin text-[var(--blue)]" />
      </div>
    );
  }

  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="wcp" data-theme={theme}>
      {/* Side Navigation Bar Drawer */}
      <aside className={`side ${menuOpen ? "open" : ""}`}>
        <div className="logo-wrap">
          <img src={WEST_COAST_LOGO} alt="West-Coast CRM Portal" />
        </div>

        {/* Menu Buttons */}
        <nav className="flex-1 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setView(item.id as any);
                setMenuOpen(false);
              }}
              className={`nav-btn ${view === item.id ? "active" : ""}`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Sidebar user footer */}
        <div className="foot border-t border-[var(--border)] pt-4 mt-auto">
          <div className="flex items-center gap-2 mb-3 px-1">
            <div className="w-7 h-7 rounded-lg bg-[var(--bg2)] flex items-center justify-center font-bold text-xs text-[var(--muted)]">
              {initials(currentUser.name)}
            </div>
            <div className="min-w-0">
              <div className="font-bold text-xs truncate text-[var(--text)]">{currentUser.name}</div>
              <div className="text-[10px] text-[var(--faint)] font-bold uppercase tracking-wider">{currentUser.role}</div>
            </div>
          </div>
          
          <button
            onClick={handleLogout}
            className="nav-btn text-[var(--err)] hover:text-[var(--err)] hover:bg-[var(--bg2)] py-2 px-3 rounded-lg"
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
          
          <div className="text-[10px] text-[var(--faint)] mt-4 leading-normal px-1">
            West-Coast Pharmaceuticals<br />
            AI Scanner & CRM v2.0 (Cloud)
          </div>
        </div>
      </aside>

      {/* Main Container Wrapper */}
      <div className="main flex flex-col flex-1 min-w-0">
        
        {/* Top Header Controls Bar */}
        <header className="topbar">
          <button
            onClick={() => setMenuOpen((m) => !m)}
            className="iconbtn hamb p-2"
          >
            <ChevronRight
              size={17}
              className={`transform transition-transform ${menuOpen ? "rotate-180" : ""}`}
            />
          </button>

          {/* Core Search bar (Focuses Contacts list view on keystroke) */}
          <div className="searchbox flex-1 max-w-[420px]">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search leads by name, company, email, city, status..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                if (view !== "contacts") setView("contacts");
              }}
            />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <span
              className="hidden sm:flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg"
              style={{ color: saveState === "error" ? "var(--err)" : saveState === "saving" ? "var(--warn)" : "var(--ok, #2fa262)" }}
              title="Sab kuch apne aap cloud me save hota hai"
            >
              {saveState === "saving" && (<><LoaderCircle size={12} className="spin" /> Saving…</>)}
              {saveState === "error" && (<><TriangleAlert size={12} /> Not saved</>)}
              {(saveState === "saved" || saveState === "idle") && (<><CircleCheck size={12} /> All saved</>)}
            </span>
            <button
              onClick={() => setView("scan")}
              className="btn sm primary px-3.5 py-1.5 rounded-lg flex items-center gap-1 font-bold text-xs"
            >
              <Camera size={14} /> Scan
            </button>
            <button
              onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
              className="iconbtn"
              title="Toggle Dark Mode"
            >
              {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
            </button>
            
            <div
              className="avatar w-8 h-8 rounded-lg flex items-center justify-center font-extrabold text-xs shadow-sm bg-[var(--hero-grad)] text-white"
              title={`${currentUser.name} (${currentUser.role})`}
            >
              {initials(currentUser.name)}
            </div>
          </div>
        </header>

        {/* View switching logic */}
        <main className="flex-1">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <LoaderCircle size={28} className="spin text-[var(--blue)]" />
              <p className="sub text-sm">Loading West-Coast Cloud CRM database...</p>
            </div>
          ) : (
            <>
              {view === "dashboard" && (
                <Dashboard
                  records={records}
                  activity={activity}
                  onExport={handleExportExcel}
                  goScan={() => setView("scan")}
                  goContacts={() => setView("contacts")}
                  setSearch={setSearch}
                />
              )}
              {view === "scan" && (
                <ScanCards
                  queue={queue}
                  setQueue={setQueue}
                  records={records}
                  onSaveRecord={handleSaveScannedRecord}
                  onOpenRecord={(id) => {
                    const r = records.find((x) => x.recordId === id);
                    if (r) setActiveRecord(r);
                  }}
                  toast={triggerToast}
                />
              )}
              {view === "contacts" && (
                <ContactsList
                  records={records}
                  search={search}
                  setSearch={setSearch}
                  onOpen={setActiveRecord}
                  onExport={handleExportExcel}
                  onImport={handleImportRecords}
                  isAdmin={isUserAdmin}
                  employees={employees}
                  toast={triggerToast}
                />
              )}
              {view === "leads" && (
                <LeadPipeline records={records} onOpen={setActiveRecord} />
              )}
              {view === "activity" && isUserAdmin && (
                <ActivityLogs activity={activity} />
              )}
              {view === "employees" && isUserAdmin && (
                <ManageEmployees
                  employees={employees}
                  employeePasswords={employeePasswords}
                  onSync={handleSyncEmployees}
                  toast={triggerToast}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Card detail inspection slide-out drawer overlay */}
      {activeRecord && (
        <CardDetailDrawer
          record={activeRecord}
          isAdmin={isUserAdmin}
          employees={employees}
          onClose={() => setActiveRecord(null)}
          onUpdate={handleUpdateRecord}
          onDelete={handleDeleteRecord}
          toast={triggerToast}
          currentUser={currentUser}
        />
      )}

      {/* Notifications Portal */}
      <div className="toasts">
        {toasts.map((toast) => (
          <div key={toast.id} className="toast">
            {toast.type === "ok" && <CircleCheck size={16} className="text-[#5fd695]" />}
            {toast.type === "warn" && <TriangleAlert size={16} className="text-[#f2c14e]" />}
            {toast.type === "err" && <TriangleAlert size={16} className="text-[#ef8080]" />}
            <span>{toast.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
