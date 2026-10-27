import { esc } from "./utils.js";

export const toast = {
  container: null,

  init() {
    if (!this.container) {
      this.container = document.createElement("div");
      this.container.id = "toast-container";
      document.body.appendChild(this.container);
    }
  },

  show({ type = "info", title = "", message = "", duration = 3500 }) {
    this.init();

    const icons = {
      success: `<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`,
      error: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
      warning: `<svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
      info: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`
    };

    const card = document.createElement("div");
    card.className = `toast-card toast-${type}`;
    card.innerHTML = `
      <div class="toast-icon">${icons[type] || icons.info}</div>
      <div class="toast-body">
        ${title ? `<div class="toast-title">${esc(title)}</div>` : ""}
        <div class="toast-message">${esc(message)}</div>
      </div>
      <button class="toast-close" aria-label="Close">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
      <div class="toast-progress"></div>
    `;

    this.container.appendChild(card);
    requestAnimationFrame(() => card.classList.add("show"));

    const dismiss = () => {
      card.classList.remove("show");
      card.classList.add("hide");
      setTimeout(() => card.remove(), 300);
    };

    card.querySelector(".toast-close").onclick = dismiss;
    const autoDismiss = setTimeout(dismiss, duration);
    card.onmouseenter = () => clearTimeout(autoDismiss);
  },

  success(message, title = "Success") {
    this.show({ type: "success", title, message });
  },

  error(message, title = "Error") {
    this.show({ type: "error", title, message });
  },

  warning(message, title = "Warning") {
    this.show({ type: "warning", title, message });
  },

  info(message, title = "Notice") {
    this.show({ type: "info", title, message });
  },

  confirm({ title = "Are you sure?", message, confirmText = "Confirm", cancelText = "Cancel", isDanger = true }) {
    return new Promise((resolve) => {
      const existing = document.querySelector(".confirm-overlay");
      if (existing) existing.remove();

      const overlay = document.createElement("div");
      overlay.className = "confirm-overlay";
      overlay.innerHTML = `
        <div class="confirm-dialog">
          <div class="confirm-dialog-icon ${isDanger ? "danger" : "primary"}">
            ${
              isDanger
                ? `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`
                : `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`
            }
          </div>
          <h3>${esc(title)}</h3>
          <p>${esc(message)}</p>
          <div class="confirm-actions">
            <button class="btn-confirm-cancel">${esc(cancelText)}</button>
            <button class="btn-confirm-accept ${isDanger ? "danger" : ""}">${esc(confirmText)}</button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay.classList.add("open"));

      const close = (result) => {
        overlay.classList.remove("open");
        setTimeout(() => overlay.remove(), 250);
        resolve(result);
      };

      overlay.querySelector(".btn-confirm-cancel").onclick = () => close(false);
      overlay.querySelector(".btn-confirm-accept").onclick = () => close(true);
      overlay.onclick = (e) => {
        if (e.target === overlay) close(false);
      };
    });
  },

  prompt({
    title = "Reset Password",
    message = "Enter new password (minimum 4 characters):",
    placeholder = "New password...",
    confirmText = "Update Password",
    cancelText = "Cancel"
  }) {
    return new Promise((resolve) => {
      const existing = document.querySelector(".prompt-modal-overlay");
      if (existing) existing.remove();

      const overlay = document.createElement("div");
      overlay.className = "prompt-modal-overlay";
      overlay.innerHTML = `
        <div class="prompt-modal-card">
          <div class="prompt-icon-badge">
            <svg viewBox="0 0 24 24"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
          <h3>${esc(title)}</h3>
          <p>${esc(message)}</p>
          <div class="prompt-input-wrapper">
            <input type="password" id="customPromptInput" class="prompt-input" placeholder="${esc(placeholder)}" autocomplete="new-password">
          </div>
          <div class="prompt-actions">
            <button type="button" class="btn-prompt-cancel">${esc(cancelText)}</button>
            <button type="button" class="btn-prompt-submit">${esc(confirmText)}</button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay.classList.add("open"));

      const input = overlay.querySelector("#customPromptInput");
      input.focus();

      const close = (value) => {
        overlay.classList.remove("open");
        setTimeout(() => overlay.remove(), 200);
        resolve(value);
      };

      overlay.querySelector(".btn-prompt-cancel").onclick = () => close(null);
      overlay.querySelector(".btn-prompt-submit").onclick = () => close(input.value);

      input.onkeydown = (e) => {
        if (e.key === "Enter") close(input.value);
        if (e.key === "Escape") close(null);
      };

      overlay.onclick = (e) => {
        if (e.target === overlay) close(null);
      };
    });
  }
  
};