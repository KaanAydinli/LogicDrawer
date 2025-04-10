import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { Circuit } from './models/Circuit';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/logicdrawer';

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB successfully');
    console.log('MongoDB URI:', MONGODB_URI);
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    console.error('Connection URI:', MONGODB_URI);
  });

// Routes
app.get('/api/circuits', async (req, res) => {
  try {
    const circuits = await Circuit.find();
    res.json(circuits);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch circuits' });
  }
});

app.get('/api/circuits/:id', async (req, res) => {
  try {
    const circuit = await Circuit.findById(req.params.id);
    if (!circuit) {
      return res.status(404).json({ error: 'Circuit not found' });
    }
    res.json(circuit);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch circuit' });
  }
});
// Add this route to your Express server file
app.get('/api/circuits/:id/download', async (req, res) => {
  try {
    const circuitId = req.params.id;
    const circuit = await Circuit.findById(circuitId);
    
    if (!circuit) {
      return res.status(404).json({ error: 'Circuit not found' });
    }
    
    // Set headers for file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=${circuit.name || 'circuit'}.json`);
    
    // Send the circuit data as a downloadable file
    res.json(circuit);
  } catch (error) {
    console.error('Error downloading circuit:', error);
    res.status(500).json({ error: 'Failed to download circuit' });
  }
});

app.post('/api/circuits', async (req, res) => {
  try {
    const circuit = new Circuit(req.body);
    await circuit.save();
    res.status(201).json(circuit);
  } catch (error) {
    res.status(400).json({ error: 'Failed to save circuit' });
  }
});

app.put('/api/circuits/:id', async (req, res) => {
  try {
    const circuit = await Circuit.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!circuit) {
      return res.status(404).json({ error: 'Circuit not found' });
    }
    res.json(circuit);
  } catch (error) {
    res.status(400).json({ error: 'Failed to update circuit' });
  }
});

app.delete('/api/circuits/:id', async (req, res) => {
  try {
    const circuit = await Circuit.findByIdAndDelete(req.params.id);
    if (!circuit) {
      return res.status(404).json({ error: 'Circuit not found' });
    }
    res.json({ message: 'Circuit deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete circuit' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 