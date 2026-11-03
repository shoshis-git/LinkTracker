import express from 'express';
import UserController from '../Controllers/UserController.js';
import auth from '../Middleware/auth.js';

const UserRouter = express.Router();


UserRouter.post('/', UserController.add);
UserRouter.post('/login', UserController.login);


UserRouter.use(auth);
UserRouter.get('/:id', UserController.getById);
UserRouter.put('/:id', UserController.update);
UserRouter.delete('/:id', UserController.delete);

export default UserRouter;
