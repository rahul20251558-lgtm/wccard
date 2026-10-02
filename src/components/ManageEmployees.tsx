import React, { useState } from "react";
import { UserPlus, Key, Trash2, Edit2, Check, X, ShieldAlert } from "lucide-react";

interface ManageEmployeesProps {
  employees: string[];
  employeePasswords: Record<string, string>;
  onSync: (employees: string[], passwords: Record<string, string>) => void;
  toast: (msg: string, type?: "ok" | "warn" | "err") => void;
}

export default function ManageEmployees({
  employees,
  employeePasswords,
  onSync,
  toast,
}: ManageEmployeesProps) {
  const [newEmpName, setNewEmpName] = useState("");
  const [newEmpPassword, setNewEmpPassword] = useState("");
  const [editingEmp, setEditingEmp] = useState<string | null>(null);
  const [editingPassword, setEditingPassword] = useState("");
  const [deletingEmp, setDeletingEmp] = useState<string | null>(null);

  const handleAddEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newEmpName.trim();
    const password = newEmpPassword.trim();

    if (!name) {
      toast("Please enter employee name", "err");
      return;
    }
    if (!password) {
      toast("Please enter employee password", "err");
      return;
    }

    if (name.toLowerCase() === "admin") {
      toast("The name 'Admin' is reserved for the administrator.", "err");
      return;
    }

    // Check if employee already exists (case-insensitive)
    const exists = employees.some((emp) => emp.toLowerCase() === name.toLowerCase());
    if (exists) {
      toast("An employee with this name already exists.", "warn");
      return;
    }

    const updatedEmployees = [...employees, name];
    const updatedPasswords = { ...employeePasswords, [name]: password };

    onSync(updatedEmployees, updatedPasswords);
    setNewEmpName("");
    setNewEmpPassword("");
    toast(`Successfully registered employee: ${name}`, "ok");
  };

  const handleUpdatePassword = (name: string) => {
    const password = editingPassword.trim();
    if (!password) {
      toast("Password cannot be empty.", "err");
      return;
    }

    const updatedPasswords = { ...employeePasswords, [name]: password };
    onSync(employees, updatedPasswords);
    setEditingEmp(null);
    setEditingPassword("");
    toast(`Updated password for ${name}`, "ok");
  };

  const handleDeleteEmployee = (name: string) => {
    if (name.toLowerCase() === "admin") {
      toast("Cannot delete the system Admin account.", "err");
      return;
    }

    const updatedEmployees = employees.filter((emp) => emp !== name);
    const updatedPasswords = { ...employeePasswords };
    delete updatedPasswords[name];

    onSync(updatedEmployees, updatedPasswords);
    setDeletingEmp(null);
    toast(`Removed employee account: ${name}`, "ok");
  };

  return (
    <div className="pad container max-w-4xl mx-auto space-y-6 py-6" id="manage-employees-container">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="h1 flex items-center gap-2 text-[var(--text)]">
            <Key className="text-[var(--blue)]" size={24} />
            <span>Employee Access Credentials</span>
          </h1>
          <p className="sub text-xs text-[var(--muted)]">
            Admin panel to register employee usernames and assign secure login passwords.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Register New Employee Form */}
        <div className="card pad lg:col-span-1 bg-[var(--panel)] border border-[var(--border)] rounded-2xl h-fit">
          <h3 className="font-bold text-sm text-[var(--text)] mb-3 flex items-center gap-2">
            <UserPlus size={16} className="text-[var(--blue)]" />
            <span>Register Employee</span>
          </h3>
          <form onSubmit={handleAddEmployee} className="space-y-4">
            <div>
              <label className="flabel block text-[10px] font-bold text-[var(--faint)] uppercase tracking-wider mb-1">
                Employee Username
              </label>
              <input
                type="text"
                value={newEmpName}
                onChange={(e) => setNewEmpName(e.target.value)}
                placeholder="e.g. rakesh"
                className="w-full text-xs"
                required
              />
            </div>

            <div>
              <label className="flabel block text-[10px] font-bold text-[var(--faint)] uppercase tracking-wider mb-1">
                Login Password
              </label>
              <input
                type="text"
                value={newEmpPassword}
                onChange={(e) => setNewEmpPassword(e.target.value)}
                placeholder="Assign login password"
                className="w-full text-xs"
                required
              />
            </div>

            <button type="submit" className="btn primary w-full justify-center text-xs py-2.5 font-bold">
              <UserPlus size={14} />
              <span>Add Employee Access</span>
            </button>
          </form>

          <div className="mt-4 p-3 bg-blue-500/5 rounded-xl border border-blue-500/10 flex gap-2">
            <ShieldAlert size={16} className="text-[var(--blue)] shrink-0 mt-0.5" />
            <p className="text-[10px] leading-relaxed text-[var(--muted)]">
              Employees can sign in with their assigned username and this custom password. Sirf yahan registered employees hi login kar sakte hain. Password na diya ho to default "12345" hoga.
            </p>
          </div>
        </div>

        {/* Current Employee Credentials List */}
        <div className="card pad lg:col-span-2 bg-[var(--panel)] border border-[var(--border)] rounded-2xl">
          <h3 className="font-bold text-sm text-[var(--text)] mb-4">
            Authorized Users Registry ({employees.length})
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--faint)] font-bold uppercase tracking-wider">
                  <th className="py-2.5 px-3">Username</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">Assigned Password</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {/* Always show admin info as read-only */}
                <tr className="bg-[var(--bg2)]/30">
                  <td className="py-3 px-3 font-bold text-[var(--text)]">admin</td>
                  <td className="py-3 px-3">
                    <span className="badge font-bold px-2 py-0.5 rounded text-[10px] bg-red-500/10 text-red-500 border border-red-500/20">
                      System Admin
                    </span>
                  </td>
                  <td className="py-3 px-3 font-mono font-bold text-[var(--text)]">••••••</td>
                  <td className="py-3 px-3 text-right">
                    <span className="text-[10px] text-[var(--faint)] font-bold">Fixed security</span>
                  </td>
                </tr>

                {/* List of active employees */}
                {employees
                  .filter((emp) => emp.toLowerCase() !== "admin")
                  .map((emp) => {
                    const isEditing = editingEmp === emp;
                    const pwd = employeePasswords[emp] || "12345";

                    return (
                      <tr key={emp} className="hover:bg-[var(--bg2)]/20 transition-colors">
                        <td className="py-3 px-3 font-semibold text-[var(--text)]">{emp}</td>
                        <td className="py-3 px-3">
                          <span className="badge font-semibold px-2 py-0.5 rounded text-[10px] bg-blue-500/10 text-[var(--blue)] border border-blue-500/20">
                            Employee
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editingPassword}
                              onChange={(e) => setEditingPassword(e.target.value)}
                              className="p-1 rounded-lg border text-xs w-full max-w-[150px] bg-[var(--bg)] text-[var(--text)]"
                              autoFocus
                            />
                          ) : (
                            <span className="font-mono font-bold bg-[var(--bg2)] px-2 py-1 rounded text-xs">
                              {pwd}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex gap-1 justify-end">
                            {deletingEmp === emp ? (
                              <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 px-2 py-1 rounded-lg">
                                <span className="text-[10px] font-bold text-red-500 mr-1">Delete?</span>
                                <button
                                  onClick={() => handleDeleteEmployee(emp)}
                                  className="text-[10px] font-bold text-white bg-red-500 hover:bg-red-600 px-1.5 py-0.5 rounded transition-colors"
                                  title="Confirm Delete"
                                >
                                  Yes
                                </button>
                                <button
                                  onClick={() => setDeletingEmp(null)}
                                  className="text-[10px] font-bold text-[var(--text)] bg-[var(--bg2)] border border-[var(--border)] hover:bg-[var(--border)] px-1.5 py-0.5 rounded transition-colors"
                                  title="Cancel"
                                >
                                  No
                                </button>
                              </div>
                            ) : isEditing ? (
                              <>
                                <button
                                  onClick={() => handleUpdatePassword(emp)}
                                  className="p-1 text-green-500 hover:bg-green-500/10 rounded"
                                  title="Save Password"
                                >
                                  <Check size={14} />
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingEmp(null);
                                    setEditingPassword("");
                                  }}
                                  className="p-1 text-gray-400 hover:bg-gray-500/10 rounded"
                                  title="Cancel"
                                >
                                  <X size={14} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => {
                                    setEditingEmp(emp);
                                    setEditingPassword(pwd);
                                    setDeletingEmp(null);
                                  }}
                                  className="p-1 text-[var(--blue)] hover:bg-[var(--blue)]/10 rounded"
                                  title="Edit Password"
                                >
                                  <Edit2 size={13} />
                                </button>
                                <button
                                  onClick={() => {
                                    setDeletingEmp(emp);
                                    setEditingEmp(null);
                                  }}
                                  className="p-1 text-red-500 hover:bg-red-500/10 rounded"
                                  title="Delete Employee"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                {employees.filter((emp) => emp.toLowerCase() !== "admin").length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-[var(--muted)] text-xs">
                      No custom employees registered yet. Registered employees will show up here.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
