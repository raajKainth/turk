const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const fileUpload = require('express-fileupload');
const bcrypt = require('bcryptjs'); // Import bcryptjs for password hashing
const path = require('path');
const fs = require('fs');

const app = express();
const port = 3000;

// Workers database
const workersDb = new sqlite3.Database('./workers.db');

// Middleware setup
app.use(cors());
app.use(bodyParser.json());
app.use(fileUpload());
app.use(express.static('uploads/resumes'));

// Ensure the uploads directory exists
if (!fs.existsSync('./uploads/resumes')) {
  fs.mkdirSync('./uploads/resumes');
}

// API to register a new worker with a resume upload
app.post('/registerWorker', (req, res) => {
  const { name, email, password, program, skills, experience } = req.body;

  if (!req.files || !req.files.resume) {
    return res.status(400).json({ error: 'Resume file is required' });
  }

  const resumeFile = req.files.resume;

  // Validate file type (only PDF allowed)
  if (resumeFile.mimetype !== 'application/pdf') {
    return res.status(400).json({ error: 'Only PDF files are allowed' });
  }

  // Hash the password before saving it
  bcrypt.hash(password, 10, (err, hashedPassword) => {
    if (err) {
      return res.status(500).json({ error: 'Error hashing password' });
    }

    // Save the resume file to the uploads directory
    const resumePath = `uploads/resumes/${Date.now()}_${resumeFile.name}`;
    resumeFile.mv(resumePath, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Error saving file', details: err.message });
      }

      // Insert worker data into the database
      const stmt = workersDb.prepare(`
        INSERT INTO workers (name, email, password, resume, program, skills, experience, verification_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(name, email, hashedPassword, resumePath, program, skills, experience, false, function (err) {
        if (err) {
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
        }
      });
      stmt.finalize();
    });
  });
});

// API to handle login
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  workersDb.get('SELECT * FROM workers WHERE email = ?', [email], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Compare the entered password with the stored hash
    bcrypt.compare(password, row.password, (err, result) => {
      if (err) {
        return res.status(500).json({ error: 'Error comparing passwords' });
      }
      if (!result) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // If the password matches, return a success response
      res.status(200).json({
        message: 'Login successful',
        user: {
          id: row.id,
          name: row.name,
          email: row.email,
        },
      });
    });
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});