// Handle sign-up form submission
document.getElementById('signup-form')?.addEventListener('submit', function (e) {
    e.preventDefault(); // Prevent the default form submission

    const name = document.getElementById('full-name').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    // Check if password and confirm password match
    if (password !== confirmPassword) {
        alert('Passwords do not match');
        return; // Stop further execution if passwords don't match
    }

    // Send sign-up request to the server
    fetch('http://localhost:3000/signup', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, email, password })
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Redirect to login page after successful sign-up
                window.location.href = 'login.html';
            } else {
                alert(data.message);
            }
        })
        .catch(error => {
            console.error('Error during sign-up:', error);
            alert('There was an error with the sign-up request.');
        });
});

// Handle login form submission
document.getElementById('login-form')?.addEventListener('submit', function (e) {
    e.preventDefault(); // Prevent default form submission

    const enteredEmail = document.getElementById('username').value;
    const enteredPassword = document.getElementById('password').value;

    // Send login request to the server
    fetch('http://localhost:3000/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: enteredEmail, password: enteredPassword })
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Redirect to home.html if login is successful
                window.location.href = 'home.html';
            } else {
                // Show an error message if login failed
                alert(data.message);
            }
        })
        .catch(error => {
            console.error('Error during login:', error);
            alert('There was an error with the login request.');
        });
});
