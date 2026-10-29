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
