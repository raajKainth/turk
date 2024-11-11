const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');

const app = express();
const port = 3000;

const db = new sqlite3.Database('./users.db'); // SQLite database

app.use(bodyParser.json());

// Initialize the database if it doesn't exist
db.serialize(() => {
  db.run("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, role TEXT, salary REAL, project TEXT)");

  // Insert initial data if table is empty
  db.get("SELECT COUNT(*) AS count FROM users", (err, row) => {
    if (err) {
      console.error('Error checking user count:', err);
    } else if (row.count === 0) {
      // Insert example data
      const stmt = db.prepare("INSERT INTO users (name, role, salary, project) VALUES (?, ?, ?, ?)");
      stmt.run("John Doe", "Developer", 50000, "Project X");
      stmt.run("Jane Smith", "Manager", 75000, "Project Y");
      stmt.run("Alice Johnson", "Designer", 45000, "Project Z");
      stmt.finalize();
    }
  });
});

// API to get all users
app.get('/getUsers', (req, res) => {
  db.all("SELECT * FROM users", (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.status(200).json(rows);
    }
  });
});

// API to add a new user
app.post('/addUser', (req, res) => {
    const { name, role, salary, project } = req.body;
  
    console.log('Request body:', req.body);  // Log the incoming data to the console
  
    // Check if any data is missing or invalid
    if (!name || !role || !salary || !project) {
      return res.status(400).json({ error: 'All fields are required' });
    }
  
    const stmt = db.prepare("INSERT INTO users (name, role, salary, project) VALUES (?, ?, ?, ?)");
    stmt.run(name, role, salary, project, function (err) {
      if (err) {
        console.error('Error inserting user:', err);  // Log the error if any
        return res.status(500).json({ error: err.message });
      } else {
        console.log('User added with ID:', this.lastID);  // Log the ID of the new user
        res.status(200).json({ id: this.lastID, name, role, salary, project });
      }
    });
    stmt.finalize();
  });  

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});