require("dotenv").config();
const express = require('express');
const { MongoClient, ServerApiVersion } = require('mongodb');
const app = express()
const cors = require("cors");
const port = process.env.PORT ||3000;
app.use(express.json());
app.use(cors());


//context-hub
//hpHyCkzP1JNDlmcY





// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
async function run() {
  try {

    // create database

    const db = client.db("contestDB")
    const pendingCollections = db.collection("pending")



    app.post('/pending-contest' ,async (req , res) => {
      const pendingContest = req.body;
      const result = await pendingCollections.insertOne(pendingContest);
      res.send(result);
    })
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('beline')
})

app.listen(port , () => {
    console.log(`app listening port${port}`)
})