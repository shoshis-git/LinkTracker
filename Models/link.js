import mongoose from 'mongoose';

const linkSchema = new mongoose.Schema({
     
      originalUrl: {type: String, required: true},
      clicks: [{ insertedAt: { type: Date, default: Date.now },ipAddress: { type: String }}],
  });
  export default mongoose.model('Link', linkSchema);