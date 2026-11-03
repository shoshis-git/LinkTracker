import bcrypt from 'bcryptjs';

import User from '../Models/User.js';
import Link from '../Models/link.js';

const UserController = {

    getAll: async (req, res) => {
        try {
            res.json(await User.find());
        } catch (e) { res.status(500).json({ message: e.message }); }
    },

    getById: async (req, res) => {
        try {
            const user = await User.findById(req.params.id);
            if (!user) return res.status(404).json({ message: 'Not found' });
            res.json(user);
        } catch (e) { res.status(400).json({ message: e.message }); }
    },
    getLinks: async (req, res) => {
        try {
            const user = await User.findById(req.params.id).populate('links');
            if (!user) return res.status(404).json({ message: 'Not found' });
            res.json(user.links);
        } catch (e) { res.status(400).json({ message: e.message }); }
    },
    add: async (req, res) => {
        try {
            const user = await User.create({ name: req.body.name, email: req.body.email, password: req.body.password });
            res.status(201).json(user);
        } catch (e) { res.status(400).json({ message: e.message }); }
    },
    update: async (req, res) => {
        try {
            const user = await User.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after' });
            res.json(user);
        } catch (e) { res.status(404).json({ message: 'Not Found' }); }
    },
    delete: async (req, res) => {
        try {
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

            const match = await bcrypt.compare(password, user.password);
            if (!match) return res.status(401).json({ message: 'Invalid email or password' });

            res.json(user);
        } catch (e) { res.status(500).json({ message: e.message }); }
    },


}
export default UserController;