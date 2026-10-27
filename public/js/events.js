import { S, clearTokenStorage, TASK_TYPES, TYPES, EMPLOYEE_ROLES, ROLES } from "./state.js";
import { $, uid, user, active, weekStart, day, tname, hrs, worked, esc } from "./utils.js";
import { db, authenticate } from "./api.js";
import { toast } from "./toast.js";

export function bindEvents(me) {
    const on = (id, fn) => {
        const el = $(id);
        if (el) el.onclick = fn;
    };

    // Tab switching
    document.querySelectorAll("[data-t]").forEach((b) => {
        b.onclick = () => {
            S.tab = b.dataset.t;
            window.dispatchEvent(new CustomEvent("app:render"));
        };
    });

    // Logout with confirmation
    on("#out", async () => {
        const s = active(S.me);
        const ok = await toast.confirm({
            title: s ? "Active Shift Running" : "Log Out",
            message: s
                ? "You are currently clocked in. Your timer will continue running until you clock out. Are you sure you want to log out?"
                : "Are you sure you want to log out of your account?",
            confirmText: "Log Out",
            cancelText: "Stay Logged In",
            isDanger: Boolean(s)
        });

        if (!ok) return;

        clearTokenStorage();
        window.dispatchEvent(new CustomEvent("app:render"));
        toast.info("Signed out successfully.");
    });

    // Sidebar controls
    on("#sideBtnClockIn", () => {
        S.tab = "track";
        window.dispatchEvent(new CustomEvent("app:render"));
    });

    on("#sideBtnClockOut", async () => {
        const s = active(me.id);
        if (!s) return;
        const br = (s.breaks || []).map((b) => (b.e ? b : { ...b, e: Date.now() }));
        await db.doc("sessions/" + s.id).update({ end: Date.now(), breaks: br });
        toast.success("Shift ended.", "Clocked Out");
    });

    // Toggle between Assigned Tasks dropdown and Custom Task input
    const taskSelectWrap = $("#taskSelectWrap");
    const taskCustomWrap = $("#taskCustomWrap");
    const customWk = $("#customWk");
    const wk = $("#wk");
    const toggleBtn = $("#btnToggleTaskMode");

    if (toggleBtn) {
        toggleBtn.onclick = () => {
            const isCustom = taskCustomWrap.style.display !== "none";
            if (isCustom) {
                taskCustomWrap.style.display = "none";
                taskSelectWrap.style.display = "block";
                if (wk.value === "__custom__") wk.value = "";
                toggleBtn.textContent = "✏️ Type custom task";
            } else {
                taskSelectWrap.style.display = "none";
                taskCustomWrap.style.display = "block";
                toggleBtn.textContent = "📋 Choose assigned task";
                customWk.focus();
            }
        };
    }

    if (wk) {
        wk.onchange = () => {
            if (wk.value === "__custom__") {
                taskSelectWrap.style.display = "none";
                taskCustomWrap.style.display = "block";
                if (toggleBtn) toggleBtn.textContent = "📋 Choose assigned task";
                customWk.focus();
            }
        };
    }

    // Time tracker: Clock In
    on("#ci", async () => {
        try {
            const isCustom = taskCustomWrap && taskCustomWrap.style.display !== "none";
            let chosenTask = "";

            if (isCustom) {
                chosenTask = customWk ? customWk.value.trim() : "";
            } else {
                chosenTask = wk && wk.value !== "__custom__" ? wk.value : "";
            }

            await db.doc("sessions/" + uid()).set({
                uid: me.id,
                type: $("#wt").value,
                taskId: chosenTask,
                start: Date.now(),
                end: null,
                breaks: []
            });
            toast.success("Shift started! Timer is now active.", "Clocked In");
        } catch (err) {
            toast.error(err.message || "Failed to start shift");
        }
    });

    on("#co", async () => {
        const s = active(me.id);
        if (!s) return;
        const ok = await toast.confirm({
            title: "End Shift",
            message: "Are you ready to clock out and complete your work session?",
            confirmText: "End Shift",
            isDanger: false
        });
        if (!ok) return;

        try {
            const br = (s.breaks || []).map((b) => (b.e ? b : { ...b, e: Date.now() }));
            await db.doc("sessions/" + s.id).update({ end: Date.now(), breaks: br });
            toast.success("Shift finished and recorded in timesheets.", "Clocked Out");
        } catch (err) {
            toast.error(err.message || "Failed to clock out");
        }
    });

    on("#bk", async () => {
        const s = active(me.id);
        if (!s) return;
        const br = [...(s.breaks || [])],
            o = br.find((x) => !x.e);
        if (o) {
            o.e = Date.now();
            toast.success("Break finished. Resuming work timer.");
        } else {
            br.push({ s: Date.now(), e: null });
            toast.warning("Work timer paused. Enjoy your break!", "On Break");
        }
        await db.doc("sessions/" + s.id).update({ breaks: br.map((x) => ({ ...x })) });
    });

    // Task creation
    on("#ac", async () => {
        const t = $("#nt").value.trim(),
            a = $("#na").value,
            d = $("#nd").value,
            type = $("#ntype") ? $("#ntype").value : (TASK_TYPES || TYPES)[0];

        if (!t || !a || !d) {
            toast.warning("Please fill in task title, assignee, and deadline.");
            return;
        }
        try {
            await db.doc("tasks/" + uid()).set({
                title: t,
                assignee: a,
                deadline: d,
                type: type,
                status: "To do",
                created: Date.now()
            });
            $("#nt").value = "";
            toast.success(`Task "${t}" (${type}) has been assigned.`, "Task Created");
        } catch (err) {
            toast.error(err.message || "Failed to assign task");
        }
    });

    // Status dropdown with fixed positioning
    document.querySelectorAll(".status-dropdown").forEach((dropdown) => {
        const trigger = dropdown.querySelector(".status-dropdown-trigger");
        const menu = dropdown.querySelector(".status-dropdown-menu");
        const taskId = dropdown.dataset.taskId;

        trigger.onclick = (e) => {
            e.stopPropagation();
            const isOpen = dropdown.classList.contains("open");

            document.querySelectorAll(".status-dropdown.open").forEach((d) => {
                d.classList.remove("open");
            });

            if (!isOpen) {
                const rect = trigger.getBoundingClientRect();
                const menuHeight = 135;
                const spaceBelow = window.innerHeight - rect.bottom;

                if (spaceBelow < menuHeight && rect.top > menuHeight) {
                    menu.style.top = `${rect.top - menuHeight - 6}px`;
                } else {
                    menu.style.top = `${rect.bottom + 6}px`;
                }
                menu.style.left = `${rect.left}px`;
                dropdown.classList.add("open");
            }
        };

        dropdown.querySelectorAll(".status-option-btn").forEach((optBtn) => {
            optBtn.onclick = async (e) => {
                e.stopPropagation();
                const newStatus = optBtn.dataset.statusVal;
                dropdown.classList.remove("open");

                try {
                    await db.doc("tasks/" + taskId).update({ status: newStatus });
                    toast.success(`Task status updated to "${newStatus}".`, "Status Updated");
                } catch (err) {
                    toast.error(err.message || "Failed to update status");
                }
            };
        });
    });

    // Delete Task
    document.querySelectorAll("[data-dt]").forEach((b) => {
        b.onclick = async () => {
            const ok = await toast.confirm({
                title: "Delete Task",
                message: "This will permanently delete this task for all assignees.",
                confirmText: "Delete",
                isDanger: true
            });
            if (ok) {
                await db.doc("tasks/" + b.dataset.dt).delete();
                toast.info("Task removed successfully.");
            }
        };
    });

    // Employee creation with multiple roles
    on("#ae", async () => {
        const n = $("#en").value.trim(),
            u = $("#eu").value.trim().toLowerCase(),
            p = $("#ep").value;

        const selectedRoles = Array.from(document.querySelectorAll("input[name='empRole']:checked")).map(
            (cb) => cb.value
        );

        if (!n || !u || p.length < 4) {
            toast.warning("Please complete name, username, and password (4+ chars).");
            return;
        }
        if (selectedRoles.length === 0) {
            toast.warning("Please select at least one role for this employee.");
            return;
        }
        if (S.users.some((x) => x.username === u)) {
            toast.error("That username is already taken. Please choose another.");
            return;
        }

        try {
            await db.doc("users/" + uid()).set({
                name: n,
                username: u,
                password: p,
                role: "employee",
                roles: selectedRoles,
                workType: selectedRoles.join(", ")
            });
            $("#en").value = "";
            $("#eu").value = "";
            $("#ep").value = "";
            document.querySelectorAll("input[name='empRole']").forEach((cb) => (cb.checked = false));
            toast.success(`Account created for ${n} (${selectedRoles.join(", ")}).`, "Employee Added");
        } catch (err) {
            toast.error(err.message || "Failed to create employee");
        }
    });

    // Custom Password Reset Modal
    document.querySelectorAll("[data-rp]").forEach((b) => {
        b.onclick = async () => {
            const empId = b.dataset.rp;
            const emp = user(empId);
            const empName = emp ? emp.name : "Employee";

            const newPassword = await toast.prompt({
                title: "Reset Password",
                message: `Set a new login password for ${empName}:`,
                placeholder: "Enter 4+ characters",
                confirmText: "Update Password"
            });

            if (newPassword === null) return;

            const trimmed = newPassword.trim();
            if (trimmed.length < 4) {
                toast.warning("Password must be at least 4 characters long.", "Invalid Password");
                return;
            }

            b.disabled = true;
            const prevText = b.textContent;
            b.textContent = "Updating...";

            try {
                await db.doc("users/" + empId).update({ password: trimmed });
                toast.success(`Password for ${empName} has been updated.`, "Password Reset");
            } catch (err) {
                toast.error(err.message || "Failed to update password");
            } finally {
                b.disabled = false;
                b.textContent = prevText;
            }
        };
    });

    // Remove Employee
    document.querySelectorAll("[data-du]").forEach((b) => {
        b.onclick = async () => {
            const ok = await toast.confirm({
                title: "Remove Employee",
                message: "Are you sure you want to remove this employee? They will no longer be able to log in.",
                confirmText: "Remove",
                isDanger: true
            });
            if (ok) {
                await db.doc("users/" + b.dataset.du).delete();
                toast.info("Employee account removed.");
            }
        };
    });

    // Export CSV
    on("#csv", () => {
        const adm = me.role === "admin";
        const rows = (adm ? S.sessions : S.sessions.filter((x) => x.uid === me.id && x.start >= weekStart())).sort(
            (a, b) => b.start - a.start
        );
        if (!rows.length) {
            toast.info("No time entries found to export.");
            return;
        }
        const q = (v) => '"' + String(v ?? "").replace(/"/g, '""') + '"';
        const csv = [
            "Employee,Date,Work type,Task,Clock in,Clock out,Break minutes,Hours",
            ...rows.map((x) => [
                user(x.uid)?.name,
                day(x.start),
                x.type,
                tname(x.taskId),
                new Date(x.start).toLocaleTimeString(),
                x.end ? new Date(x.end).toLocaleTimeString() : "Active",
                Math.round((x.breaks || []).reduce((a, b) => a + ((b.e || Date.now()) - b.s), 0) / 6e4),
                hrs(worked(x))
            ].map(q).join(","))
        ].join("\n");

        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
        a.download = "teamclock_report.csv";
        a.click();
        toast.success("Timesheet report downloaded successfully.", "Export Ready");
    });
}

// Global Event Delegation for Edit Employee Modal
document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-edit-emp]");
    if (!btn) return;

    const empId = btn.dataset.editEmp;
    const emp = user(empId);
    if (!emp) return;

    const currentRoles =
        emp.roles && emp.roles.length
            ? emp.roles
            : emp.workType
                ? emp.workType.split(",").map((r) => r.trim())
                : [];

    const rolesList = EMPLOYEE_ROLES || ROLES || [
        "Mobile App Developer",
        "Web Developer",
        "Backend Developer",
        "Product Designer",
        "Project Manager"
    ];

    // Remove any stale modals
    const existing = document.querySelector(".edit-emp-overlay");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.className = "edit-emp-overlay";
    overlay.innerHTML = `
    <div class="edit-emp-card">
      <div class="edit-emp-header">
        <div class="edit-emp-icon">
          <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </div>
        <div class="edit-emp-title">
          <h3>Edit Employee</h3>
          <p>Updating profile for <b>@${esc(emp.username)}</b></p>
        </div>
      </div>

      <div class="input-group" style="margin-bottom: 16px;">
        <label>Full Name</label>
        <input type="text" id="editEmpName" value="${esc(emp.name)}" placeholder="Full name">
      </div>

      <div class="input-group" style="margin-bottom: 24px;">
        <label>Assigned Roles (Click to toggle)</label>
        <div class="role-selector-group">
          ${rolesList
            .map((role) => {
                const isChecked = currentRoles.includes(role);
                return `
              <label class="role-checkbox-pill">
                <input type="checkbox" name="editEmpRole" value="${esc(role)}" ${isChecked ? "checked" : ""}>
                <span class="role-pill-content">
                  <svg class="check-svg" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                  ${esc(role)}
                </span>
              </label>
            `;
            })
            .join("")}
        </div>
      </div>

      <div class="edit-emp-actions">
  <button type="button" class="btn-prompt-cancel" id="btnCancelEditEmp">Cancel</button>
  <button type="button" class="btn-prompt-submit" id="btnSaveEditEmp">Save Changes</button>
</div>
    </div>
  `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("open"));

    const close = () => {
        overlay.classList.remove("open");
        setTimeout(() => overlay.remove(), 200);
    };

    overlay.querySelector("#btnCancelEditEmp").onclick = close;
    overlay.onclick = (event) => {
        if (event.target === overlay) close();
    };

    overlay.querySelector("#btnSaveEditEmp").onclick = async () => {
        const newName = overlay.querySelector("#editEmpName").value.trim();
        const selectedRoles = Array.from(overlay.querySelectorAll("input[name='editEmpRole']:checked")).map(
            (cb) => cb.value
        );

        if (!newName) {
            toast.warning("Employee name cannot be empty.", "Validation Error");
            return;
        }

        if (selectedRoles.length === 0) {
            toast.warning("Please select at least one role.", "Validation Error");
            return;
        }

        const saveBtn = overlay.querySelector("#btnSaveEditEmp");
        saveBtn.disabled = true;
        saveBtn.textContent = "Saving...";

        try {
            await db.doc("users/" + empId).update({
                name: newName,
                roles: selectedRoles,
                workType: selectedRoles.join(", ")
            });

            close();
            toast.success(`Updated ${newName}'s details successfully.`, "Employee Updated");
        } catch (err) {
            toast.error(err.message || "Failed to update employee");
            saveBtn.disabled = false;
            saveBtn.textContent = "Save Changes";
        }
    };
});

// Global outside click and scroll listeners
document.addEventListener("click", () => {
    document.querySelectorAll(".status-dropdown.open").forEach((d) => d.classList.remove("open"));
});
window.addEventListener(
    "scroll",
    () => {
        document.querySelectorAll(".status-dropdown.open").forEach((d) => d.classList.remove("open"));
    },
    true
);
window.addEventListener("resize", () => {
    document.querySelectorAll(".status-dropdown.open").forEach((d) => d.classList.remove("open"));
});

export function bindAuthEvents(isSetup) {
    const on = (id, fn) => {
        const el = $(id);
        if (el) el.onclick = fn;
    };

    if (isSetup) {
        on("#sb", async () => {
            const n = $("#sn").value.trim(),
                u = $("#su").value.trim().toLowerCase(),
                p = $("#sp").value;
            if (!n || !u || p.length < 4) {
                $("#se").textContent = "Fill all fields (password 4+ characters).";
                return;
            }
            try {
                await authenticate("/setup", { name: n, username: u, password: p });
            } catch (e) {
                $("#se").textContent = e.message;
            }
        });
    } else {
        const go = async () => {
            try {
                await authenticate("/login", {
                    username: $("#lu").value.trim().toLowerCase(),
                    password: $("#lp").value
                });
            } catch (e) {
                $("#le").textContent = e.message;
            }
        };
        on("#lb", go);
        if ($("#lp")) $("#lp").onkeydown = (e) => { if (e.key === "Enter") go(); };
        if ($("#lu")) $("#lu").onkeydown = (e) => { if (e.key === "Enter") go(); };
    }
}