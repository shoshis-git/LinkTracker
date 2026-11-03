
import express from 'express';
import UserController from '../Controllers/UserController.js';

const UserRouter= express.Router();
UserRouter.get('/', UserController.getAll);
UserRouter.get('/:id', UserController.getById);
UserRouter.get('/:id/links', UserController.getLinks);
UserRouter.post('/', UserController.add);
UserRouter.put('/:id', UserController.update);
UserRouter.delete('/:id', UserController.delete);
UserRouter.post('/login', UserController.login);

export default UserRouter;