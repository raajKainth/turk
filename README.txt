Welcome to our implmentation of Amazon's Mechanical Turk, @ uWin CS edition!

Features
Navigation Bar:
A unified navbar across all pages for easy navigation between Home, Login, Register, Worker Dashboard, Worker Profile, and Requestor Dashboard.

User Registration & Login:

Workers can register via a form that accepts personal details and a PDF resume upload.
Passwords are securely hashed using bcrypt.
Login functionality uses express-session for persistent authentication.
Task Management:

Requestors (or workers acting in a requestor role) can create tasks by entering a title, description, deadline, and reward.
A live-updating task table displays all tasks immediately after creation.
Live Table Updates:
Both the task dashboard and the worker registration table dynamically fetch and display the latest entries from the database.

Current Status
What Is Working
Navigation:
The navbar is implemented and provides links to all major pages.

User Authentication:

Registration and login for workers function correctly using express-session.
Passwords are hashed and stored securely.
Protected routes (such as profile pages) correctly check for an active session.
Task Creation and Live Updates:

A form allows users to create new tasks.
The tasks table dynamically updates to display the newly added tasks without requiring a page reload.
Basic Backend Functionality:

The project uses SQLite for storing worker and task data.
API endpoints for registering, logging in, adding tasks, fetching tasks, and fetching worker profiles are functional.
What Is Not Finished or Missing
CSS & Styling:
The current CSS is basic and unfinished. The design and layout need further refinement.

Task Matchmaking:
There is currently no matchmaking logic that assigns tasks to workers based on skills or other criteria.

SSO UWindsor Outlook Authentication:
Single Sign-On (SSO) integration using UWindsor Outlook is not implemented.

Additional User Roles:
The system currently primarily supports worker registration. Additional roles (such as requestors with different privileges) and their corresponding access controls need to be developed.

Production-Grade Features:

Error handling, logging, and security features (e.g., secure cookies for sessions in production) require further enhancement.
The project does not yet have extensive documentation or tests.

Installation & Setup
Clone the Repository:

git clone https://github.com/raajKainth/turk
Install Dependencies: Navigate to the project root and install all Node.js dependencies:

npm install
Note: If you encounter issues with native modules like sqlite3, consider using a stable Node.js LTS version and ensure your Python/build tools are properly configured.

Set Up the Database:

The server will automatically initialize the SQLite databases (workers.db and tasks.db) if they do not exist.
Ensure that the uploads/resumes directory exists (the server will attempt to create it if it does not).
Run the Server: Open a terminal, navigate to the server directory, and run:

node server.js

Serve the Frontend:
http://localhost:3000/login.html