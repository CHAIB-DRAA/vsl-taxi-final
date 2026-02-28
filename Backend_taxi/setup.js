const fs = require('fs');
const path = require('path');

const structure = {
  "server.js": `// server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');

const authRoutes = require('./routes/authRoutes');
const rideRoutes = require('./routes/rideRoutes');

const app = express();
app.use(express.json());
app.use(cors());
app.use(helmet());

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.error(err));

app.use('/api/auth', authRoutes);
app.use('/api/rides', rideRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(\`Server running on port \${PORT}\`));
`,

  ".env": `MONGO_URI=your_mongodb_uri_here
JWT_SECRET=your_jwt_secret
`,

  "models/User.js": `
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
`,

  "models/Ride.js": `
const mongoose = require('mongoose');

const rideSchema = new mongoose.Schema({
  chauffeurId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  patientName: { type: String, required: true },
  date: { type: Date, required: true },
  type: { type: String, enum: ['Aller', 'Retour', 'Aller-retour'], required: true },
  startLocation: String,
  endLocation: String,
  startTime: Date,
  endTime: Date
}, { timestamps: true });

module.exports = mongoose.model('Ride', rideSchema);
`,

  "controllers/authController.js": `
const User = require('../models/User');
const jwt = require('jsonwebtoken');

exports.register = async (req, res) => {
  try {
    const user = new User(req.body);
    await user.save();
    res.status(201).json({ message: 'User created' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user || !(await user.comparePassword(req.body.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
`,

  "controllers/rideController.js": `
const Ride = require('../models/Ride');

exports.createRide = async (req, res) => {
  try {
    const ride = new Ride({ ...req.body, chauffeurId: req.user.id });
    await ride.save();
    res.status(201).json(ride);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.startRide = async (req, res) => {
  try {
    const ride = await Ride.findByIdAndUpdate(req.params.id, { startTime: new Date() }, { new: true });
    res.json(ride);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.endRide = async (req, res) => {
  try {
    const ride = await Ride.findByIdAndUpdate(req.params.id, { endTime: new Date() }, { new: true });
    res.json(ride);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getRides = async (req, res) => {
  try {
    const rides = await Ride.find({ chauffeurId: req.user.id }).sort({ date: -1 });
    res.json(rides);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
`,

  "routes/authRoutes.js": `
const express = require('express');
const { register, login } = require('../controllers/authController');
const router = express.Router();

router.post('/register', register);
router.post('/login', login);

module.exports = router;
`,

  "routes/rideRoutes.js": `
const express = require('express');
const { createRide, startRide, endRide, getRides } = require('../controllers/rideController');
const auth = require('../middlewares/authMiddleware');
const router = express.Router();

router.use(auth);
router.post('/', createRide);
router.patch('/:id/start', startRide);
router.patch('/:id/end', endRide);
router.get('/', getRides);

module.exports = router;
`,

  "middlewares/authMiddleware.js": `
const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(400).json({ error: 'Invalid token' });
  }
};
`
};

function writeStructure(base, obj) {
  for (const [file, content] of Object.entries(obj)) {
    const fullPath = path.join(base, file);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content.trim());
  }
}

writeStructure('.', structure);
console.log("✅ Backend VSL généré avec succès !");
