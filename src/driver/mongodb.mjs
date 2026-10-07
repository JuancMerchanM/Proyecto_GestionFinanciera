import mongoose from 'mongoose';

export const getConnection = () => mongoose.connection;

export const isConnected = () => mongoose.connection.readyState === 1;

export default mongoose;
