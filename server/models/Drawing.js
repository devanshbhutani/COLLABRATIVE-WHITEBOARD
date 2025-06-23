import mongoose from 'mongoose';

const drawingSchema = new mongoose.Schema({
  roomId: { type: String, required: true, unique: true },
  elements: [Object], // Array of drawing elements
});

export default mongoose.model('Drawing', drawingSchema);
