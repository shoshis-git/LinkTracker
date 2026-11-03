
import User from '../Models/User.js';

const UserController={

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
        } catch (e) { res.status(500).json({ message: e.message }); }
    },
    add: async (req, res) => {
        try {
            const user = await User.create({ name: req.body.name, email: req.body.email,password: req.body.password });
            res.status(201).json(user);
        } catch (e) { res.status(400).json({ message: e.message }); }
    },
    update: async (req, res) => {
        try {
            const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
            res.json(user);
        } catch (e) { res.status(400).json({ message: e.message }); }
    },
    delete: async (req, res) => {
        try {
            await User.findByIdAndDelete(req.params.id);
            res.json({ message: 'Deleted' });
        } catch (e) { res.status(500).json({ message: e.message }); }
    }

}
export default UserController;