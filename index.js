const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.json()); // <--- Important!

// PostgreSQL setup
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'amrsense_db',
  password: 'account123',
  port: 8888,
});

pool.connect().then(() => console.log("connected"));

app.get('/', (req, res) => {
  res.send('Server is running');
});

// Route
app.post('/register', async (req, res) => {
  const { email, mobile, otp } = req.body;

  try {
    const result = await pool.query(
      'INSERT INTO users (email, mobile, otp) VALUES ($1, $2, $3) RETURNING *',
      [email, mobile, otp]
    );
    res.status(200).json({ message: 'User registered', user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error', error: err });
  }
});

app.post('/createAccount', async (req, res) => {
  const { fullname, age, mobile, dob, gender,abhaID } = req.body;

  try {
    const result = await pool.query(
      'INSERT INTO userDetails (fullname, age, mobile, dob, gender,abhaID) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [fullname, age, mobile, dob, gender, abhaID]
    );
    res.status(200).json({ message: 'User registered', user: result.rows[0] });
  } catch (err) {
    console.error(err);
    console.error("Error inserting user:", err);
    res.status(500).json({ message: 'Database error', error: err });
  }
});



app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${port}`);
});
