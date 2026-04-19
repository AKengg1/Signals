# Signals 🗼 
 
> **Hire on merit. Not on digree.**
 
Signals is a full-stack web platform that connects students and recruiters based purely on **skills and real work** — not college names or backgrounds. Students showcase projects, earn skill-based points, and get discovered by recruiters who see only what truly matters: what you can build.

## Table of Contents
 
- [About the Project](#about-the-project)
- [Core Features](#core-features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)

## About the Project
 
The hiring industry has a bias problem. Resumes filter by college names before skills ever get evaluated. Signals flips this model:
 
- Students Push their  real projects **inside the platform**
- Recruiters browse **anonymous profiles** — no college name, no location bias
- A points-based merit system surfaces the most capable candidates, not the most credentialed ones
This is the MVP — built with  HTML, Tailwind CSS, JavaScript on the frontend, and Node.js + Express + PostgreSQL on the backend.
 
---
 
## Core Features
 
### For Students
- Sign up and create a profile (college field hidden from recruiters)
- Add skills via tags (e.g. `React`, `Python`, `UI/UX`, `Marketing`)
- Submit projects with GitHub links, live demos, descriptions, or domain URL
- Earn merit points based on project completion, peer reviews, and recruiter engagement
- View leaderboards and skill rankings
- Take short skill challenges and tasks
### For Recruiters (HRs)
- Create a company profile
- Search and filter candidates by skills, project category, and points
- View anonymous student profiles — only projects, skills, and scores are shown
- Shortlist candidates and contact them via in-app messaging
- Post mini-projects or tasks for students to complete
- Also ,they can conduct a compitition ,where various students can take part to complete the project in given time .
### For Admins
- Manage users and moderate projects
- Control scoring algorithm parameters
- Handle reports and flag suspicious activity
---
 
## Tech Stack
 
| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS,  JavaScript |
| Backend | Node.js, Express.js |
| Database | PostgreSQL |

 
---
 
## Project Structure
 
```
signals 🗼 /
├── public/                  # Static frontend files
│   ├── auth.html           # Landing page
│   ├── dashboaerd.html
│   ├── index.html
│   ├── signals-shared.html
│   └── signals.css
│
├── server/
│   ├── index.js             # Express app entry point
│   ├── config/
│   │   └── db.js            # PostgreSQL connection (pg)
│   ├── routes/
│   │   ├── auth.routes.js          # /api/auth
│   │   ├── candidate.routes.js         # /api/users
│   │   ├── projects.routes.js      # /api/projects
│   ├── middleware/
│   │   └── authenticate.js
|       |__errorHandlers.js
|       |__validate.js
│   └── controllers/
│       ├── auth.Controller.js
│       ├── candidate.Controller.js
│       └── projects.Controller.js
│
├── schema.sql
|          
│
├── .env.example
├── .gitignore
├── package.json
└── README.md
``` 
> **Never commit your `.env` file.** It is already listed in `.gitignore`.


---
 
<p align="center">Built with purpose — because what you build matters more than where you studied.</p>
 

