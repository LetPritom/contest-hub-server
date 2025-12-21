require("dotenv").config();
const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(`${process.env.STRIPE_SECRET_KEY}`);
const app = express();
const cors = require("cors");
const port = process.env.PORT || 3000;
app.use(express.json());


app.use(cors({
  origin: process.env.CLIENT_DOMAIN,
  credentials: true
}))

//context-hub
//hpHyCkzP1JNDlmcY

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    // create database

    const db = client.db("contestDB");
    const pendingCollections = db.collection("pending");
    const participantCollections = db.collection("participant");
    const taskSubmissions = db.collection("submission");
    const usersCollections = db.collection('user')

    app.post("/pending-contest", async (req, res) => {
      const pendingContest = req.body;
      const result = await pendingCollections.insertOne(pendingContest);
      res.send(result);
    });

    app.get("/get-pending", async (req, res) => {
      const result = await pendingCollections
        .find({ status: "pending" })
        .toArray();
      res.send(result);
    });


    // leaderboard top three

    app.get(`/top-leaders` , async (req , res) => {
      try{

        const result = await usersCollections.find({}).sort({win:-1}).limit(3).toArray();
        res.send(result)
        
      }catch (err) {
        console.log(err)
        res.status(400).send({message:'Top three winner is not declared'})
      }
    })


    // all winner 

    app.get(`/all-winner` , async (req , res) => {

      try {
              const result = await taskSubmissions.find({isWinner: true}).sort({declaredWinnerTime: -1}).toArray()
      res.send(result)
      console.log(result)
      } catch(err) {
        res.status(200).send({message:'No Winner is available'})
        console.log(err.message)
      }

    })

    // approve data update

    app.patch("/approve-contest", async (req, res) => {
      const { _id } = req.body;
      const result = await pendingCollections.updateOne(
        { _id: new ObjectId(_id) },
        { $set: { status: "approved" } }
      );
      res.send(result);
    });

    //rejects contest by admin

    app.patch("/reject-contest", async (req, res) => {
      const { _id } = req.body;
      const result = await pendingCollections.updateOne(
        { _id: new ObjectId(_id) },
        { $set: { status: "rejected" } }
      );
      res.send(result);
    });

    //sorting data by participate count

    app.get("/approve-contest", async (req, res) => {
      const result = await pendingCollections
        .find({ status: "approved" })
        .sort({ participant: -1 })
        .limit(6)
        .toArray();
      res.send(result);
    });

    app.get("/all-approve-contest", async (req, res) => {
      const result = await pendingCollections
        .find({ status: "approved" })
        .toArray();
      res.send(result);
    });

    app.delete("/delete-contest/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const objectId = new ObjectId(id);
        const result = await pendingCollections.deleteOne({ _id: objectId });
        res.send(result);
      } catch (err) {
        res.status(400).send({ message: "Invalid contest ID" });
      }
    });

    // single detail router

    app.get(`/detail-contest/:id`, async (req, res) => {
      try {
        const { id } = req.params;
        const objectId = new ObjectId(id);
        const result = await pendingCollections.findOne({ _id: objectId });
        res.send(result);
        console.log(result);
      } catch (err) {
        res.status(500).send({ message: "Server Error" });
      }
    });

    //payment section

    app.post(`/create-checkout-session`, async (req, res) => {
      const paymentInfo = req.body;
      // console.log(paymentInfo);
      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            // Provide the exact Price ID (for example, price_1234) of the product you want to sell
            price_data: {
              currency: "usd",
              product_data: {
                name: paymentInfo?.name,
                description: paymentInfo?.description,
                images: [paymentInfo?.image],
              },
              unit_amount: paymentInfo?.price * 100,
            },
            quantity: 1,
          },
        ],
        customer_email: paymentInfo?.participant?.email,
        mode: "payment",
        metadata: {
          contestId: paymentInfo?.contestId,
          contest_deadline: Number(paymentInfo?.deadline),
          participant_email: paymentInfo?.participant?.email,
          participant_name: paymentInfo?.participant?.name,
          contestType: paymentInfo?.contestType,
        },

        success_url: `${process.env.CLIENT_DOMAIN}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.CLIENT_DOMAIN}/detail-contest/${paymentInfo?.contestId}`,
      });

      res.send({ url: session.url });
    });

    app.post(`/payment-success`, async (req, res) => {
      try {
        const { sessionId } = req.body;
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        const contest = await pendingCollections.findOne({
          _id: new ObjectId(session?.metadata?.contestId),
        });

        const rawDeadline = session.metadata.contest_deadline;
        const deadline = rawDeadline ? Number(rawDeadline) : null;

        const participate = await participantCollections.findOne({
          transactionId: session?.payment_intent,
        });

        if (session.payment_status === "paid" && contest && !participate) {
          const participantInfo = {
            contestId: session?.metadata?.contestId,
            transactionId: session?.payment_intent,
            participant_email: session?.metadata?.participant_email,
            participant_name: session?.metadata?.participant_name,
            payment_status: session?.payment_status,
            deadline,
            created_by: contest?.create_by,
            contest_name: contest?.name,
            participant_pay: session?.amount_total / 100,
            image: contest?.image,
          };

          console.log(participantInfo);

          const result = await participantCollections.insertOne(
            participantInfo
          );

          // update participant count

          if (result.insertedId) {
            await pendingCollections.updateOne(
              { _id: new ObjectId(session?.metadata?.contestId) },
              { $inc: { participant: 1 } }
            );
          }

          res.send({
            success: true,
            transactionId: session.payment_intent,
            paymentId: result.insertedId,
          });
        }
      } catch (err) {
        res.status(500).send({ message: "Payment verification failed" });
      }
    });

    //------------------dashboard---------------

    //user my contest for query

    app.get(`/my-contest`, async (req, res) => {
      try {
        const { email } = req.query;
        const result = await participantCollections
          .find({ participant_email: email })
          .sort({ deadline: 1 })
          .toArray();
        res.send(result);
      } catch (err) {
        console.log(err);
      }
    });

    // creatorContest ja create korse creator

    app.get(`/creator-contest`, async (req, res) => {
      try {
        const { email } = req.query;
        const result = await pendingCollections
          .find({ "create_by.email": email })
          .toArray();
        res.send(result);
      } catch (err) {
        console.log(err);
      }
    });

    app.patch(`/edit-contest/:id`, async (req, res) => {
      try {
        const { id } = req.params;
        const updateInfo = req.body;
        console.log(updateInfo);
        const objectId = new ObjectId(id);
        const result = await pendingCollections.updateOne(
          { _id: objectId },
          { $set: updateInfo }
        );
        res.send(result);
        console.log(result);
      } catch (err) {
        console.log(err.message);
        res.status(500).send({ error: "Update failed" });
      }
    });

    // create submission collections

    app.post(`/submit-task`, async (req, res) => {
      try {
        const submitTaskInfo = req.body;
        if (submitTaskInfo) {
          const result = await taskSubmissions.insertOne(submitTaskInfo);
          res.send(result);
        }
      } catch (err) {
        console.log(err);
        res.status(500).send({ message: "Submit failed" });
      }
    });

    // taskSubmissions get for contest

    app.get(`/submit-task`, async (req, res) => {
      try {
        const {contestId} = req.query;
        const result = await taskSubmissions.find({ contestId :contestId }).toArray();
        res.send(result);
      } catch (err) {
        console.log(err);
      }
    });

    //open submit button

    app.get(`/submit-task-open`, async (req, res) => {
      try {
        const { email, contestId } = req.query;
        const result = await participantCollections.findOne({
          participant_email: email,
          contestId,
          payment_status: "paid",
        });
        res.send(result);
      } catch (err) {
        console.log(err);
      }
    });

     //winner declared

    app.patch(`/announce-winner` , async (req , res) => {

      try{
      const {_id , contestId} = req.body;
      const alreadyWinner = await taskSubmissions.findOne({contestId:contestId , isWinner:true })
      if(alreadyWinner) {
       return  res.status(409).send({message:'Winner is already declared'});
      }

      const objectId = new ObjectId(_id)

      const submission = await taskSubmissions.findOne({_id: objectId}) ;
      if (!submission) {
        return res.status(409).send({message: 'Submission not found'})
      }

      await taskSubmissions.updateOne({_id:objectId} , {$set : {isWinner:true , declaredWinnerTime: new Date()}}) 

      await usersCollections.updateOne({email: submission.participant_email} , {$inc:{win : 1}})

      res.send({message:'Winner is declared successfully'})
      } catch (err) {
        console.log(err.message)
      }

    })


    app.post("/user", async (req, res) => {
      const userData = req.body;
      userData.create_at = new Date().toISOString();
      userData.last_loggedIn = new Date().toISOString();
      userData.role = "user";
      const query = { email: userData.email };

      const alreadyExists = await usersCollections.findOne(query);

      if (alreadyExists) {
        const result = await usersCollections.updateOne(query, {
          $set: {
            last_loggedIn: new Date().toISOString(),
          },
        });

        return res.send(result);
      }
      const result = await usersCollections.insertOne(userData);
      console.log(userData);
      res.send(result);
    });




    // get all users


  app.get("/all-users", async (req, res) => {
  try {
    const result = await usersCollections.find({}).toArray();
    res.send(result);
  } catch (err) {
    console.log(err.message);
    res.status(500).send({ error: "Failed to fetch users" }); // optional: error response
  }
});



  app.patch(`/change-role` , async(req , res) => {

    try{
      const {email , role} = req.body;
      console.log(email , role);
      const result = await usersCollections.updateOne({email:email} , {$set: {role:role}});
      res.send(result)
    } catch(err) {
      console.log(err.message)
    }
    

  })























    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("beline");
});

app.listen(port, () => {
  console.log(`app listening port${port}`);
});
