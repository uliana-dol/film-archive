const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

exports.register = async (req, res) => {
    const { username, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword]);
        res.status(201).json({ message: 'User created' });
    } catch (error) {
        res.status(500).json({ error: 'Username already exists' });
    }
};

exports.login = async (req, res) => {
    const { username, password } = req.body;
    try {
        const [users] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
        if (users.length === 0) return res.status(401).json({ error: 'User not found' });

        const validPassword = await bcrypt.compare(password, users[0].password);
        if (!validPassword) return res.status(401).json({ error: 'Invalid password' });

        const token = jwt.sign({ userId: users[0].id, username: users[0].username }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, username });
    } catch (error) {
        res.status(500).json({ error: 'Login failed' });
    }
};

exports.verifyToken = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(401).json({ error: 'Access denied' });

    jwt.verify(token.split(' ')[1], JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });
        req.user = user;
        next();
    });
};
