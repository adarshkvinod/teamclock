import { esc } from "./utils.js";

/**
 * Small reusable dialog.
 *  openModal({ title, subtitle, body, confirmText, cancelText, wide, onOpen(root), onSubmit(root) })
 *  onSubmit may return false (or throw) to keep the dialog open.
 */
export function openModal({ title, subtitle = "", body, confirmText = "Save", cancelText = "Cancel", wide = false, onOpen, onSubmit }) {
  document.querySelectorAll(".tc-modal-overlay").forEach((n) => n.remove());

  const overlay = document.createElement("div");
  overlay.className = "tc-modal-overlay";
  overlay.innerHTML = `
    <div class="tc-modal ${wide ? "wide" : ""}" role="dialog" aria-modal="true">
      <div class="tc-modal-head">
        <div>
          <h3>${esc(title)}</h3>
          ${subtitle ? `<p>${esc(subtitle)}</p>` : ""}
        </div>
        <button type="button" class="tc-modal-x" data-modal-close aria-label="Close">&times;</button>
      </div>
      <div class="tc-modal-body">${body}</div>
      <div class="tc-modal-foot">
        <span class="tc-modal-err" data-modal-err></span>
        ${cancelText ? `<button type="button" class="select-filter" data-modal-close>${esc(cancelText)}</button>` : ""}
        ${confirmText ? `<button type="button" class="btn-primary" data-modal-ok>${esc(confirmText)}</button>` : ""}
      </div>
    </div>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("open"));

  const close = () => {
    overlay.classList.remove("open");
    setTimeout(() => overlay.remove(), 160);
    document.removeEventListener("keydown", onKey);
  };
  const onKey = (e) => {
    if (e.key === "Escape") close();
  };
  document.addEventListener("keydown", onKey);

  overlay.addEventListener("mousedown", (e) => {
    if (e.target === overlay) close();
  });
  overlay.querySelectorAll("[data-modal-close]").forEach((b) => (b.onclick = close));

  const err = (m) => {
    const el = overlay.querySelector("[data-modal-err]");
    if (el) el.textContent = m || "";
  };

  const ok = overlay.querySelector("[data-modal-ok]");
  if (ok && onSubmit) {
    ok.onclick = async () => {
      ok.disabled = true;
      err("");
      try {
        const r = await onSubmit(overlay, err);
        if (r !== false) close();
      } catch (e) {
        err(e.message || "Something went wrong");
      } finally {
        ok.disabled = false;
      }
    };
  }

  if (onOpen) onOpen(overlay, err);
  overlay.querySelector("input:not([type=hidden]), textarea, select")?.focus();
  return { close, root: overlay };
}
