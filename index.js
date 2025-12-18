require("dotenv").config();
const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId} = require('mongodb');
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


    app.get('/get-pending' , async (req , res) => {
      const result = await pendingCollections.find({status:'pending'}).toArray()
      res.send(result);
    })


    // approve data update

    app.patch('/approve-contest' ,async (req , res) => {
      const {_id } = req.body ;
      const result  =await  pendingCollections.updateOne({_id:new ObjectId(_id)} , {$set : {status:'approved'}})
      res.send(result)
    })


    //sorting data by participate count

    app.get('/approve-contest' , async (req , res) => {
      const result = await pendingCollections.find({status:'approved'}).sort({participant: -1}).limit(6).toArray()
      res.send(result);
    })


    app.get('/all-approve-contest' , async (req , res) => {
      const result = await pendingCollections.find({status:'approved'}).toArray()
      res.send(result);
    })



    app.delete('/delete-contest/:id' ,async ( req, res) => {

      try {
      const {id} = req.params;
      const objectId = new ObjectId(id)
      const result = await pendingCollections.deleteOne({_id: objectId})
      res.send(result);

      } catch (err) {
        res.status(400).send({message:'Invalid contest ID'})
      }
      
    })


  // single detail router


  app.get(`/detail-contest/:id` , async (req , res) => {

    try {
    const {id} = req.params;
    const objectId = new ObjectId(id);
    const result = await pendingCollections.findOne({_id: objectId})
    res.send(result)
    console.log(result)
    } catch(err) {
      res.status(500).send({message:'Server Error'})
    }
    
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