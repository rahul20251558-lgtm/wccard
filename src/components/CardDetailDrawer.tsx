import { useState, useEffect, useRef } from "react";
import { imageUrl } from "../lib/api";
import { 
  X, 
  Trash2, 
  Check, 
  Plus, 
  ClipboardList, 
  CalendarClock,
  TriangleAlert,
  LoaderCircle,
  Building
} from "lucide-react";
import { 
  ContactRecord, 
  FIELD_GROUPS, 
  CATEGORIES, 
  LEAD_STATUSES, 
  LEAD_STATUS_COLORS,
  PRIORITIES, 
  PRIORITY_COLORS 
} from "../types";

interface CardDetailDrawerProps {
  record: ContactRecord;
  isAdmin: boolean;
  employees: string[];
  onClose: () => void;
  onUpdate: (updated: ContactRecord, log?: boolean) => void;
  onDelete: (rec: ContactRecord, password?: string) => Promise<void>;
  toast: (msg: string, type?: "ok" | "warn" | "err") => void;
  currentUser: { name: string; role: string };
}

export default function CardDetailDrawer({
  record,
  isAdmin,
  employees,
  onClose,
  onUpdate,
  onDelete,
  toast,
  currentUser,
}: CardDetailDrawerProps) {
  const [fields, setFields] = useState<ContactRecord>(record);
  const [noteDraft, setNoteDraft] = useState("");
  const [imageError, setImageError] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [saveHint, setSaveHint] = useState<"" | "pending" | "saved">("");

  // Auto-save machinery
  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);   // unsaved change pending
  const edited = useRef(false);  // any edit in this session (for activity log)

  const flush = (log = false) => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (dirty.current) {
      dirty.current = false;
      onUpdate({ ...fieldsRef.current, history: fieldsRef.current.history || [] }, log);
      setSaveHint("saved");
    } else if (log) {
      onUpdate({ ...fieldsRef.current }, true);
    }
  };

  // Reset only when a DIFFERENT record is opened (typing is never overwritten)
  useEffect(() => {
    setFields(record);
    setNoteDraft("");
    setImageError(false);
    setIsConfirmingDelete(false);
    setDeletePassword("");
    setDeleteError("");
    setSaveHint("");
    dirty.current = false;
    edited.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record.recordId]);

  // Save pending edits if drawer unmounts / tab closes
  useEffect(() => {
    const onHide = () => flush(false);
    window.addEventListener("pagehide", onHide);
    return () => { window.removeEventListener("pagehide", onHide); flush(edited.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record.recordId]);

  const handleFieldChange = (key: keyof ContactRecord, val: any) => {
    setFields((prev) => ({ ...prev, [key]: val }));
    dirty.current = true;
    edited.current = true;
    setSaveHint("pending");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => flush(false), 800);
  };

  const handleClose = () => {
    flush(edited.current);
    edited.current = false;
    onClose();
  };

  const handleLogInteraction = () => {
    if (!noteDraft.trim()) return;
    const newHistoryItem = { at: new Date().toISOString(), by: currentUser.name, note: noteDraft.trim() };
    const updatedRecord = { ...fieldsRef.current, history: [...(fieldsRef.current.history || []), newHistoryItem] };
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    dirty.current = false;
    setFields(updatedRecord);
    fieldsRef.current = updatedRecord;
    onUpdate(updatedRecord);
    setNoteDraft("");
    setSaveHint("saved");
  };

  const we = (val: string) => (val || "").replace(/\D/g, "").slice(-10);
  const hasInvalidEmail = fields.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(fields.email.trim());
  const hasInvalidMobile = fields.mobile && we(fields.mobile).length < 7;

  const initials = (nameStr: string) => {
    const parts = (nameStr || "?").trim().split(/\s+/);
    return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
  };

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

  const statusColor = LEAD_STATUS_COLORS[fields.leadStatus] || "#8a94a6";
  const priorityColor = PRIORITY_COLORS[fields.priority] || "#8a94a6";

  return (
    <>
      {/* Backdrop overlay */}
      <div className="drawer-mask" onClick={handleClose} />
      
      {/* Slide-out Drawer */}
      <div className="drawer">
        {/* Drawer Header */}
        <div className="flex items-center gap-3 p-5 border-b border-[var(--border)] bg-[var(--panel)] sticky top-0 z-10 shadow-sm">
          <div className="avatar w-10 h-10 rounded-xl bg-[var(--hero-grad)] text-white font-extrabold flex items-center justify-center text-sm">
            {initials(fields.name)}
          </div>
          
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-extrabold text-[var(--text)] truncate">
              {fields.name || "Unnamed contact"}
            </h1>
            <p className="sub text-xs text-[var(--muted)] truncate">
              {[fields.designation, fields.company].filter(Boolean).join(" • ") || fields.recordId}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span
              className="chip text-[10px] font-bold py-0.5 px-2.5 rounded-full border"
              style={{
                backgroundColor: `${statusColor}10`,
                color: statusColor,
                borderColor: `${statusColor}30`,
              }}
            >
              {fields.leadStatus}
            </span>
            <span
              className="chip text-[10px] font-bold py-0.5 px-2.5 rounded-full border"
              style={{
                backgroundColor: `${priorityColor}10`,
                color: priorityColor,
                borderColor: `${priorityColor}30`,
              }}
            >
              {fields.priority}
            </span>
            
            <button
              onClick={handleClose}
              className="iconbtn w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer border border-[var(--border2)] text-[var(--muted)] hover:border-[var(--blue)] hover:text-[var(--blue)] bg-[var(--panel)]"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Drawer Body (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Lead Status, Followup, and Remarks */}
            <div className="card pad p-6 bg-[var(--panel)] border border-[var(--border)] rounded-2xl">
              <h2 className="h2 text-sm font-bold text-[var(--text)] mb-4">Lead Classification</h2>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="flabel text-[10px] font-bold text-[var(--faint)] uppercase tracking-wider block mb-1">
                      Lead Status
                    </label>
                    <select
                      value={fields.leadStatus}
                      onChange={(e) => handleFieldChange("leadStatus", e.target.value as any)}
                      className="w-full text-sm rounded-lg"
                    >
                      {LEAD_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="flabel text-[10px] font-bold text-[var(--faint)] uppercase tracking-wider block mb-1">
                      Priority
                    </label>
                    <select
                      value={fields.priority}
                      onChange={(e) => handleFieldChange("priority", e.target.value as any)}
                      className="w-full text-sm rounded-lg"
                    >
                      {PRIORITIES.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="flabel text-[10px] font-bold text-[var(--faint)] uppercase tracking-wider block mb-1">
                      Assigned Employee
                    </label>
                    <select
                      value={fields.assignedTo}
                      onChange={(e) => handleFieldChange("assignedTo", e.target.value)}
                      className="w-full text-sm rounded-lg"
                    >
                      <option value="">Unassigned</option>
                      {employees.map((emp) => (
                        <option key={emp} value={emp}>
                          {emp}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="flabel text-[10px] font-bold text-[var(--faint)] uppercase tracking-wider block mb-1">
                      Next Follow-up
                    </label>
                    <input
                      type="date"
                      value={fields.followUpDate || ""}
                      onChange={(e) => handleFieldChange("followUpDate", e.target.value)}
                      className="w-full text-sm rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="flabel text-[10px] font-bold text-[var(--faint)] uppercase tracking-wider block mb-1">
                    Category
                  </label>
                  <select
                    value={fields.category}
                    onChange={(e) => handleFieldChange("category", e.target.value as any)}
                    className="w-full text-sm rounded-lg"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="flabel text-[10px] font-bold text-[var(--faint)] uppercase tracking-wider block mb-1">
                    Admin Remarks
                  </label>
                  <textarea
                    value={fields.remarks || ""}
                    onChange={(e) => handleFieldChange("remarks", e.target.value)}
                    rows={2}
                    className="w-full text-sm rounded-lg"
                    placeholder="Provide context or updates regarding conversations with this lead."
                  />
                </div>
              </div>
            </div>

            {/* Visual Card Image Display */}
            <div className="card pad p-6 bg-[var(--panel)] border border-[var(--border)] rounded-2xl flex flex-col justify-between">
              <div>
                <h2 className="h2 text-sm font-bold text-[var(--text)] mb-4">Original Visiting Card</h2>
                
                <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg2)] flex items-center justify-center min-h-[160px] p-2">
                  {imageError ? (
                    <div className="text-center p-4 text-xs text-[var(--muted)]">
                      No card image archived for this record.
                    </div>
                  ) : (
                    <a href={imageUrl(fields.recordId)} target="_blank" rel="noreferrer" title="Bada dekhne ke liye click karein">
                      <img
                        src={imageUrl(fields.recordId)}
                        alt="Archive card copy"
                        className="max-w-full max-h-[220px] object-contain rounded"
                        onError={() => setImageError(true)}
                      />
                    </a>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-[var(--border)] text-[11px] text-[var(--faint)] space-y-1">
                <div>Archived ID: <span className="font-mono">{fields.recordId}</span></div>
                <div>Scanned Date: <span>{formatDateTime(fields.scanDate)}</span></div>
                <div>Added By: <span>{fields.addedBy || "AI Agent"}</span></div>
              </div>
            </div>

          </div>

          {/* Core field editor forms */}
          <div className="card pad p-6 bg-[var(--panel)] border border-[var(--border)] rounded-2xl">
            <h2 className="h2 text-sm font-bold text-[var(--text)] mb-4">Profile Information</h2>
            
            <div className="space-y-6">
              {FIELD_GROUPS.map((group) => (
                <div key={group.title} className="space-y-3">
                  <div className="flabel text-[10px] font-bold text-[var(--blue)] uppercase tracking-widest border-b border-[var(--border)] pb-1">
                    {group.title}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {group.fields.map(([key, label]) => {
                      const isTextArea = key === "notes" || key === "address";
                      const isEmail = key === "email";
                      const isPhone = key === "mobile";

                      const isInvalid = (isEmail && hasInvalidEmail) || (isPhone && hasInvalidMobile);

                      return (
                        <div key={key} className={isTextArea ? "md:col-span-2" : ""}>
                          <label className="flabel text-[10px] font-bold text-[var(--faint)] uppercase tracking-wider block mb-1">
                            {label}
                            {isInvalid && <span className="text-[var(--err)]"> (unusual format)</span>}
                          </label>
                          {isTextArea ? (
                            <textarea
                              value={fields[key] || ""}
                              onChange={(e) => handleFieldChange(key, e.target.value)}
                              rows={2}
                              className="w-full text-sm rounded-lg"
                            />
                          ) : (
                            <input
                              type="text"
                              value={fields[key] || ""}
                              onChange={(e) => handleFieldChange(key, e.target.value)}
                              className={`w-full text-sm rounded-lg ${isInvalid ? "border-[var(--err)]" : ""}`}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Interaction History Logger */}
          <div className="card pad p-6 bg-[var(--panel)] border border-[var(--border)] rounded-2xl">
            <h2 className="h2 text-sm font-bold text-[var(--text)] mb-4 flex items-center gap-1.5">
              <ClipboardList size={16} className="text-[var(--blue)]" /> Contact History & Interactions
            </h2>

            <div className="flex gap-2 mb-6">
              <input
                type="text"
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="Log a client meeting call, email, quotation, or follow-up details..."
                className="flex-1 text-sm rounded-lg"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleLogInteraction();
                }}
              />
              <button
                onClick={handleLogInteraction}
                disabled={!noteDraft.trim()}
                className="btn sm bg-[var(--blue)] text-white hover:bg-[var(--blue2)] font-bold px-4 rounded-xl flex items-center gap-1 cursor-pointer border-none"
              >
                <Plus size={15} /> Log
              </button>
            </div>

            {/* Interaction history timeline list */}
            <div className="space-y-3.5">
              {fields.history && fields.history.length > 0 ? (
                fields.history
                  .slice()
                  .reverse()
                  .map((hist, index) => (
                    <div
                      key={index}
                      className="text-xs p-3.5 bg-[var(--bg2)]/40 border border-[var(--border)] rounded-xl"
                    >
                      <div className="flex justify-between text-[10px] text-[var(--faint)] font-medium mb-1 flex-wrap gap-2">
                        <span>Logged by <span className="font-bold text-[var(--blue)]">{hist.by}</span></span>
                        <span>{formatDateTime(hist.at)}</span>
                      </div>
                      <p className="text-[var(--text)] leading-relaxed font-medium">{hist.note}</p>
                    </div>
                  ))
              ) : (
                <div className="text-center py-6 text-xs text-[var(--muted)]">
                  No logged interactions for this contact yet. Use the note field above to log calls or meetings.
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Drawer Actions Footer */}
        <div className="p-4 border-t border-[var(--border)] bg-[var(--panel)] sticky bottom-0 z-10 shadow-sm">
          {isConfirmingDelete ? (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 space-y-3">
              <div className="text-xs font-semibold text-red-500 flex items-center gap-2">
                <TriangleAlert size={16} />
                <span>Are you sure you want to permanently delete this contact record? This cannot be undone.</span>
              </div>
              
              {!isAdmin && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block">
                    Apna password daalein (delete confirm karne ke liye)
                  </label>
                  <input
                    type="password"
                    value={deletePassword}
                    onChange={(e) => {
                      setDeletePassword(e.target.value);
                      setDeleteError("");
                    }}
                    placeholder="Enter security password"
                    className="text-xs p-2 rounded-lg w-full"
                  />
                  {deleteError && (
                    <p className="text-[10px] font-semibold text-red-500">{deleteError}</p>
                  )}
                </div>
              )}

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setIsConfirmingDelete(false);
                    setDeletePassword("");
                    setDeleteError("");
                  }}
                  className="btn sm bg-[var(--bg2)] text-[var(--text)] border border-[var(--border)] font-bold px-4 py-2 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={async () => {
                    if (!isAdmin && !deletePassword) {
                      setDeleteError("Password daalein.");
                      return;
                    }
                    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
                    dirty.current = false;
                    edited.current = false;
                    setDeleting(true);
                    try {
                      await onDelete(fields, deletePassword);
                    } catch (e: any) {
                      setDeleteError(e?.message || "Delete nahi hua.");
                    } finally {
                      setDeleting(false);
                    }
                  }}
                  className="btn sm danger bg-red-500 text-white hover:bg-red-600 font-bold px-4 py-2 rounded-xl"
                >
                  Yes, Delete Record
                </button>
              </div>
            </div>
          ) : (
            <div className="flex justify-between gap-3 items-center">
              <div className="text-xs font-bold flex items-center gap-1.5" style={{ color: saveHint === "pending" ? "var(--warn)" : "var(--ok, #2fa262)" }}>
                {saveHint === "pending" ? (
                  <><LoaderCircle size={14} className="spin" /> Saving…</>
                ) : (
                  <><Check size={15} /> Auto-saved to cloud</>
                )}
              </div>

              <button
                onClick={() => setIsConfirmingDelete(true)}
                className="btn danger px-4 py-2.5 rounded-xl font-bold flex items-center gap-1.5 bg-white text-[var(--err)] hover:bg-[var(--err)] hover:text-white text-sm"
              >
                <Trash2 size={15} /> Delete Lead
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
