const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const fileUpload = require('express-fileupload');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const session = require('express-session');

const app = express();
const port = 3000;

app.use(express.static(path.join(__dirname, 'public')));

// Workers database
const workersDb = new sqlite3.Database('./workers.db');

// Middleware setup
app.use(cors({
  origin: 'http://localhost:3000', // or the URL from which you're serving your HTML files
  credentials: true
}));
app.use(bodyParser.json());
app.use(fileUpload());
// Serve static files from the resumes folder (so the client can access resume files)
app.use(express.static('uploads/resumes'));
app.use(express.static(path.join(__dirname, '../public')));

// Setup express-session middleware
app.use(session({
  secret: 'your-secret-key', // Change this to a secure, random key
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Use secure: true in production with HTTPS
}));

// Ensure the uploads/resumes directory exists
if (!fs.existsSync('./uploads/resumes')) {
  fs.mkdirSync('./uploads/resumes', { recursive: true });
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

    // Save the resume file to the uploads/resumes directory
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
      stmt.run(name, email, hashedPassword, resumePath, program || '', skills || '', experience || '', false, function (err) {
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

// API to handle login using sessions
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

      // Save user details in session
      req.session.user = {
        id: row.id,
        name: row.name,
        email: row.email,
        resume: row.resume,
        program: row.program,
        skills: row.skills,
        experience: row.experience,
        userType: 'worker' // Adjust if you have different user types
      };

      res.status(200).json({
        message: 'Login successful',
        user: req.session.user
      });
    });
  });
});

// Middleware to ensure a user is authenticated via session
function ensureAuthenticated(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized access' });
}

// API to reupload resume using session authentication
app.post('/reuploadResume', ensureAuthenticated, (req, res) => {
  // Make sure a file was uploaded
  if (!req.files || !req.files.resume) {
    return res.status(400).json({ error: 'Resume file is required' });
  }

  const resumeFile = req.files.resume;

  // Validate file type (only PDF allowed)
  if (resumeFile.mimetype !== 'application/pdf') {
    return res.status(400).json({ error: 'Only PDF files are allowed' });
  }

  // Save the new resume file
  const newResumePath = `uploads/resumes/${Date.now()}_${resumeFile.name}`;
  resumeFile.mv(newResumePath, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Error saving file', details: err.message });
    }

    // Update the worker's resume path in the database using the session user ID
    const userId = req.session.user.id;
    const stmt = workersDb.prepare('UPDATE workers SET resume = ? WHERE id = ?');
    stmt.run(newResumePath, userId, function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      // Optionally update the session with the new resume
      req.session.user.resume = newResumePath;
      res.status(200).json({
        message: 'Resume updated successfully',
        resume: newResumePath
      });
    });
    stmt.finalize();
  });
});

// API to fetch worker profile using session authentication
app.get('/profile', ensureAuthenticated, (req, res) => {
  const { id } = req.session.user;
  workersDb.get('SELECT id, name, email, resume, program, skills, experience FROM workers WHERE id = ?', [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!row) {
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
  });
});

// API to get all workers' information (excluding passwords)
app.get('/getWorkers', (req, res) => {
  workersDb.all('SELECT id, name, email, program, skills, experience, verification_status, created_at FROM workers', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.status(200).json(rows); // Send all workers data
  });
});

// API to handle logout (destroying the session)
app.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ error: 'Failed to log out' });
    }
    res.status(200).json({ message: 'Logged out successfully' });
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});