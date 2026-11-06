import mongoose from 'mongoose';

export const getConnection = (): typeof mongoose.connection => mongoose.connection;

export const isConnected = (): boolean => mongoose.connection.readyState === 1;

export default mongoose;
