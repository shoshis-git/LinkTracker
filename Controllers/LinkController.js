import Link from '../Models/link.js';
import User from '../Models/User.js';


const isOwner = (req) => User.exists({ _id: req.userId, links: req.params.id });

// שגיאות לא צפויות מועברות אוטומטית (Express 5) ל-errorHandler ב-Middleware/errors.js
const LinkController = {

  getAll: async (req, res) => {
    const user = await User.findById(req.userId).populate('links');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user.links);
  },
  getById: async (req, res) => {
    if (!await isOwner(req)) return res.status(404).json({ message: 'Not found' });
    const link = await Link.findById(req.params.id);
    if (!link) return res.status(404).json({ message: 'Not found' });
    res.json(link);
  },
  add: async (req, res) => {
    if (!await User.exists({ _id: req.userId })) return res.status(404).json({ message: 'User not found' });
    const link = await Link.create({
      originalUrl: req.body.originalUrl,
      targetParamName: req.body.targetParamName || undefined,
      targetValues: req.body.targetValues
    });
    await User.findByIdAndUpdate(req.userId, { $push: { links: link._id } });
    res.status(201).json(link);
  },
  update: async (req, res) => {
    if (!await isOwner(req)) return res.status(404).json({ message: 'Not found' });

    const { originalUrl, targetParamName, targetValues } = req.body;
    const changes = {};
    if (originalUrl) changes.originalUrl = originalUrl;
    if (targetParamName) changes.targetParamName = targetParamName;
    if (targetValues) changes.targetValues = targetValues;
    const link = await Link.findByIdAndUpdate(req.params.id, changes, { returnDocument: 'after', runValidators: true });
    if (!link) return res.status(404).json({ message: 'Not found' });
    res.json(link);
  },
  delete: async (req, res) => {
    if (!await isOwner(req)) return res.status(404).json({ message: 'Not found' });
    await Link.findByIdAndDelete(req.params.id);
    await User.updateMany({ links: req.params.id }, { $pull: { links: req.params.id } });
    res.json({ message: 'Deleted' });
  },
  redirect: async (req, res) => {
    const link = await Link.findById(req.params.id, { originalUrl: 1, targetParamName: 1 });
    if (!link) return res.status(404).json({ message: 'Link not found' });

    // ?t=a&t=b מגיע כמערך - לוקחים את הערך הראשון
    let targetValue = req.query[link.targetParamName];
    if (Array.isArray(targetValue)) targetValue = targetValue[0];
    if (typeof targetValue !== 'string') targetValue = undefined;

    // $push אטומי - בלי לטעון את כל מערך הקליקים, ובטוח גם בקליקים במקביל
    await Link.updateOne({ _id: link._id }, {
      $push: { clicks: { ipAddress: req.ip, targetParamValue: targetValue } }
    });

    res.redirect(302, link.originalUrl);
  },

  getStats: async (req, res) => {
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
  },

  // ציבורי בכוונה: דף הבית מציג את המונים גם לאורחים. מחזיר רק מספרים כלליים.
  summary: async (req, res) => {
    const [users, links, clicks] = await Promise.all([
      User.countDocuments(),
      Link.countDocuments(),
      Link.aggregate([{ $group: { _id: null, total: { $sum: { $size: { $ifNull: ['$clicks', []] } } } } }])
    ]);
    res.json({ users, links, clicks: clicks[0]?.total || 0 });
  }

}
export default LinkController;
