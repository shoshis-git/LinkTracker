import Link from '../Models/link.js';
import User from '../Models/User.js';

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
      if (req.body.userId)
          await User.findByIdAndUpdate(req.body.userId, { $push: { links: link._id } });
      res.status(201).json(link);
    } catch (e) { res.status(400).json({ message: e.message }); }
  },
  update: async (req, res) => {
    try {
      const link = await Link.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after' });
      res.json(link);
    } catch (e) { res.status(400).json({ message: e.message }); }
  },
  delete: async (req, res) => {
    try {
      await Link.findByIdAndDelete(req.params.id);
      await User.updateMany({ links: req.params.id }, { $pull: { links: req.params.id } });
      res.json({ message: 'Deleted' });
    } catch (e) { res.status(500).json({ message: e.message }); }
  },
  redirect: async (req, res) => {
  try {
    const link = await Link.findByIdAndUpdate(
      req.params.id,
      { $push: { clicks: { ipAddress: req.ip } } },
      { returnDocument: 'after' }
    );
    if (!link) return res.status(404).json({ message: 'Link not found' });
    res.redirect(302, link.originalUrl);
  } catch (e) { res.status(400).json({ message: e.message }); }
},

};
export default LinkController;
