UWinTurk – Microtask Marketplace for UWin CS Students

Welcome to UWinTurk, our spin‑off of Amazon Mechanical Turk built by and for University of Windsor Computer Science students. Whether you need a quick code review, help with a data‑gathering chore, or just want to earn campus credit by solving tiny tasks, this is your place.

Features

Unified navigation bar across Home, Login, Register, Worker Dashboard, Worker Profile and Requestor Dashboard for seamless browsing.

User registration and login with secure bcrypt password hashing—and we just finished Microsoft SSO (UWindsor Outlook) integration so you can sign in with your campus account in one click.

Task management: requestors can post new jobs with title, description, deadline and reward; tasks appear instantly in a live‑updating table.

Live updates power both the task dashboard and the worker registry, so everyone sees the latest entries without reloading.

Current Status
What’s working:

Navigation bar and page links

Microsoft SSO via UWindsor Outlook

Registration, login and session‑based authentication

Protected routes for profiles and dashboards

Task creation form and real‑time task list updates

SQLite backend with fully functional API endpoints for users, tasks and profiles

What’s still in progress:

Polished CSS and layout refinements

Task‑to‑worker matchmaking based on skills or availability

Expanded user roles and access controls for true requester vs. worker workflows

Production‑grade features: robust error handling, logging, secure cookies, full test coverage and documentation

Installation & Setup

Clone the repo
git clone https://github.com/raajKainth/turk.git

Install dependencies
cd turk
npm install

Ensure Node.js LTS and build tools are installed if sqlite3 compilation fails

Initialize databases (created automatically on first run) and confirm uploads/resumes directory exists

Start the server
node server.js

Open your browser to http://localhost:3000/login.html

We’ve built this with future employers in mind—clean code, secure auth, real‑world integrations—and we’d love your feedback or contributions!
