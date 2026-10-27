import { S, clearTokenStorage, TASK_TYPES, TYPES } from "./state.js";
import { $, uid, user, active, weekStart, day, tname, hrs, worked } from "./utils.js";
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

  // Time tracker screen actions
  on("#ci", async () => {
    try {
      await db.doc("sessions/" + uid()).set({
        uid: me.id,
        type: $("#wt").value,
        taskId: $("#wk").value,
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

  // Close dropdowns on outside clicks / scrolls
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