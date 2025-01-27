const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const session = require('express-session');

const app = express();

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(
  session({
    secret: 'your_secret_key', // Replace with a strong secret key
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 30 }, // 30 minutes
  })
);

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' }); // Resume files will be stored in the "uploads" folder

// Dummy database for simplicity
const users = [];

// Route: Register Worker
app.post('/registerWorker', upload.single('resume'), (req, res) => {
  const { name, email, password } = req.body;

  // Check if user already exists
  if (users.find((user) => user.email === email)) {
    return res.status(400).json({ error: 'Email is already registered.' });
  }

  // Save the user details (resume file path is stored as well)
  users.push({
    name,
    email,
    password,
    resume: req.file ? req.file.path : null, // Save uploaded resume path
  });

  res.json({ message: 'Registration successful!' });
});

// Route: Login
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  // Find user by email and password
  const user = users.find(
    (user) => user.email === email && user.password === password
  );

  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  // Save user in session
  req.session.user = { name: user.name, email: user.email };
  res.json({ message: 'Login successful!' });
});

// Route: Protected Home
app.get('/home', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Unauthorized access.' });
  }

  res.json({ message: `Welcome, ${req.session.user.name}!` });
});

// Route: Logout
app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Error logging out.' });
    }
    res.json({ message: 'Logged out successfully!' });
  });
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
