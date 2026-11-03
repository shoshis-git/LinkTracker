import express from 'express';
import LinkController from '../Controllers/LinkController.js';
import auth from '../Middleware/auth.js';

const LinkRouter = express.Router();


LinkRouter.get('/summary', LinkController.summary);


LinkRouter.use(auth);
LinkRouter.get('/', LinkController.getAll);
LinkRouter.get('/:id', LinkController.getById);
LinkRouter.post('/', LinkController.add);
LinkRouter.put('/:id', LinkController.update);
LinkRouter.delete('/:id', LinkController.delete);
LinkRouter.get('/:id/stats', LinkController.getStats);

export default LinkRouter;
