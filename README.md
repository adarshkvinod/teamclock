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
