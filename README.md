# TeamClock – deploy on Vercel (free)

## 1. Free database (MongoDB Atlas)
1. Create a free account at mongodb.com/atlas and make a free **M0** cluster.
2. Database Access → add a user with a password.
3. Network Access → Add IP Address → **Allow access from anywhere (0.0.0.0/0)** (Vercel uses changing IPs).
4. Connect → Drivers → copy the connection string (mongodb+srv://...).

## 2. Deploy
1. Put this folder in a GitHub repo, then import it at vercel.com/new (no build settings needed).
   Or run `npx vercel` inside this folder.
2. Project Settings → Environment Variables:
   - MONGODB_URI = your connection string
   - JWT_SECRET  = any long random text
3. Redeploy, open your URL and create the admin account right away (the first visitor becomes admin).

## Local test
npm install, then set MONGODB_URI and JWT_SECRET and run `npx vercel dev`.

## Projects
Work is organised by project. The admin creates projects and picks which employees are members;
employees only see (and can clock in to) projects they belong to. Each project has its own
dashboard, tasks, time tracker, timesheet and member list. The last opened project is remembered
in the browser and reopened automatically.

**Upgrading an existing install:** nothing to run. On the first request after deploy, existing tasks
and time entries are moved into a project called **Docbook**, with all current employees as members
(see `src/services/projects.js`). It is idempotent and tracked in the `meta` collection.
New employees are not added to projects automatically: add them from a project's **Members** tab.

## Team features
- **Task board:** Board / Table / Calendar views; filter by employee, sprint, priority, category, overdue and free-text search; CSV export.
- **Task details:** priority, description, labels, hour estimate, checklist, comments with @mentions, activity history and time logged. Open any card to see them.
- **Sprints:** plan, start and complete sprints per project; backlog; burndown chart; velocity; unfinished tasks carry over or return to the backlog.
- **Project chat:** per-project channel with @mentions, edit/delete and unread badges (polls every few seconds; no websockets needed on Vercel).
- **Notifications:** bell for assignments, comments, mentions, sprint changes and project invites.
- **Reports:** hours by member/category, task status, weekly throughput, on-time delivery, team summary (CSV export).
- **Time tracking:** manual time entries, timesheet range/employee filters, one-click timer from a task card.
- **Accounts:** employees can change their own password; "My Tasks" shows work across all projects.

Employees can see every task in the projects they belong to (view-only for teammates' tasks) and can add tasks for themselves.
Time sessions stay private to each employee; the admin sees all.
Indexes for the new collections are created automatically on first connection.
