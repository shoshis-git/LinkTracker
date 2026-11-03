import Link from '../Models/link.js';
import User from '../Models/User.js';

// בודק שהקישור שייך למשתמש המחובר (נמצא במערך links שלו)
const isOwner = (req) => User.exists({ _id: req.userId, links: req.params.id });

const LinkController = {
  // מחזיר רק את הקישורים של המשתמש המחובר
  getAll: async (req, res) => {
    try {
      const user = await User.findById(req.userId).populate('links');
      if (!user) return res.status(404).json({ message: 'User not found' });
      res.json(user.links);
    } catch (e) { res.status(500).json({ message: e.message }); }
  },
  getById: async (req, res) => {
    try {
      if (!await isOwner(req)) return res.status(404).json({ message: 'Not found' });
      const link = await Link.findById(req.params.id);
      if (!link) return res.status(404).json({ message: 'Not found' });
      res.json(link);
    } catch (e) { res.status(400).json({ message: e.message }); }
  },
  add: async (req, res) => {
    try {
      const link = await Link.create({
        originalUrl: req.body.originalUrl,
        targetParamName: req.body.targetParamName,
        targetValues: req.body.targetValues
      });
      await User.findByIdAndUpdate(req.userId, { $push: { links: link._id } });
      res.status(201).json(link);
    } catch (e) { res.status(400).json({ message: e.message }); }
  },
  update: async (req, res) => {
    try {
      if (!await isOwner(req)) return res.status(404).json({ message: 'Not found' });
      
      const { originalUrl, targetParamName, targetValues } = req.body;
      const changes = {};
      if (originalUrl) changes.originalUrl = originalUrl;
      if (targetParamName) changes.targetParamName = targetParamName;
      if (targetValues) changes.targetValues = targetValues;
      const link = await Link.findByIdAndUpdate(req.params.id, changes, { returnDocument: 'after', runValidators: true });
      res.json(link);
    } catch (e) { res.status(400).json({ message: e.message }); }
  },
  delete: async (req, res) => {
    try {
      if (!await isOwner(req)) return res.status(404).json({ message: 'Not found' });
      await Link.findByIdAndDelete(req.params.id);
      await User.updateMany({ links: req.params.id }, { $pull: { links: req.params.id } });
      res.json({ message: 'Deleted' });
    } catch (e) { res.status(500).json({ message: e.message }); }
  },
  redirect: async (req, res) => {
    try {
      const link = await Link.findById(req.params.id);
      if (!link) return res.status(404).json({ message: 'Link not found' });
      const targetValue = req.query[link.targetParamName];
      link.clicks.push({ ipAddress: req.ip, targetParamValue: targetValue });
      await link.save();

      res.redirect(302, link.originalUrl);
    } catch (e) { res.status(400).json({ message: e.message }); }
  },

  getStats: async (req, res) => {
    try {
      if (!await isOwner(req)) return res.status(404).json({ message: 'Link not found' });
      const link = await Link.findById(req.params.id);
      if (!link) return res.status(404).json({ message: 'Link not found' });

      const stats = {};
      link.clicks.forEach(click => {
        const value = click.targetParamValue;
        const target = link.targetValues.find(t => t.value === value);
        const name = target ? target.name : 'unknown';
        stats[name] = (stats[name] || 0) + 1;
      });

      res.json({ total: link.clicks.length, byTarget: stats });
    } catch (e) { res.status(500).json({ message: e.message }); }
  },

  summary: async (req, res) => {
    try {
      const [users, links, clicks] = await Promise.all([
        User.countDocuments(),
        Link.countDocuments(),
        Link.aggregate([{ $group: { _id: null, total: { $sum: { $size: { $ifNull: ['$clicks', []] } } } } }])
      ]);
      res.json({ users, links, clicks: clicks[0]?.total || 0 });
    } catch (e) { res.status(500).json({ message: e.message }); }
  }

}
export default LinkController;
