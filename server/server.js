// server.js
require('dotenv').config();
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const fileUpload = require('express-fileupload');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const msal = require('@azure/msal-node'); // For confidential client flows

// Load sensitive config from environment variables
const CLIENT_ID = process.env.CLIENT_ID;
const TENANT_ID = process.env.TENANT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REPLY_ADDRESS = process.env.REPLY_ADDRESS || "http://localhost:3000/home.html";

const app = express();
const port = 3000;

// const postedTasks = [];
const appliedTasks = [];

// Serve static files (ensure your folder structure matches these paths)
app.use(express.static(path.join(__dirname, '../public')));
app.use('/assets', express.static(path.join(__dirname, '../assets')));

// Allowed origins list for CORS
const allowedOrigins = ['http://localhost:3000', 'http://127.0.0.1:5500'];

// Dynamic CORS configuration
app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, origin);
    } else {
      return callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Preflight OPTIONS handling
app.options('*', cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, origin);
    } else {
      return callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Serve static files from the public folder and other directories as needed.
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(express.static('uploads/resumes'));
app.use(express.static(path.join(__dirname, '../public')));

// Default route: serve home.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'home.html'));
});

// Other middleware setups
app.use(bodyParser.json());
app.use(fileUpload());

// Setup express-session middleware
app.use(session({
  secret: 'your-secret-key', // Replace with a secure, random key in production
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 30 * 60 * 1000, // Session expires in 30 minutes
    secure: false          // Set to true in production with HTTPS
  }
}));

// Ensure the uploads/resumes directory exists
if (!fs.existsSync('./uploads/resumes')) {
  fs.mkdirSync('./uploads/resumes', { recursive: true });
}

/* ---------------------------
   MSAL Confidential Client Setup for Microsoft SSO
   --------------------------- */
const msalConfig = {
  auth: {
    clientId: "ad50374a-bac1-4031-911f-9c4715fa4414",
    authority: "https://login.microsoftonline.com/12f933b3-3d61-4b19-9a4d-689021de8cc9",
    clientSecret: your-secret-key,
    redirectUri:  'http://localhost:3000/home.html'
  }
};

const confidentialClient = new msal.ConfidentialClientApplication(msalConfig);

/* ---------------------------
   Endpoint to handle Microsoft SSO callback
   --------------------------- */
app.get('/ms-callback', async (req, res) => {
  const authCode = req.query.code;
  if (!authCode) {
    return res.status(400).send('Missing code parameter');
  }
  const tokenRequest = {
    code: authCode,
    scopes: ["User.Read"],
    redirectUri: REPLY_ADDRESS
  };
  try {
    const tokenResponse = await confidentialClient.acquireTokenByCode(tokenRequest);
    // Process the token response as needed (e.g., set session variables)
    res.json(tokenResponse);
  } catch (error) {
    console.error('Error acquiring token:', error);
    res.status(500).send(error);
  }
});

/* ---------------------------
   Endpoints for Workers
   --------------------------- */

// Worker Registration Endpoint
app.post('/registerWorker', (req, res) => {
  if (req.session.requestor) {
    return res.status(400).json({ error: 'You are signed in as a requestor. Please log out before registering as a worker.' });
  }

  const { name, email, password, program, skills, experience } = req.body;

  if (!req.files || !req.files.resume) {
    console.log("Received registration request:", req.body);
    return res.status(400).json({ error: 'Resume file is required' });
  }

  console.log("✅ Resume received:", req.files.resume.name);
  console.log("✅ User Data:", req.body);

  const resumeFile = req.files.resume;

  if (resumeFile.mimetype !== 'application/pdf') {
    return res.status(400).json({ error: 'Only PDF files are allowed' });
  }

  bcrypt.hash(password, 10, (err, hashedPassword) => {
    if (err) {
      return res.status(500).json({ error: 'Error hashing password' });
    }

    const resumePath = `uploads/resumes/${Date.now()}_${resumeFile.name}`;
    resumeFile.mv(resumePath, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Error saving file', details: err.message });
      }

      const workersDb = new sqlite3.Database('./workers.db');
      const stmt = workersDb.prepare(`
        INSERT INTO workers (name, email, password, resume, program, skills, experience, verification_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(name, email, hashedPassword, resumePath, program || '', skills || '', experience || '', false, function (err) {
        if (err) {
          workersDb.close();
          return res.status(500).json({ error: err.message });
        } else {
          res.status(200).json({
            id: this.lastID,
            name,
            email,
            resume: resumePath,
            program,
            skills,
            experience,
            verification_status: false,
            created_at: new Date().toISOString(),
          });
          workersDb.close();
        }
      });
      stmt.finalize();
    });
  });
});

// Worker Login Endpoint
app.post('/login', (req, res) => {
  if (req.session.requestor) {
    return res.status(400).json({ error: 'You are signed in as a requestor. Please log out before logging in as a worker.' });
  }

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const workersDb = new sqlite3.Database('./workers.db');
  workersDb.get('SELECT * FROM workers WHERE email = ?', [email], (err, row) => {
    if (err) {
      workersDb.close();
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      workersDb.close();
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    bcrypt.compare(password, row.password, (err, result) => {
      if (err) {
        workersDb.close();
        return res.status(500).json({ error: 'Error comparing passwords' });
      }
      if (!result) {
        workersDb.close();
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      req.session.user = {
        id: row.id,
        name: row.name,
        email: row.email,
        resume: row.resume,
        program: row.program,
        skills: row.skills,
        experience: row.experience,
        userType: 'worker'
      };

      res.status(200).json({
        message: 'Login successful',
        user: req.session.user
      });
      workersDb.close();
    });
  });
});

// Middleware to ensure a worker is authenticated via session
function ensureWorkerAuthenticated(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized access: Please log in as a worker.' });
}

// API to reupload resume (worker)
app.post('/reuploadResume', ensureWorkerAuthenticated, (req, res) => {
  if (!req.files || !req.files.resume) {
    return res.status(400).json({ error: 'Resume file is required' });
  }

  const resumeFile = req.files.resume;

  if (resumeFile.mimetype !== 'application/pdf') {
    return res.status(400).json({ error: 'Only PDF files are allowed' });
  }

  const newResumePath = `uploads/resumes/${Date.now()}_${resumeFile.name}`;
  resumeFile.mv(newResumePath, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Error saving file', details: err.message });
    }

    const workersDb = new sqlite3.Database('./workers.db');
    const userId = req.session.user.id;
    const stmt = workersDb.prepare('UPDATE workers SET resume = ? WHERE id = ?');
    stmt.run(newResumePath, userId, function(err) {
      if (err) {
        workersDb.close();
        return res.status(500).json({ error: err.message });
      }
      req.session.user.resume = newResumePath;
      res.status(200).json({
        message: 'Resume updated successfully',
        resume: newResumePath
      });
      workersDb.close();
    });
    stmt.finalize();
  });
});

// API to fetch worker profile using session authentication
app.get('/profile', ensureWorkerAuthenticated, (req, res) => {
  const workersDb = new sqlite3.Database('./workers.db');
  const { id } = req.session.user;
  workersDb.get('SELECT id, name, email, resume, program, skills, experience FROM workers WHERE id = ?', [id], (err, row) => {
    if (err) {
      workersDb.close();
      return res.status(500).json({ error: 'Database error' });
    }
    if (!row) {
      workersDb.close();
      return res.status(404).json({ error: 'Profile not found' });
    }
    const resumeUrl = row.resume ? `http://localhost:3000/${row.resume}` : null;
    res.status(200).json({
      id: row.id,
      name: row.name,
      email: row.email,
      resume: resumeUrl,
      program: row.program,
      skills: row.skills,
      experience: row.experience,
    });
    workersDb.close();
  });
});

// API to get all workers' information (excluding passwords)
app.get('/getWorkers', (req, res) => {
  const workersDb = new sqlite3.Database('./workers.db');
  workersDb.all('SELECT id, name, email, program, skills, experience, verification_status, created_at FROM workers', (err, rows) => {
    if (err) {
      workersDb.close();
      return res.status(500).json({ error: err.message });
    }
    res.status(200).json(rows);
    workersDb.close();
  });
});

// API to handle worker logout (destroy session and clear cookie)
app.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ error: 'Failed to log out' });
    }
    res.clearCookie('connect.sid');
    res.status(200).json({ message: 'Logged out successfully' });
  });
});

/* ---------------------------
   Endpoints for Requestors & Tasks
   --------------------------- */

// Use workertask.db for tasks.
const tasksDb = new sqlite3.Database('./workertask.db', (err) => {
  if (err) {
    console.error("Error opening workertask.db:", err);
  } else {
    tasksDb.run(`CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      description TEXT,
      deadline TEXT,
      reward TEXT,
      username TEXT
    )`, (err) => {
      if (err) {
        console.error("Error creating tasks table:", err);
      } else {
        console.log("Tasks table is ready.");
      }
    });
  }
});

// --- Create an applications table to store task applications ---
tasksDb.run(`CREATE TABLE IF NOT EXISTS applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  taskId INTEGER,
  workerProfile TEXT,
  FOREIGN KEY(taskId) REFERENCES tasks(id)
)`, (err) => {
  if (err) {
    console.error("Error creating applications table:", err);
  } else {
    console.log("Applications table is ready.");
  }
});

// Requestor Registration Endpoint
app.post('/registerRequestor', (req, res) => {
  if (req.session.user) {
    return res.status(400).json({ error: 'You are signed in as a worker. Please log out before registering as a requestor.' });
  }

  const { username, password } = req.body;
  req.session.requestor = { username };
  res.status(200).json({ username });
});

// Requestor Login Endpoint
app.post('/loginRequestor', (req, res) => {
  if (req.session.user) {
    return res.status(400).json({ error: 'You are signed in as a worker. Please log out before logging in as a requestor.' });
  }

  const { username, password } = req.body;
  if (username && password) {
    req.session.requestor = { username };
    res.status(200).json({ user: { username } });
  } else {
    res.status(401).json({ error: 'Invalid credentials.' });
  }
});

// Middleware to ensure a requestor is authenticated via session
function ensureRequestorAuthenticated(req, res, next) {
  if (req.session && req.session.requestor) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized access: Please log in as a requestor.' });
}

// Endpoint to post a new task (for requestors)
app.post('/postTask', (req, res) => {
  if (!req.session || !req.session.requestor) {
    return res.status(401).json({ error: 'Unauthorized. Please log in as a requestor.' });
  }
  
  const { title, description, deadline, reward } = req.body;
  const username = req.session.requestor.username;
  
  if (!title || !description || !deadline || !reward) {
    return res.status(400).json({ error: 'Please provide title, description, deadline (YYYY-MM-DD), and reward.' });
  }
  
  tasksDb.run(
    `INSERT INTO tasks (title, description, deadline, reward, username) VALUES (?, ?, ?, ?, ?)`,
    [title, description, deadline, reward, username],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      } else {
        return res.status(200).json({ message: 'Task posted successfully!', taskId: this.lastID });
      }
    }
  );
});

// Endpoint to get tasks posted by a specific requestor
app.get('/getRequestorTasks', (req, res) => {
  const username = req.query.username;
  if (!username) {
    return res.status(400).json({ error: 'Username is required as a query parameter.' });
  }
  
  tasksDb.all(`SELECT * FROM tasks WHERE username = ?`, [username], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    return res.status(200).json(rows);
  });
});

// Endpoint to get all tasks (for workers to view)
app.get('/getAllTasks', (req, res) => {
  tasksDb.all(`SELECT * FROM tasks`, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.status(200).json(rows);
  });
});

// --- Updated /applyTask endpoint to store applications with formatted profile ---
app.post('/applyTask', (req, res) => {
  const { taskId, workerProfile } = req.body;
  if (!taskId || !workerProfile) {
    return res.status(400).json({ error: 'Missing taskId or workerProfile.' });
  }
  
  // Format the worker profile so it matches the expected structure for display:
  const formattedProfile = {
    username: workerProfile.email, // using email as the unique identifier
    fullName: workerProfile.name,
    profileInfo: `Program: ${workerProfile.program || 'N/A'}, Skills: ${workerProfile.skills || 'N/A'}, Experience: ${workerProfile.experience || 'N/A'}`
  };

  console.log(`Worker ${formattedProfile.username} applied for task ${taskId}`);
  
  // Insert the formatted application into the applications table
  tasksDb.run(
    `INSERT INTO applications (taskId, workerProfile) VALUES (?, ?)`,
    [taskId, JSON.stringify(formattedProfile)],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.status(200).json({ message: 'Application submitted. The requestor has been notified.' });
    }
  );
});

// --- New endpoint to fetch task applicants ---
app.get('/getTaskApplicants', (req, res) => {
  const taskId = req.query.taskId;
  if (!taskId) {
    return res.status(400).json({ error: 'Missing taskId query parameter.' });
  }
  
  tasksDb.all(
    `SELECT workerProfile FROM applications WHERE taskId = ?`,
    [taskId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      // Parse the JSON stored in workerProfile for each row
      const applicants = rows.map(row => JSON.parse(row.workerProfile));
      res.status(200).json(applicants);
    }
  );
});

app.post('/applyTask', (req, res) => {
  const { workerEmail, taskId } = req.body;
  if (!workerEmail || !taskId) {
    return res.status(400).json({ error: 'Missing worker email or task id.' });
  }
  
  // Find the task from postedTasks based on taskId
  const task = postedTasks.find(t => t.id === taskId);
  if (!task) {
    return res.status(404).json({ error: 'Task not found.' });
  }
  
  // Optional: Check if the worker already applied to avoid duplicates
  
  // Create an applied task record (including the task details and worker's email)
  const appliedTask = { ...task, workerEmail };
  appliedTasks.push(appliedTask);
  res.json({ message: 'Task applied successfully', appliedTask });
});

// GET: Retrieve tasks that a worker has applied to
// Expected query: /api/workerAppliedTasks?username=workerEmail
app.get('/api/workerAppliedTasks', (req, res, next) => {
  try {
    const workerEmail = req.query.username;
    if (!workerEmail) {
      return res.status(400).json({ error: 'No username provided' });
    }
    const tasks = appliedTasks.filter(task => task.workerEmail === workerEmail);
    res.json(tasks);
  } catch (error) {
    console.error('Error in /api/workerAppliedTasks:', error);
    next(error); // Pass the error to Express error handling
  }
});


/* ---------------------------
   End of Endpoints
   --------------------------- */

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
