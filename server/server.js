const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const port = 3000;

// Workers database
const workersDb = new sqlite3.Database('./workers.db');

// Tasks database
const tasksDb = new sqlite3.Database('./tasks.db');

// Enable CORS for all routes
app.use(cors());

// Middleware for parsing JSON
app.use(bodyParser.json());

// Initialize the workers database
workersDb.serialize(() => {
  workersDb.run(`
    CREATE TABLE IF NOT EXISTS workers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT,
      program TEXT,
      skills TEXT,
      experience TEXT,
      verification_status BOOLEAN,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Insert example data if table is empty
  workersDb.get("SELECT COUNT(*) AS count FROM workers", (err, row) => {
    if (err) {
      console.error('Error checking worker count:', err);
    } else if (row.count === 0) {
      const stmt = workersDb.prepare("INSERT INTO workers (name, email, program, skills, experience, verification_status) VALUES (?, ?, ?, ?, ?, ?)");
      stmt.run("John Doe", "john@example.com", "Developer", "JavaScript, Node.js", "5 years in web development", true);
      stmt.run("Jane Smith", "jane@example.com", "Manager", "Project Management", "3 years managing teams", false);
      stmt.run("Alice Johnson", "alice@example.com", "Designer", "Photoshop, Figma", "2 years in UI/UX design", true);
      stmt.finalize();
    }
  });
});

// Initialize the tasks database
tasksDb.serialize(() => {
  tasksDb.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      description TEXT,
      deadline DATE,
      reward INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

// API to get all workers
app.get('/getWorkers', (req, res) => {
  workersDb.all("SELECT * FROM workers", (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.status(200).json(rows);
    }
  });
});

// API to add a new worker
app.post('/addWorker', (req, res) => {
  const { name, email, program, skills, experience } = req.body;

  if (!name || !email || !program || !skills || !experience) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const stmt = workersDb.prepare("INSERT INTO workers (name, email, program, skills, experience, verification_status) VALUES (?, ?, ?, ?, ?, ?)");
  stmt.run(name, email, program, skills, experience, false, function (err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    } else {
      res.status(200).json({ id: this.lastID, name, email, program, skills, experience, verification_status: false, created_at: new Date().toISOString() });
    }
  });
  stmt.finalize();
});

// API to get all tasks
app.get('/getTasks', (req, res) => {
  tasksDb.all("SELECT * FROM tasks", (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.status(200).json(rows);
    }
  });
});

// API to add a new task
app.post('/addTask', (req, res) => {
  const { title, description, deadline, reward } = req.body;

  // Check if all fields are provided
  if (!title || !description || !deadline || !reward) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  // Insert new task into the tasks database
  const stmt = tasksDb.prepare("INSERT INTO tasks (title, description, deadline, reward) VALUES (?, ?, ?, ?)");
  stmt.run(title, description, deadline, reward, function (err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    } else {
      res.status(200).json({
        id: this.lastID,
        title,
        description,
        deadline,
        reward,
        created_at: new Date().toISOString()
      });
    }
  });
  stmt.finalize();
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});