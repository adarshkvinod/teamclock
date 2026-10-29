import { S, clearTokenStorage, saveProjectSelection, TASK_TYPES, TYPES, EMPLOYEE_ROLES, ROLES } from "./state.js";
import { $, uid, user, active, weekStart, day, tname, hrs, worked, esc, tstate, withLoading, cur, pname, pSessions } from "./utils.js";
import { db, authenticate } from "./api.js";
import { toast } from "./toast.js";
import { drawDashboardCharts } from "./charts.js";

// Calendar State
let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth();

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function renderThemedCalendar() {
  const menu = $("#deadlinePickerMenu");
  const hiddenInput = $("#nd");
  const lbl = $("#ndLabel");
  const wrap = $("#deadlinePickerWrap");
  if (!menu || !hiddenInput) return;

  const selectedVal = hiddenInput.value;
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(calYear, calMonth, 0).getDate();

  let daysHtml = "";

  for (let i = firstDay - 1; i >= 0; i--) {
    daysHtml += `<div class="cal-day other-month">${daysInPrevMonth - i}</div>`;
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const isSel = dStr === selectedVal ? "selected" : "";
    const isToday = dStr === todayStr ? "today" : "";
    daysHtml += `<button type="button" class="cal-day ${isSel} ${isToday}" data-cal-date="${dStr}">${d}</button>`;
  }

  const totalCells = firstDay + daysInMonth;
  const nextMonthDays = (7 - (totalCells % 7)) % 7;
  for (let d = 1; d <= nextMonthDays; d++) {
    daysHtml += `<div class="cal-day other-month">${d}</div>`;
  }

  menu.innerHTML = `
    <div class="cal-header">
      <button type="button" class="cal-nav-btn" id="calPrev">
        <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <span class="cal-title">${MONTHS[calMonth]} ${calYear}</span>
      <button type="button" class="cal-nav-btn" id="calNext">
        <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
    </div>
    <div class="cal-weekdays">
      <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
    </div>
    <div class="cal-days">${daysHtml}</div>
    <div class="cal-footer">
      <button type="button" class="cal-btn-clear" id="calClear">Clear</button>
      <button type="button" class="cal-btn-today" id="calToday">Today</button>
    </div>
  `;

  menu.onclick = (e) => e.stopPropagation();

  const prevBtn = menu.querySelector("#calPrev");
  if (prevBtn) {
    prevBtn.onclick = (e) => {
      e.stopPropagation();
      calMonth--;
      if (calMonth < 0) {
        calMonth = 11;
        calYear--;
      }
      renderThemedCalendar();
    };
  }

  const nextBtn = menu.querySelector("#calNext");
  if (nextBtn) {
    nextBtn.onclick = (e) => {
      e.stopPropagation();
      calMonth++;
      if (calMonth > 11) {
        calMonth = 0;
        calYear++;
      }
      renderThemedCalendar();
    };
  }

  menu.querySelectorAll(".cal-day[data-cal-date]").forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const chosen = btn.dataset.calDate;
      hiddenInput.value = chosen;
      if (lbl) lbl.textContent = chosen;
      wrap?.classList.remove("open");
    };
  });

  const todayBtn = menu.querySelector("#calToday");
  if (todayBtn) {
    todayBtn.onclick = (e) => {
      e.stopPropagation();
      calYear = today.getFullYear();
      calMonth = today.getMonth();
      hiddenInput.value = todayStr;
      if (lbl) lbl.textContent = todayStr;
      wrap?.classList.remove("open");
    };
  }

  const clearBtn = menu.querySelector("#calClear");
  if (clearBtn) {
    clearBtn.onclick = (e) => {
      e.stopPropagation();
      hiddenInput.value = "";
      if (lbl) lbl.textContent = "Select deadline...";
      wrap?.classList.remove("open");
    };
  }
}

// Helper: Render quick-action buttons based on status
function renderQuickActionButtons(taskId, status) {
  return `
    ${status !== "To do" ? `
      <button type="button" class="btn-kanban-shift" data-move-task="${taskId}" data-move-to="To do" title="Move to To do">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        <span>To do</span>
      </button>
    ` : ""}
    ${status !== "In progress" ? `
      <button type="button" class="btn-kanban-shift" data-move-task="${taskId}" data-move-to="In progress" title="Move to In progress">
        <span>In progress</span>
      </button>
    ` : ""}
    ${status !== "Done" ? `
      <button type="button" class="btn-kanban-shift" data-move-task="${taskId}" data-move-to="Done" title="Move to Done">
        <span>Done</span>
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
    ` : ""}
  `;
}

// Helper: Refresh column counters
function updateKanbanCounts() {
  document.querySelectorAll(".kanban-column").forEach((col) => {
    const colKey = col.dataset.colStatus;
    const body = col.querySelector(".kanban-column-body");
    const countBadge = col.querySelector(".kanban-count-badge");
    if (body && countBadge) {
      const cardsCount = body.querySelectorAll(".kanban-card").length;
      countBadge.textContent = cardsCount;
    }
  });
}

// ================= OPTIMISTIC TASK STATUS MOVER =================
async function moveTaskOptimistically(taskId, newStatus, cardElement) {
  const task = S.tasks?.find((t) => t.id === taskId);
  if (!task || task.status === newStatus) return;

  const oldStatus = task.status;
  const card = cardElement || document.querySelector(`.kanban-card[data-task-id="${taskId}"]`);
  const sourceCol = card?.closest(".kanban-column-body");
  const targetCol = document.querySelector(`.kanban-column-body[data-status-col="${newStatus}"]`);

  // 1. Instantly update in-memory state
  task.status = newStatus;

  // 2. Instantly move DOM node without any delay or flashback
  if (card && targetCol) {
    targetCol.appendChild(card);
    targetCol.querySelector(".kanban-column-empty")?.remove();

    if (sourceCol && !sourceCol.querySelector(".kanban-card")) {
      const colName = sourceCol.dataset.statusCol || "column";
      sourceCol.innerHTML = `<div class="kanban-column-empty"><span>No tasks in ${colName.toLowerCase()}</span></div>`;
    }

    updateKanbanCounts();

    // Instantly update badge and state
    const [lbl, cls] = tstate(task);
    const tag = card.querySelector(".tag-status");
    if (tag) {
      tag.className = `tag-status ${cls}`;
      tag.textContent = lbl;
    }

    const actionsWrap = card.querySelector(".kanban-quick-actions");
    if (actionsWrap) {
      actionsWrap.innerHTML = renderQuickActionButtons(task.id, newStatus);
    }
  }

  // 3. Asynchronously sync to database in background
  try {
    await db.doc("tasks/" + taskId).update({ status: newStatus });
    toast.success(`Moved to "${newStatus}".`, "Status Updated");
  } catch (err) {
    // Revert state if backend call fails
    task.status = oldStatus;
    toast.error(err.message || "Failed to update task status");
    window.dispatchEvent(new CustomEvent("app:render"));
  }
}

// ================= SOLID POINTER DRAG CONTROLLER =================
function bindSolidKanbanDrag() {
  document.querySelectorAll(".kanban-card").forEach((card) => {
    card.onpointerdown = (e) => {
      // Don't drag if clicking buttons or actions inside the card
      if (e.target.closest("button") || e.target.closest("input") || e.target.closest(".tag-status")) {
        return;
      }

      // Left-click / touch only
      if (e.button !== 0 && e.pointerType === "mouse") return;

      const taskId = card.dataset.taskId;
      if (!taskId) return;

      const rect = card.getBoundingClientRect();
      const startX = e.clientX;
      const startY = e.clientY;
      const offsetX = startX - rect.left;
      const offsetY = startY - rect.top;

      let isDragging = false;
      let floatingCard = null;

      const onPointerMove = (moveEvt) => {
        const dist = Math.hypot(moveEvt.clientX - startX, moveEvt.clientY - startY);

        if (!isDragging) {
          if (dist > 5) {
            isDragging = true;

            // Create solid 100% opaque floating element (NO GHOST)
            floatingCard = card.cloneNode(true);
            floatingCard.classList.add("kanban-card-floating");
            floatingCard.style.width = `${rect.width}px`;
            floatingCard.style.left = `${moveEvt.clientX - offsetX}px`;
            floatingCard.style.top = `${moveEvt.clientY - offsetY}px`;
            document.body.appendChild(floatingCard);

            // Mark slot on the board
            card.classList.add("kanban-card-placeholder");
            document.body.classList.add("is-kanban-dragging-active");
          } else {
            return;
          }
        }

        if (floatingCard) {
          floatingCard.style.left = `${moveEvt.clientX - offsetX}px`;
          floatingCard.style.top = `${moveEvt.clientY - offsetY}px`;
        }

        // Highlight column under cursor
        const elemUnder = document.elementFromPoint(moveEvt.clientX, moveEvt.clientY);
        const colBody = elemUnder?.closest(".kanban-column-body");

        document.querySelectorAll(".kanban-column-body").forEach((c) => {
          c.classList.toggle("is-dragover", c === colBody);
        });
      };

      const onPointerUp = (upEvt) => {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointercancel", onPointerUp);
        document.body.classList.remove("is-kanban-dragging-active");

        if (!isDragging) return;

        if (floatingCard) {
          floatingCard.remove();
          floatingCard = null;
        }

        card.classList.remove("kanban-card-placeholder");
        document.querySelectorAll(".kanban-column-body").forEach((c) => c.classList.remove("is-dragover"));

        // Detect target column directly under pointer
        const elemUnder = document.elementFromPoint(upEvt.clientX, upEvt.clientY);
        const targetCol = elemUnder?.closest(".kanban-column-body");

        if (targetCol) {
          const targetStatus = targetCol.dataset.statusCol;
          const currentTask = S.tasks?.find((t) => t.id === taskId);
          if (targetStatus && currentTask && currentTask.status !== targetStatus) {
            moveTaskOptimistically(taskId, targetStatus, card);
          }
        }
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerUp);
    };
  });
}

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
    if (S.projectId) {
      S.tab = "track";
    } else {
      toast.info("Open a project and start your shift from its Time Tracker.", "Choose a Project");
      S.tab = "projects";
    }
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
      const isCustom = taskCustomWrap && taskCustomWrap.style.display !== "none";
      if (isCustom) {
        if (taskCustomWrap) taskCustomWrap.style.display = "none";
        if (taskSelectWrap) taskSelectWrap.style.display = "block";
        if (wk && wk.value === "__custom__") {
          wk.value = "";
          const lbl = taskSelectWrap?.querySelector(".custom-select-label");
          if (lbl) lbl.textContent = "– General Work / No specific task –";
        }
        toggleBtn.textContent = "✏️ Type custom task";
      } else {
        if (taskSelectWrap) taskSelectWrap.style.display = "none";
        if (taskCustomWrap) taskCustomWrap.style.display = "block";
        toggleBtn.textContent = "📋 Choose assigned task";
        if (customWk) customWk.focus();
      }
    };
  }

  if (wk) {
    wk.onchange = () => {
      if (wk.value === "__custom__") {
        if (taskSelectWrap) taskSelectWrap.style.display = "none";
        if (taskCustomWrap) taskCustomWrap.style.display = "block";
        if (toggleBtn) toggleBtn.textContent = "📋 Choose assigned task";
        if (customWk) customWk.focus();
      }
    };
  }

  // Time tracker: Clock In
  on("#ci", async () => {
    const isCustom = taskCustomWrap && taskCustomWrap.style.display !== "none";
    let chosenTask = "";

    if (isCustom) {
      chosenTask = customWk ? customWk.value.trim() : "";
    } else {
      chosenTask = wk && wk.value !== "__custom__" ? wk.value : "";
    }

    const wtInput = $("#wt");
    const workType = wtInput ? (wtInput.value || wtInput.textContent || "").trim() : "";
    const defaultType = (TASK_TYPES || TYPES || ["Mobile App Development"])[0];

    await withLoading("#ci", async () => {
      try {
        await db.doc("sessions/" + uid()).set({
          uid: me.id,
          projectId: S.projectId,
          type: workType || defaultType,
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
  });

  // Time tracker: Clock Out
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

    await withLoading("#co", async () => {
      try {
        const br = (s.breaks || []).map((b) => (b.e ? b : { ...b, e: Date.now() }));
        await db.doc("sessions/" + s.id).update({ end: Date.now(), breaks: br });
        toast.success("Shift finished and recorded in timesheets.", "Clocked Out");
      } catch (err) {
        toast.error(err.message || "Failed to clock out");
      }
    });
  });

  // Time tracker: Break toggle
  on("#bk", async () => {
    const s = active(me.id);
    if (!s) return;

    await withLoading("#bk", async () => {
      const br = [...(s.breaks || [])];
      const openBreak = br.find((x) => !x.e);

      if (openBreak) {
        openBreak.e = Date.now();
        toast.success("Break finished. Resuming work timer.");
      } else {
        br.push({ s: Date.now(), e: null });
        toast.warning("Work timer paused. Enjoy your break!", "On Break");
      }
      await db.doc("sessions/" + s.id).update({ breaks: br.map((x) => ({ ...x })) });
    });
  });

  // Themed Deadline Datepicker Direct Trigger
  const dateWrap = $("#deadlinePickerWrap");
  const dateBtn = $("#deadlinePickerBtn");
  const hiddenNd = $("#nd");

  if (dateBtn && dateWrap) {
    dateBtn.onclick = (e) => {
      e.stopPropagation();
      const isOpen = dateWrap.classList.contains("open");

      document.querySelectorAll(".custom-select-wrap.open").forEach((w) => w.classList.remove("open"));
      document.querySelectorAll(".status-dropdown.open").forEach((d) => d.classList.remove("open"));

      if (isOpen) {
        dateWrap.classList.remove("open");
      } else {
        if (hiddenNd && hiddenNd.value) {
          const parts = hiddenNd.value.split("-");
          if (parts.length === 3) {
            const y = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10) - 1;
            if (!isNaN(y) && !isNaN(m)) {
              calYear = y;
              calMonth = m;
            }
          }
        }
        renderThemedCalendar();
        dateWrap.classList.add("open");
      }
    };
  }

  // Task creation with field validation
  on("#ac", async () => {
    const t = $("#nt") ? $("#nt").value.trim() : "";
    const a = $("#na") ? $("#na").value : "";
    const d = $("#nd") ? $("#nd").value : "";
    const type = $("#ntype") ? $("#ntype").value : (TASK_TYPES || TYPES)[0];

    if (!t) {
      toast.warning("Please enter a task title.", "Title Required");
      $("#nt")?.focus();
      return;
    }
    if (!a) {
      toast.warning("Please select an assignee.", "Assignee Required");
      return;
    }
    if (!d) {
      toast.warning("Please choose a deadline date.", "Deadline Required");
      return;
    }

    await withLoading("#ac", async () => {
      try {
        await db.doc("tasks/" + uid()).set({
          title: t,
          projectId: S.projectId,
          assignee: a,
          deadline: d,
          type: type,
          status: "To do",
          created: Date.now()
        });
        if ($("#nt")) $("#nt").value = "";
        toast.success(`Task "${t}" (${type}) has been assigned.`, "Task Created");
      } catch (err) {
        toast.error(err.message || "Failed to assign task");
      }
    });
  });

  // Task View Mode Switcher (Kanban vs Table)
  document.querySelectorAll("[data-view-mode]").forEach((btn) => {
    btn.onclick = () => {
      S.taskViewMode = btn.dataset.viewMode;
      window.dispatchEvent(new CustomEvent("app:render"));
    };
  });

  // Bind the solid pointer drag controller (NO GHOSTS)
  bindSolidKanbanDrag();

  // Kanban Card Delete (Admin)
  document.querySelectorAll(".btn-action-del-card").forEach((btn) => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const taskId = btn.dataset.dt;
      const ok = await toast.confirm({
        title: "Delete Task",
        message: "This will permanently delete this task for all assignees.",
        confirmText: "Delete",
        isDanger: true
      });
      if (ok) {
        try {
          await db.doc("tasks/" + taskId).delete();
          toast.info("Task removed successfully.");
        } catch (err) {
          toast.error(err.message || "Failed to delete task");
        }
      }
    };
  });

  // Status dropdown with fixed positioning
  document.querySelectorAll(".status-dropdown").forEach((dropdown) => {
    const trigger = dropdown.querySelector(".status-dropdown-trigger");
    const menu = dropdown.querySelector(".status-dropdown-menu");
    const taskId = dropdown.dataset.taskId;

    if (!trigger || !menu) return;

    trigger.onclick = (e) => {
      e.stopPropagation();
      const isOpen = dropdown.classList.contains("open");

      document.querySelectorAll(".status-dropdown.open").forEach((d) => d.classList.remove("open"));
      document.querySelectorAll(".custom-select-wrap.open").forEach((d) => d.classList.remove("open"));
      document.querySelectorAll(".custom-datepicker-wrap.open").forEach((d) => d.classList.remove("open"));

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
        await moveTaskOptimistically(taskId, newStatus);
      };
    });
  });

  // Delete Task in Table
  document.querySelectorAll("[data-dt]").forEach((b) => {
    if (b.classList.contains("btn-action-del-card")) return;
    b.onclick = async () => {
      const ok = await toast.confirm({
        title: "Delete Task",
        message: "This will permanently delete this task for all assignees.",
        confirmText: "Delete",
        isDanger: true
      });
      if (ok) {
        await withLoading(b, async () => {
          try {
            await db.doc("tasks/" + b.dataset.dt).delete();
            toast.info("Task removed successfully.");
          } catch (err) {
            toast.error(err.message || "Failed to delete task");
          }
        });
      }
    };
  });

  // Employee creation
  on("#ae", async () => {
    const n = $("#en") ? $("#en").value.trim() : "";
    const u = $("#eu") ? $("#eu").value.trim().toLowerCase() : "";
    const p = $("#ep") ? $("#ep").value : "";

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

    await withLoading("#ae", async () => {
      try {
        await db.doc("users/" + uid()).set({
          name: n,
          username: u,
          password: p,
          role: "employee",
          roles: selectedRoles,
          workType: selectedRoles.join(", ")
        });
        if ($("#en")) $("#en").value = "";
        if ($("#eu")) $("#eu").value = "";
        if ($("#ep")) $("#ep").value = "";
        document.querySelectorAll("input[name='empRole']").forEach((cb) => (cb.checked = false));
        toast.success(`Account created for ${n} (${selectedRoles.join(", ")}).`, "Employee Added");
      } catch (err) {
        toast.error(err.message || "Failed to create employee");
      }
    });
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

      await withLoading(b, async () => {
        try {
          await db.doc("users/" + empId).update({ password: trimmed });
          toast.success(`Password for ${empName} has been updated.`, "Password Reset");
        } catch (err) {
          toast.error(err.message || "Failed to update password");
        }
      });
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
        await withLoading(b, async () => {
          try {
            await db.doc("users/" + b.dataset.du).delete();
            toast.info("Employee account removed.");
          } catch (err) {
            toast.error(err.message || "Failed to remove employee");
          }
        });
      }
    };
  });

  // Export CSV
  on("#csv", () => {
    const adm = me.role === "admin";
    const base = pSessions();
    const rows = (adm ? base : base.filter((x) => x.uid === me.id && x.start >= weekStart())).sort(
      (a, b) => b.start - a.start
    );
    if (!rows.length) {
      toast.info("No time entries found to export.");
      return;
    }
    const q = (v) => '"' + String(v ?? "").replace(/"/g, '""') + '"';
    const csv = [
      "Project,Employee,Date,Work type,Task,Clock in,Clock out,Break minutes,Hours",
      ...rows.map((x) => [
        pname(x.projectId),
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
    const slug = (cur()?.name || "all_projects").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    a.download = `teamclock_${slug || "report"}.csv`;
    a.click();
    toast.success("Timesheet report downloaded successfully.", "Export Ready");
  });

  // ================= PROJECTS =================
  const openProject = (id) => {
    if (!id) return;
    saveProjectSelection(me.id, id);
    S.tab = "dashboard";
    window.dispatchEvent(new CustomEvent("app:render"));
  };

  document.querySelectorAll("[data-open-project]").forEach((card) => {
    card.onclick = () => openProject(card.dataset.openProject);
    card.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openProject(card.dataset.openProject);
      }
    };
  });

  on("#btnAllProjects", () => {
    saveProjectSelection(me.id, null);
    S.tab = "projects";
    window.dispatchEvent(new CustomEvent("app:render"));
  });

  on("#btnNewProject", () => {
    S.showProjForm = !S.showProjForm;
    window.dispatchEvent(new CustomEvent("app:render"));
  });

  on("#pcCancel", () => {
    S.showProjForm = false;
    window.dispatchEvent(new CustomEvent("app:render"));
  });

  const checkedValues = (name) =>
    Array.from(document.querySelectorAll(`input[name='${name}']:checked`)).map((cb) => cb.value);

  on("#pc", async () => {
    const name = $("#pn") ? $("#pn").value.trim() : "";
    const start = $("#ps") ? $("#ps").value : "";
    const end = $("#pe") ? $("#pe").value : "";

    if (!name) {
      toast.warning("Please enter a project name.", "Name Required");
      $("#pn")?.focus();
      return;
    }
    if (start && end && end < start) {
      toast.warning("The end date can't be before the start date.", "Check Dates");
      return;
    }

    await withLoading("#pc", async () => {
      try {
        const id = uid();
        await db.doc("projects/" + id).set({
          name,
          description: $("#pd") ? $("#pd").value.trim() : "",
          start,
          end,
          members: checkedValues("projMember")
        });
        S.showProjForm = false;
        toast.success(`Project "${name}" created.`, "Project Created");
        openProject(id);
      } catch (err) {
        toast.error(err.message || "Failed to create project");
      }
    });
  });

  on("#pdSave", async () => {
    const p = cur();
    if (!p) return;
    const name = $("#pdName") ? $("#pdName").value.trim() : "";
    const start = $("#pdStart") ? $("#pdStart").value : "";
    const end = $("#pdEnd") ? $("#pdEnd").value : "";

    if (!name) {
      toast.warning("Project name can't be empty.", "Name Required");
      return;
    }
    if (start && end && end < start) {
      toast.warning("The end date can't be before the start date.", "Check Dates");
      return;
    }

    await withLoading("#pdSave", async () => {
      try {
        await db.doc("projects/" + p.id).update({
          name,
          description: $("#pdDesc") ? $("#pdDesc").value.trim() : "",
          start,
          end
        });
        toast.success("Project details saved.", "Saved");
      } catch (err) {
        toast.error(err.message || "Failed to save project");
      }
    });
  });

  on("#memSave", async () => {
    const p = cur();
    if (!p) return;
    await withLoading("#memSave", async () => {
      try {
        await db.doc("projects/" + p.id).update({ members: checkedValues("memMember") });
        toast.success("Project members updated.", "Saved");
      } catch (err) {
        toast.error(err.message || "Failed to update members");
      }
    });
  });

  on("#pArchive", async () => {
    const p = cur();
    if (!p) return;
    const archiving = p.status !== "archived";
    const ok = await toast.confirm({
      title: archiving ? "Archive Project" : "Restore Project",
      message: archiving
        ? `"${p.name}" will become read-only: no new tasks or shifts. All history is kept.`
        : `"${p.name}" will become active again.`,
      confirmText: archiving ? "Archive" : "Restore",
      isDanger: archiving
    });
    if (!ok) return;

    await withLoading("#pArchive", async () => {
      try {
        await db.doc("projects/" + p.id).update({ status: archiving ? "archived" : "active" });
        toast.success(archiving ? "Project archived." : "Project restored.");
      } catch (err) {
        toast.error(err.message || "Failed to update project");
      }
    });
  });

  on("#pDelete", async () => {
    const p = cur();
    if (!p) return;
    const ok = await toast.confirm({
      title: "Delete Project",
      message: `Permanently delete "${p.name}"? This only works if it has no tasks or time entries.`,
      confirmText: "Delete",
      isDanger: true
    });
    if (!ok) return;

    await withLoading("#pDelete", async () => {
      try {
        await db.doc("projects/" + p.id).delete();
        saveProjectSelection(me.id, null);
        S.tab = "projects";
        toast.info("Project deleted.");
        window.dispatchEvent(new CustomEvent("app:render"));
      } catch (err) {
        toast.error(err.message || "Failed to delete project");
      }
    });
  });

  // Chart Filter Dropdown
  const filterDropdown = $("#chartFilterDropdown");
  const filterBtn = $("#chartFilterBtn");
  const filterLabel = $("#chartFilterLabel");
  const rangeSubtitle = $("#chartRangeSubtitle");

  if (filterBtn && filterDropdown) {
    filterBtn.onclick = (e) => {
      e.stopPropagation();
      filterDropdown.classList.toggle("open");
    };

    filterDropdown.querySelectorAll(".chart-filter-opt").forEach((opt) => {
      opt.onclick = (e) => {
        e.stopPropagation();
        const days = parseInt(opt.dataset.days, 10);
        const labelText = opt.querySelector("span")?.textContent || "";

        filterDropdown.querySelectorAll(".chart-filter-opt").forEach((o) => {
          o.classList.remove("active");
          const chk = o.querySelector(".opt-check");
          if (chk) chk.remove();
        });

        opt.classList.add("active");
        opt.insertAdjacentHTML(
          "beforeend",
          `<svg class="opt-check" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`
        );

        if (filterLabel) filterLabel.textContent = labelText;
        if (rangeSubtitle) rangeSubtitle.textContent = `Daily hours logged across the ${labelText.toLowerCase()}`;
        filterDropdown.classList.remove("open");

        drawDashboardCharts(days);
      };
    });
  }
}

// Global Event Delegation for Quick Action Shift Buttons
document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-move-task]");
  if (!btn) return;

  const taskId = btn.dataset.moveTask;
  const targetStatus = btn.dataset.moveTo;
  if (!taskId || !targetStatus) return;

  moveTaskOptimistically(taskId, targetStatus);
});

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

  const cancelBtn = overlay.querySelector("#btnCancelEditEmp");
  if (cancelBtn) cancelBtn.onclick = close;
  overlay.onclick = (event) => {
    if (event.target === overlay) close();
  };

  const saveBtn = overlay.querySelector("#btnSaveEditEmp");
  if (saveBtn) {
    saveBtn.onclick = async () => {
      const newName = overlay.querySelector("#editEmpName")?.value.trim();
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

      await withLoading(saveBtn, async () => {
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
        }
      });
    };
  }
});

// ================= GLOBAL CUSTOM SELECT DELEGATION =================
document.addEventListener("click", (e) => {
  const trigger = e.target.closest(".custom-select-trigger");
  const opt = e.target.closest(".custom-select-opt");
  const allSelects = document.querySelectorAll(".custom-select-wrap");

  if (opt) {
    const wrap = opt.closest(".custom-select-wrap");
    if (!wrap) return;

    const val = opt.dataset.val ?? "";
    const labelSpan = opt.querySelector("span");
    const labelText = labelSpan ? labelSpan.textContent.trim() : opt.textContent.trim();
    const hiddenInput = wrap.querySelector("input[type='hidden']");
    const labelDisplay = wrap.querySelector(".custom-select-label");

    if (hiddenInput) {
      hiddenInput.value = val;
      hiddenInput.dispatchEvent(new Event("change", { bubbles: true }));
    }
    if (labelDisplay) {
      labelDisplay.textContent = labelText;
    }

    wrap.querySelectorAll(".custom-select-opt").forEach((o) => {
      o.classList.remove("selected");
      const chk = o.querySelector(".opt-check");
      if (chk) chk.remove();
    });

    opt.classList.add("selected");
    opt.insertAdjacentHTML(
      "beforeend",
      `<svg class="opt-check" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`
    );

    wrap.classList.remove("open");

    if (hiddenInput && hiddenInput.id === "wk" && val === "__custom__") {
      const taskSelectWrap = document.getElementById("taskSelectWrap");
      const taskCustomWrap = document.getElementById("taskCustomWrap");
      const customWk = document.getElementById("customWk");
      const toggleBtn = document.getElementById("btnToggleTaskMode");

      if (taskSelectWrap) taskSelectWrap.style.display = "none";
      if (taskCustomWrap) taskCustomWrap.style.display = "block";
      if (toggleBtn) toggleBtn.textContent = "📋 Choose assigned task";
      if (customWk) customWk.focus();
    }
    return;
  }

  if (trigger) {
    e.stopPropagation();
    const wrap = trigger.closest(".custom-select-wrap");
    if (!wrap) return;

    const isOpen = wrap.classList.contains("open");

    allSelects.forEach((s) => {
      if (s !== wrap) s.classList.remove("open");
    });
    document.querySelectorAll(".status-dropdown.open").forEach((d) => d.classList.remove("open"));
    document.querySelectorAll(".custom-datepicker-wrap.open").forEach((d) => d.classList.remove("open"));

    wrap.classList.toggle("open", !isOpen);
    return;
  }

  allSelects.forEach((s) => s.classList.remove("open"));
  document.querySelectorAll(".status-dropdown.open").forEach((d) => d.classList.remove("open"));
  document.querySelectorAll(".custom-datepicker-wrap.open").forEach((d) => d.classList.remove("open"));
});

// Scroll & Resize listeners
window.addEventListener(
  "scroll",
  (e) => {
    if (
      e.target &&
      e.target.classList &&
      (e.target.classList.contains("custom-select-menu") ||
        e.target.classList.contains("status-dropdown-menu") ||
        e.target.classList.contains("custom-datepicker-menu"))
    ) {
      return;
    }
    document.querySelectorAll(".status-dropdown.open").forEach((d) => d.classList.remove("open"));
    document.querySelectorAll(".custom-select-wrap.open").forEach((d) => d.classList.remove("open"));
    document.querySelectorAll(".custom-datepicker-wrap.open").forEach((d) => d.classList.remove("open"));
  },
  true
);

window.addEventListener("resize", () => {
  document.querySelectorAll(".status-dropdown.open").forEach((d) => d.classList.remove("open"));
  document.querySelectorAll(".custom-select-wrap.open").forEach((d) => d.classList.remove("open"));
  document.querySelectorAll(".custom-datepicker-wrap.open").forEach((d) => d.classList.remove("open"));
});

export function bindAuthEvents(isSetup) {
  const on = (id, fn) => {
    const el = $(id);
    if (el) el.onclick = fn;
  };

  if (isSetup) {
    const setupSubmit = async () => {
      const n = $("#sn") ? $("#sn").value.trim() : "";
      const u = $("#su") ? $("#su").value.trim().toLowerCase() : "";
      const p = $("#sp") ? $("#sp").value : "";

      if (!n || !u || p.length < 4) {
        if ($("#se")) $("#se").textContent = "Fill all fields (password 4+ characters).";
        return;
      }
      if ($("#se")) $("#se").textContent = "";

      await withLoading("#sb", async () => {
        try {
          await authenticate("/setup", { name: n, username: u, password: p });
        } catch (e) {
          if ($("#se")) $("#se").textContent = e.message;
        }
      });
    };

    on("#sb", setupSubmit);
  } else {
    const go = async () => {
      const u = $("#lu")?.value.trim().toLowerCase();
      const p = $("#lp")?.value;

      if (!u || !p) {
        if ($("#le")) $("#le").textContent = "Please enter both username and password.";
        return;
      }
      if ($("#le")) $("#le").textContent = "";

      await withLoading("#lb", async () => {
        try {
          await authenticate("/login", {
            username: u,
            password: p
          });
        } catch (e) {
          if ($("#le")) $("#le").textContent = e.message;
        }
      });
    };

    on("#lb", go);
    if ($("#lp")) $("#lp").onkeydown = (e) => { if (e.key === "Enter") go(); };
    if ($("#lu")) $("#lu").onkeydown = (e) => { if (e.key === "Enter") go(); };
  }
}