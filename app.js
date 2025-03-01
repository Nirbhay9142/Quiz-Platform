const express = require("express");
const mysql = require("mysql2");
const bodyParser = require("body-parser");
const bcrypt = require("bcryptjs");
const session = require("express-session");

const app = express();
const port = 3000;

// MySQL connection
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "root",
  database: "quiz_platform",
});

db.connect(err => {
  if (err) throw err;
  console.log("Connected to MySQL database.");
});

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static("public"));
app.use(session({
  secret: "quizsecret",
  resave: false,
  saveUninitialized: true,
}));

// Serve the home page
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

// Serve the login page
app.get("/login", (req, res) => {
  res.sendFile(__dirname + "/public/login.html");
});

// Login handler
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  db.query(
    "SELECT * FROM users WHERE username = ?",
    [username],
    (err, results) => {
      if (err) throw err;
      if (results.length > 0) {
        const user = results[0];
        bcrypt.compare(password, user.password, (err, match) => {
          if (err) throw err;
          if (match) {
            req.session.userId = user.id;
            res.redirect("/quiz");
          } else {
            res.send("Invalid password.");
          }
        });
      } else {
        res.send("No such user found.");
      }
    }
  );
});

// Serve the quiz page
app.get("/quiz", (req, res) => {
  if (!req.session.userId) {
    return res.redirect("/login");
  }
  db.query("SELECT * FROM questions", (err, results) => {
    if (err) throw err;
    res.send(`
      <html>
        <body>
          <h1>Quiz</h1>
          <form action="/submit-quiz" method="POST">
            ${results
              .map((question, index) => {
                return `
                  <p>${question.question_text}</p>
                  <label><input type="radio" name="q${index + 1}" value="A"> ${question.option_a}</label><br>
                  <label><input type="radio" name="q${index + 1}" value="B"> ${question.option_b}</label><br>
                  <label><input type="radio" name="q${index + 1}" value="C"> ${question.option_c}</label><br>
                  <label><input type="radio" name="q${index + 1}" value="D"> ${question.option_d}</label><br><br>
                `;
              })
              .join("")}
            <input type="submit" value="Submit Quiz">
          </form>
        </body>
      </html>
    `);
  });
});

// Handle quiz submission
app.post("/submit-quiz", (req, res) => {
  if (!req.session.userId) {
    return res.redirect("/login");
  }

  db.query("SELECT * FROM questions", (err, questions) => {
    if (err) throw err;

    let score = 0;
    questions.forEach((question, index) => {
      const userAnswer = req.body[`q${index + 1}`];
      if (userAnswer === question.correct_option) {
        score++;
      }
    });

    db.query(
      "INSERT INTO quiz_results (user_id, score) VALUES (?, ?)",
      [req.session.userId, score],
      (err) => {
        if (err) throw err;
        res.send(`You scored ${score} out of ${questions.length}`);
      }
    );
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

