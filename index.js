const express = require('express')
const app = express()
const cors = require('cors')
require('dotenv').config()
const mongoose = require('mongoose');
const bodyParser = require('body-parser');

app.use(cors())
app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});


// function to check if a date is valid and matches yyyy-mm-dd format
function errorIfInvalidDate(date){
  if (new Date(date) == "Invalid Date"){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)){
      throw new Error('Incorrect date format');
    }
    throw new Errow("Invalid date");
  }  
}

//connect to MongoDB and setup the user model
const MONGO_URI = process.env['MONGO_URI'];
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

let userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true
  },
  count: {
    type: Number,
    required: true,
    default: 0
  },
  log: {
    type: [{
      description: { type: String, required: true },
      duration: { type: Number, required: true },
      date: { type: String, required: true },
      _id: {type: mongoose.Types.ObjectId, select: false}
    }],
    default: []
  }
});

let User = mongoose.model('User', userSchema);

//GET request to get all users
app.get("/api/users", (req, res) => {
  //I'm using select to only include the _id and username in the response
  User.find({}).select(['_id', 'username']).exec((err, data) => {
    if (err) return console.error(err);
    res.json(data);
  })
});

// username creation POST requests
app.use("/api/users", bodyParser.urlencoded({ extended: false }))
  .post("/api/users", (req, res) => {

    let username = req.body.username;

    //create new document with input as username an new ObjectId as _id
    const jsonReply = { username: username, _id: new mongoose.Types.ObjectId() };
    User.create(jsonReply);
    res.json(jsonReply);
});

//POST request for exercise creation
app.use("/api/users/:_id/exercises", bodyParser.urlencoded({ extended: false }))
  .post("/api/users/:_id/exercises", (req, res) => {
  
  const id = req.params._id;
  const duration = parseInt(req.body.duration);
  const description = req.body.description;
  let date = req.body.date;
  


  //check that date is valid if it exists. If invalid, throw an error.
  if (date){
    errorIfInvalidDate(date);
  } else {
    //If date doesn't exist, use current date
    date = Date.now();
  }

  //Turn date into a Date object
  date = new Date(date);

  //need to find the user document and then save it to make use of
  //its preexisting count values (to do count++)
  User.findById(id, (err, data) => {

    if (err) return console.error(err);

    const newExercise = {
      description: description,
      duration: duration,
      date: date.toDateString()
    }

    data.count++;
    data.log.push(newExercise);
    data.save((err, data) => {
      if (err) return console.error(err);
      console.log("\nData:\n" + data + "\n");
      res.json({_id: id, username: data.username, date: newExercise.date, duration: duration, description: description});
    });
  });
});

//GET the excercise log for a user
app.get("/api/users/:_id/logs", (req, res) => {
  const id = req.params._id;
  //get FROM, TO and LIMIT parameters from the query
  let from = req.query.from;
  let to = req.query.to;
  let limit = req.query.limit;

  //throw an error and stop the process if FROM or TO exist and are invalid dates
  //if valid, turn them into their unix timestamp to be able to use them in comparison
  if (from){
    errorIfInvalidDate(from);
    from = Date.parse(from);
  }  
  if (to){
    errorIfInvalidDate(to);
    to = Date.parse(to);
  }
  

  //if limit is undefined turn it into MAX_VALUE
  //to allow for all excercises to be sent back
  if (!limit){
    limit = Number.MAX_VALUE;
  }

  User.findById(id, (err, data) => {
    if (err) return console.error(err);

    data.log = data.log.reduce((accum, excercise) => {
      //make the comparisons with to and from, and don't push them into
      //the new array if their dates don't fit within specifications
      if(from){
        if (Date.parse(excercise.date) < from){
          return accum;
        }
      }
      if(to){
        if (Date.parse(excercise.date) > to){
          return accum;
        }
      }
      accum.push(excercise);
      return accum;
    }, []);

    res.json({
      username: data.username, count: data.count,
      _id: id,
      log: data.log.slice(0, limit) //send back limit number of excercises at most
    });
  });
})



const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
});
