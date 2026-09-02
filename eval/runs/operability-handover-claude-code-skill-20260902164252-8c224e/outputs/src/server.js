const express = require('express');
const { assign } = require('./assign');

const app = express();
app.use(express.json());

app.post('/jobs/:id/assign', async (req, res) => {
  console.log('assigning job ' + req.params.id);
  try {
    const driver = await assign(req.params.id, req.body.region);
    res.json({ driver });
  } catch (err) {
    console.log('assign failed: ' + err.message);
    res.status(500).json({ error: 'could not assign' });
  }
});

app.listen(process.env.PORT || 3000);
module.exports = { app };
