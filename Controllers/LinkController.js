import Link from '../Models/link.js';

const LinkController = {
  getAll: async (req, res) => {
    try {
      res.json(await Link.find());
    } catch (e) { res.status(500).json({ message: e.message }); }
  },
  getById: async (req, res) => {
    try {
      const link = await Link.findById(req.params.id);
      if (!link) return res.status(404).json({ message: 'Not found' });
      res.json(link);
    } catch (e) { res.status(500).json({ message: e.message }); }
  },
  add: async (req, res) => {
    try {
      const link = await Link.create({ originalUrl: req.body.originalUrl });
      res.status(201).json(link);
    } catch (e) { res.status(400).json({ message: e.message }); }
  },
  update: async (req, res) => {
    try {
      const link = await Link.findByIdAndUpdate(req.params.id, req.body, { new: true });
      res.json(link);
    } catch (e) { res.status(400).json({ message: e.message }); }
  },
  delete: async (req, res) => {
    try {
      await Link.findByIdAndDelete(req.params.id);
      res.json({ message: 'Deleted' });
    } catch (e) { res.status(500).json({ message: e.message }); }
  }
};
export default LinkController;
