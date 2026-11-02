import mongoose from 'mongoose';

export async function connectDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn('[ARNA] MONGODB_URI is not set. Authentication endpoints will return a setup error.');
    return false;
  }
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  console.log('[ARNA] MongoDB connected');
  return true;
}
