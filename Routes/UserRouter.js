import express from 'express';
import UserController from '../Controllers/UserController.js';
import auth from '../Middleware/auth.js';
import { validateId } from '../Middleware/errors.js';
import { validateBody, validateUser, validateLogin } from '../Middleware/validate.js';

const UserRouter = express.Router();


UserRouter.post('/', validateBody(validateUser), UserController.add);
UserRouter.post('/login', validateBody(validateLogin), UserController.login);


UserRouter.use(auth);
UserRouter.get('/:id', validateId, UserController.getById);
UserRouter.put('/:id', validateId, validateBody(validateUser, { partial: true }), UserController.update);
UserRouter.delete('/:id', validateId, UserController.delete);

export default UserRouter;
