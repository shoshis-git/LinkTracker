import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import linkRouter from './Routes/LinkRouter.js';
import userRouter from './Routes/UserRouter.js';

dotenv.config();
const app = express();
app.use(express.json());

app.use('/links', linkRouter);
app.use('/users', userRouter);

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(process.env.PORT, () => console.log(`Server on port ${process.env.PORT}`));
  })
  .catch(err => console.error(err));
