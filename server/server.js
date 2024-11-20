const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors'); // Import CORS middleware

const app = express();
const port = 3000;

const db = new sqlite3.Database('./workers.db'); // SQLite database (updated filename)

// Enable CORS for all routes
app.use(cors());

// Middleware for parsing JSON
app.use(bodyParser.json());

// Initialize the database if it doesn't exist
db.serialize(() => {
  db.run(`
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

  // Insert initial data if table is empty
  db.get("SELECT COUNT(*) AS count FROM workers", (err, row) => {
    if (err) {
      console.error('Error checking worker count:', err);
    } else if (row.count === 0) {
      // Insert example data
      const stmt = db.prepare("INSERT INTO workers (name, email, program, skills, experience, verification_status) VALUES (?, ?, ?, ?, ?, ?)");
      stmt.run("John Doe", "john@example.com", "Developer", "JavaScript, Node.js", "5 years in web development", true);
      stmt.run("Jane Smith", "jane@example.com", "Manager", "Project Management", "3 years managing teams", false);
      stmt.run("Alice Johnson", "alice@example.com", "Designer", "Photoshop, Figma", "2 years in UI/UX design", true);
      stmt.finalize();
    }
  });
});

// API to get all workers
app.get('/getWorkers', (req, res) => {
  db.all("SELECT * FROM workers", (err, rows) => {
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

  console.log('Request body:', req.body); // Log the incoming data to the console

  // Check if any data is missing or invalid
  if (!name || !email || !program || !skills || !experience) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const stmt = db.prepare("INSERT INTO workers (name, email, program, skills, experience, verification_status) VALUES (?, ?, ?, ?, ?, ?)");
  stmt.run(name, email, program, skills, experience, false, function (err) {
    if (err) {
      console.error('Error inserting worker:', err); // Log the error if any
      return res.status(500).json({ error: err.message });
    } else {
      console.log('Worker added with ID:', this.lastID); // Log the ID of the new worker
      res.status(200).json({ 
        id: this.lastID, 
        name, 
        email, 
        program, 
        skills, 
        experience, 
        verification_status: false, // Default to false initially
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