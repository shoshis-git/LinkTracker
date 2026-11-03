import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import User from '../Models/User.js';
import Link from '../Models/link.js';

const createToken = (user) =>
    jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '24h' });


const isSelf = (req) => req.params.id === req.userId;

const UserController = {

    getById: async (req, res) => {
        try {
            if (!isSelf(req)) return res.status(403).json({ message: 'Forbidden' });
            const user = await User.findById(req.params.id);
            if (!user) return res.status(404).json({ message: 'Not found' });
            res.json(user);
        } catch (e) { res.status(400).json({ message: e.message }); }
    },
    add: async (req, res) => {
        try {
            const user = await User.create({ name: req.body.name, email: req.body.email, password: req.body.password });
            res.status(201).json({ token: createToken(user), user });
        } catch (e) { res.status(400).json({ message: e.message }); }
    },
    update: async (req, res) => {
        try {
            if (!isSelf(req)) return res.status(403).json({ message: 'Forbidden' });

            const { name, email, password } = req.body;
            const changes = {};
            if (name) changes.name = name;
            if (email) changes.email = email;
            if (password) changes.password = password;
            const user = await User.findByIdAndUpdate(req.params.id, changes, { returnDocument: 'after', runValidators: true });
            if (!user) return res.status(404).json({ message: 'Not found' });
            res.json(user);
        } catch (e) { res.status(400).json({ message: e.message }); }
    },
    delete: async (req, res) => {
        try {
            if (!isSelf(req)) return res.status(403).json({ message: 'Forbidden' });
            const user = await User.findByIdAndDelete(req.params.id);
            if (user) await Link.deleteMany({ _id: { $in: user.links } });
            res.json({ message: 'Deleted' });
        } catch (e) { res.status(500).json({ message: e.message }); }
    },

    login: async (req, res) => {
        try {
            const { email, password } = req.body;
            const user = await User.findOne({ email });
            if (!user) return res.status(401).json({ message: 'Invalid email or password' });

            const match = await bcrypt.compare(password || '', user.password);
            if (!match) return res.status(401).json({ message: 'Invalid email or password' });

            res.json({ token: createToken(user), user });
        } catch (e) { res.status(500).json({ message: e.message }); }
    },

}
export default UserController;
