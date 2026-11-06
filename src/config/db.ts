import mongoose from 'mongoose';
import { env } from './env.ts';

export async function connectDb(uri: string = env.mongoUri): Promise<typeof mongoose.connection> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  return mongoose.connection;
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}
