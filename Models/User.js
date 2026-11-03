import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
        
      name:{type: String, required: true},
      email: {type: String, required: true, unique: true},
      password: {type: String, required: true},
     links: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Link' }]

});



userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.pre('findOneAndUpdate', async function () {
  const update = this.getUpdate();
  if (update.password)
    update.password = await bcrypt.hash(update.password, 10);
});

userSchema.set('toJSON', {
  transform: (doc, ret) => { delete ret.password; return ret; }
});

export default mongoose.model('User', userSchema);
