const express = require('express');
const cors = require('cors');
const path = require('path');
const mediaRoutes = require('./routes/mediaRoutes');
const authRoutes = require('./routes/authRoutes');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.use(express.static(path.join(__dirname, '../public')));

app.use('/api/auth', authRoutes);
app.use('/api/media', mediaRoutes);

app.get('/api/health', (req, res) => res.status(200).json({ status: 'healthy' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🎬 CozyReel is running on port ${PORT}`);
});
