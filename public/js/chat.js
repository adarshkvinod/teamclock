import { S } from "./state.js";
import { API } from "./api.js";
import { toast } from "./toast.js";
import { openModal } from "./modal.js";
import { esc, user, initial, clock, richText, day, cur } from "./utils.js";

// Vercel (serverless) has no websockets, so the chat polls cheaply: only messages that
// changed since the last poll are returned.
const POLL_MS = 3000;
let timer = null;

const cache = (pid) => (S.chat[pid] ||= { msgs: [], last: 0, loaded: false, draft: "" });

export function stopChat() {
  clearInterval(timer);
  timer = null;
}

const dayLabel = (ts) => {
  const d = day(ts);
  if (d === day(Date.now())) return "Today";
  if (d === day(Date.now() - 864e5)) return "Yesterday";
  return new Date(ts).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
};

function messageHtml(m, prev, me, adm, archived) {
  const sep = !prev || day(prev.at) !== day(m.at) ? `<div class="chat-day"><span>${dayLabel(m.at)}</span></div>` : "";
  if (m.deleted) return `${sep}<div class="chat-msg deleted"><i>This message was deleted</i></div>`;

  const u = user(m.uid);
  const mine = m.uid === me.id;
  const grouped = prev && !prev.deleted && prev.uid === m.uid && m.at - prev.at < 5 * 60e3 && day(prev.at) === day(m.at);
  const pinged = me.username && new RegExp("@" + me.username + "\\b", "i").test(m.text);

  return `${sep}
    <div class="chat-msg ${mine ? "mine" : ""} ${grouped ? "grouped" : ""} ${pinged ? "pinged" : ""}" data-mid="${esc(m.id)}">
      ${grouped ? '<span class="chat-spacer"></span>' : `<span class="mini-avatar">${esc(initial(u?.name))}</span>`}
      <div class="chat-bubble">
        ${grouped ? "" : `<div class="chat-meta"><b>${esc(u?.name || "Someone")}</b>${u?.role === "admin" ? ' <em class="role-tag">Admin</em>' : ""} <small>${clock(m.at)}</small></div>`}
        <div class="chat-text">${richText(m.text)}${m.edited ? ' <small class="edited">(edited)</small>' : ""}</div>
      </div>
      <div class="chat-actions">
        ${mine && !archived ? `<button type="button" data-chat-edit="${esc(m.id)}" title="Edit">✎</button>` : ""}
        ${(mine || adm) && !archived ? `<button type="button" data-chat-del="${esc(m.id)}" title="Delete">🗑</button>` : ""}
      </div>
    </div>`;
}

function paint(me, forceBottom = false) {
  const box = document.getElementById("chatMessages");
  if (!box || !S.projectId) return;
  const c = cache(S.projectId);
  const adm = me.role === "admin";
  const archived = cur()?.status === "archived";

  const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;

  box.innerHTML = c.msgs.length
    ? c.msgs.map((m, i) => messageHtml(m, c.msgs[i - 1], me, adm, archived)).join("")
    : '<div class="chat-empty"><b>No messages yet</b><span>Say hello to the team 👋</span></div>';

  if (forceBottom || atBottom) box.scrollTop = box.scrollHeight;

  box.querySelectorAll("[data-chat-del]").forEach((b) => {
    b.onclick = async () => {
      const ok = await toast.confirm({ title: "Delete message", message: "This message will be removed for everyone.", confirmText: "Delete", isDanger: true });
      if (!ok) return;
      try {
        await API("DELETE", `/projects/${S.projectId}/chat/${b.dataset.chatDel}`);
        const m = c.msgs.find((x) => x.id === b.dataset.chatDel);
        if (m) Object.assign(m, { deleted: true, text: "" });
        paint(me);
      } catch (e) {
        toast.error(e.message || "Couldn't delete the message");
      }
    };
  });

  box.querySelectorAll("[data-chat-edit]").forEach((b) => {
    b.onclick = () => {
      const m = c.msgs.find((x) => x.id === b.dataset.chatEdit);
      if (!m) return;
      openModal({
        title: "Edit message",
        confirmText: "Save",
        body: `<div class="input-group"><textarea id="chatEditBox" class="td-textarea" rows="4" maxlength="2000">${esc(m.text)}</textarea></div>`,
        onSubmit: async (root) => {
          const text = root.querySelector("#chatEditBox").value.trim();
          if (!text) throw new Error("Message can't be empty");
          await API("PATCH", `/projects/${S.projectId}/chat/${m.id}`, { text });
          m.text = text;
          m.edited = true;
          paint(me);
        }
      });
    };
  });
}

export function bindChat(me) {
  stopChat();
  if (S.tab !== "chat" || !S.projectId || !document.getElementById("chatMessages")) return;

  const pid = S.projectId;
  const c = cache(pid);
  const input = document.getElementById("chatInput");

  paint(me, true);

  const markRead = () => {
    S.unread[pid] = 0;
    API("POST", `/projects/${pid}/chat-read`).catch(() => {});
  };

  const poll = async () => {
    if (document.hidden || S.tab !== "chat" || S.projectId !== pid) return;
    try {
      const res = await API("GET", `/projects/${pid}/chat${c.loaded && c.last ? `?after=${c.last}` : ""}`);
      const first = !c.loaded;
      let fromOthers = first;
      for (const m of res.messages) {
        const i = c.msgs.findIndex((x) => x.id === m.id);
        if (i >= 0) c.msgs[i] = m;
        else {
          c.msgs.push(m);
          if (m.uid !== me.id) fromOthers = true;
        }
        c.last = Math.max(c.last, m.u || 0);
      }
      c.loaded = true;
      if (res.messages.length || first) {
        c.msgs.sort((a, b) => a.at - b.at);
        paint(me, first);
      }
      if (fromOthers) markRead();
    } catch (e) {}
  };

  poll();
  timer = setInterval(poll, POLL_MS);

  if (!input) return; // archived: read-only

  input.value = c.draft || "";
  const fit = () => {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 140) + "px";
  };
  fit();
  input.oninput = () => {
    c.draft = input.value;
    fit();
  };

  const send = async () => {
    const text = input.value.trim();
    if (!text) return;
    const btn = document.getElementById("chatSend");
    btn.disabled = true;
    try {
      const { message } = await API("POST", `/projects/${pid}/chat`, { text });
      if (!c.msgs.some((x) => x.id === message.id)) c.msgs.push(message);
      c.last = Math.max(c.last, message.u || 0);
      c.loaded = true;
      input.value = "";
      c.draft = "";
      fit();
      paint(me, true);
    } catch (e) {
      toast.error(e.message || "Message not sent");
    } finally {
      btn.disabled = false;
      input.focus();
    }
  };

  document.getElementById("chatSend").onclick = send;
  input.onkeydown = (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      send();
    }
  };

  document.querySelectorAll("[data-mention]").forEach((b) => {
    b.onclick = () => {
      input.value += (input.value && !/\s$/.test(input.value) ? " " : "") + "@" + b.dataset.mention + " ";
      c.draft = input.value;
      input.focus();
      fit();
    };
  });
}
