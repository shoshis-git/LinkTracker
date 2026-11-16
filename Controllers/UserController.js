import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import User from '../Models/User.js';
import Link from '../Models/link.js';

const createToken = (req, user) =>
    jwt.sign({ userId: String(user._id) }, req.app.locals.jwtSecret, { expiresIn: '24h', algorithm: 'HS256' });


const isSelf = (req) => req.params.id === req.userId;

// שגיאות לא צפויות מועברות אוטומטית (Express 5) ל-errorHandler ב-Middleware/errors.js.
// אימייל כפול מחזיר 409, והסיסמה אף פעם לא מוחזרת (toJSON במודל).
const UserController = {

    getById: async (req, res) => {
        if (!isSelf(req)) return res.status(403).json({ message: 'Forbidden' });
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: 'Not found' });
        res.json(user);
    },
    add: async (req, res) => {
        const user = await User.create({ name: req.body.name, email: req.body.email, password: req.body.password });
        res.status(201).json({ token: createToken(req, user), user });
    },
    update: async (req, res) => {
        if (!isSelf(req)) return res.status(403).json({ message: 'Forbidden' });

        const { name, email, password } = req.body;
        const changes = {};
        if (name) changes.name = name;
        if (email) changes.email = email;
        if (password) changes.password = password;
        const user = await User.findByIdAndUpdate(req.params.id, changes, { returnDocument: 'after', runValidators: true });
        if (!user) return res.status(404).json({ message: 'Not found' });
        res.json(user);
    },
    delete: async (req, res) => {
        if (!isSelf(req)) return res.status(403).json({ message: 'Forbidden' });
        const user = await User.findByIdAndDelete(req.params.id);
        if (user) await Link.deleteMany({ _id: { $in: user.links } });
        res.json({ message: 'Deleted' });
    },

    login: async (req, res) => {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(401).json({ message: 'Invalid email or password' });

        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).json({ message: 'Invalid email or password' });

        res.json({ token: createToken(req, user), user });
    },

}
export default UserController;
