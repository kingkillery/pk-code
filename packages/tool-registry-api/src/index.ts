/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';

const app = express();
const port = 3001;

app.use(express.json());

// In-memory store for tools for now
type Tool = Record<string, unknown>;
const tools: Tool[] = [];

app.get('/tools', (req, res) => {
  res.json(tools);
});

app.post('/tools', (req, res) => {
  const newTool = req.body;
  tools.push(newTool);
  res.status(201).json(newTool);
});

app.listen(port, () => {
  console.log(`Tool Registry API listening at http://localhost:${port}`);
});
