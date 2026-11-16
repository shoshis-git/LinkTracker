import express from 'express';
import LinkController from '../Controllers/LinkController.js';
import auth from '../Middleware/auth.js';
import { validateId } from '../Middleware/errors.js';
import { validateBody, validateLink } from '../Middleware/validate.js';

const LinkRouter = express.Router();

// ציבורי בכוונה - משמש את המונים בדף הבית (גם לאורחים)
LinkRouter.get('/summary', LinkController.summary);


LinkRouter.use(auth);
LinkRouter.get('/', LinkController.getAll);
LinkRouter.get('/:id', validateId, LinkController.getById);
LinkRouter.post('/', validateBody(validateLink), LinkController.add);
LinkRouter.put('/:id', validateId, validateBody(validateLink, { partial: true }), LinkController.update);
LinkRouter.delete('/:id', validateId, LinkController.delete);
LinkRouter.get('/:id/stats', validateId, LinkController.getStats);

export default LinkRouter;
