const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { Pool } = require('pg');

const app = express();
const port = 8080;

// Middleware
app.use(cors());
app.use(express.json()); // <--- Important!

// PostgreSQL setup
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'amrsense_db',
  password: 'account123',
  port: 5435,
});

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

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
  const { fullname, age, mobile, dob, gender,abhaID,userrole } = req.body;

  try {
    const result = await pool.query(
      'INSERT INTO userDetails (fullname, age, mobile, dob, gender,abhaID,userrole) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [fullname, age, mobile, dob, gender, abhaID,userrole]
    );
    res.status(200).json({ message: 'User registered', user: result.rows[0] });
  } catch (err) {
    console.error(err);
    console.error("Error inserting user:", err);
    res.status(500).json({ message: 'Database error', error: err });
  }
});

app.post('/upload', upload.single('image'), async (req, res) => {
  const { originalname, mimetype, buffer } = req.file;

  try {
    const result = await pool.query(
      'INSERT INTO images (name, data, mimetype) VALUES ($1, $2, $3) RETURNING id',
      [originalname, buffer, mimetype]
    );
    res.status(200).json({ message: 'Image uploaded', id: result.rows[0].id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error uploading image' });
  }
});

app.get('/image/:id', async (req, res) => {
  const imageId = req.params.id;

  try {
    const result = await pool.query('SELECT * FROM images WHERE id = $1', [imageId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Image not found' });
    }

    const image = result.rows[0];
    res.set('Content-Type', image.mimetype);
    res.send(image.data); // Send image binary data
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error retrieving image' });
  }
});


app.post('/community/:id/upload', upload.single('antibiotic_image'), async (req, res) => {
  const communityId = req.params.id;
  const tableName = `community_data`;

  try {
    // Check if user is a community worker
    let userCheck;

if (!isNaN(communityId)) {
  // If communityId is a number, assume it's personid
  userCheck = await pool.query(
    'SELECT * FROM userdetails WHERE personid = $1 AND userrole = $2',
    [parseInt(communityId), 'community_worker']
  );
} else {
  // Otherwise treat it as abhaID / community ID
  userCheck = await pool.query(
    'SELECT * FROM userdetails WHERE abhaid = $1 AND userrole = $2',
    [communityId, 'community_worker']
  );
}

if (userCheck.rows.length === 0) {
  return res.status(400).json({ message: 'Not a valid community worker' });
}

    // Create table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${tableName} (
        id SERIAL PRIMARY KEY,
        householdid TEXT,
        date_of_visit DATE,
        village TEXT,
        state TEXT,
        district TEXT,
        household_size INTEGER,
        symptoms TEXT,
        mode_of_medication TEXT,
        antibiotics TEXT,
        patient_id SERIAL,
        name TEXT,
        age INTEGER,
        gender TEXT,
        occupation TEXT,
        antibiotic_image BYTEA,
        image_mimetype TEXT,
        obtained_from TEXT,
        date_of_antibiotic_used DATE,
        dosage TEXT,
        unit TEXT,
        duration INTEGER,
        full_course_taken BOOLEAN,
        doctor TEXT,
        antibiotic_misuse TEXT,
        antibiotic_resistance TEXT,
        want_info BOOLEAN
      );
    `);

    const {
      householdid, date_of_visit, village, state, district,
      household_size, symptoms, mode_of_medication, antibiotics, patient_id,
      name, age, gender, occupation, obtained_from, date_of_antibiotic_used,
      dosage, unit, duration, full_course_taken, doctor,
      antibiotic_misuse, antibiotic_resistance, want_info
    } = req.body;

    const antibiotic_image = req.file?.buffer || null;
    const image_mimetype = req.file?.mimetype || null;

    await pool.query(`
      INSERT INTO ${tableName} (
        householdid, date_of_visit, village, state, district,
        household_size, symptoms, mode_of_medication, antibiotics, patient_id,
        name, age, gender, occupation, antibiotic_image, image_mimetype,
        obtained_from, date_of_antibiotic_used, dosage, unit, duration,
        full_course_taken, doctor, antibiotic_misuse, antibiotic_resistance, want_info
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21,
        $22, $23, $24, $25, $26
      );
    `, [
      householdid, date_of_visit, village, state, district,
      household_size, symptoms, mode_of_medication, antibiotics, patient_id,
      name, age, gender, occupation, antibiotic_image, image_mimetype,
      obtained_from, date_of_antibiotic_used, dosage, unit, duration,
      full_course_taken === 'true', doctor, antibiotic_misuse, antibiotic_resistance, want_info === 'true'
    ]);

    res.status(200).json({ message: 'Data uploaded successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Upload failed', error: err.message });
  }
});

app.get('/getCommunityDetails', async (req, res) => {
  const { householdid, personid } = req.query;

  if (!householdid && !personid) {
    return res.status(400).json({ message: 'householdid or personid is required' });
  }

  try {
    let result;

    if (householdid) {
      result = await pool.query(
        'SELECT * FROM community_data WHERE householdid = $1',
        [parseInt(householdid)]
      );
    } else if (personid) {
      result = await pool.query(
        'SELECT * FROM community_data WHERE personid = $1',
        [parseInt(personid)]
      );
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'No community details found' });
    }

    // Optionally exclude image from response or encode as Base64
    const response = result.rows.map(row => {
      const { antibiotic_image, ...rest } = row;
      return {
        ...rest,
        antibiotic_image: row.antibiotic_image ? row.antibiotic_image.toString('base64') : null
      };
    });

    res.status(200).json({ message: 'Community details fetched', data: response });
  } catch (error) {
    console.error('Error fetching community details:', error);
    res.status(500).json({ message: 'Database error', error });
  }
});




app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${port}`);
});
