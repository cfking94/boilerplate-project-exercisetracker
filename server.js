const express = require('express');
const app = express();
const cors = require('cors');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
require('dotenv').config();

// Set up MongoDB connection
mongoose.connect(process.env.DB_URI, {useNewUrlParser: true, useUnifiedTopology: true, useFindAndModify: false, useCreateIndex: true});

// Basic configuration
app.use(cors());

app.use(bodyParser.urlencoded({extended: false}));

app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

// API endpoint
const Schema = mongoose.Schema;

const userSchema = new Schema({
  username: {type: String, required: true, unique: true},
  log: [{type: Schema.Types.ObjectId, ref: 'Exercises'}]
});

const exerciseSchema = new Schema({
  description: {type: String, maxLength: 16, required: true},
  duration: {type: Number, required: true},
  date: {type: Date, default: Date.now}
});

const Users = mongoose.model('Users', userSchema);
const Exercises = mongoose.model('Exercises', exerciseSchema);

app.post('/api/users', (req, res) => {
  async function createUser() {
    try {
      const getUser = req.body.username;

      const user = new Users({
        username: getUser
      });

      const saveUser = await user.save()

      return res.json({
        _id: saveUser._id,
        username: saveUser.username
      });
    } catch (error) {
      console.log(error);
      return res.json({error: error.message});
    }
  };

  createUser();
});

app.get('/api/users', (req, res) => {
  async function getAllUsers() {
    try {
      const allUsers = await Users.find({})
      .select({log: 0, __v: 0})
      .exec();

      return res.json(allUsers);
    } catch (error) {
      console.log(error);
      return res.json({error: error.message});
    }
  };

  getAllUsers();
});

app.post('/api/users/:_id/exercises', (req, res) => {
  async function addExercise() {
    try {
      const id = req.params._id;
        
      let {description: getDesc, duration: getDur, date: getDate} = req.body;

      // Change null to undefined to make default "Date.now" work,
      // else verify date format
      if (!getDate) {
        getDate = undefined;
      } else if (!getDate.match(/^[0-9]{4}[-/][0-9]{2}[-/][0-9]{2}$/)) {
        throw new Error('Invalid date format');
      }

      const findUser = await Users.findById(id)
      .exec();

      if (!findUser) {
        throw new Error('ID not found');
      }

      const exercise = await new Exercises({
        description: getDesc,
        duration: getDur,
        date: getDate
      });

      findUser.log.push(exercise._id);

      const saveUser = await findUser.save();

      const saveExe = await exercise.save();

      return res.json({
        _id: findUser._id,
        username: findUser.username,
        description: saveExe.description,
        duration: saveExe.duration,
        date: new Date(saveExe.date).toDateString()
      });
    } catch (error) {
      console.log(error);
      return res.json({error: error.message});
    }
  };

  addExercise();
});

app.get('/api/users/:_id/logs', (req, res) => {
  async function getLogs() {
    try {
      const id = req.params._id;

      const {from, to, limit} = req.query;

      const userLog = await Users.findById(id)
      .populate('log')
      .exec();

      let logs = await userLog.log.map(i => {
        return {
          description: i.description,
          duration: i.duration,
          date: i.date
        };
      });

      // parameters to a /api/users/:_id/logs request
      if (from && to) {
        const fromDate = new Date(from);

        const toDate = new Date(to);
        
        logs = logs.filter(i => i.date <= toDate && i.date >= fromDate);
      } else if (from) {
        const fromDate = new Date(from);

        logs = logs.filter(i => i.date >= fromDate);
      } else if (to) {
        const toDate = new Date(to);

        logs = logs.filter(i => i.date <= toDate);
      }

      if (limit) {
        logs = logs.slice(0, limit);
      }

      const result = await logs.map(i => {
        return {
          description: i.description,
          duration: i.duration,
          date: new Date(i.date).toDateString()
        }
      });
      
      // return json
      if (from && to) {
        return res.json({
          _id: userLog._id,
          username: userLog.username,
          from: new Date(from).toDateString(),
          to: new Date(to).toDateString(),
          count: result.length,
          log: result
        });
      } else if (from) {
        return res.json({
          _id: userLog._id,
          username: userLog.username,
          from: new Date(from).toDateString(),
          count: result.length,
          log: result
        });
      } else if (to) {
        return res.json({
          _id: userLog._id,
          username: userLog.username,
          to: new Date(to).toDateString(),
          count: result.length,
          log: result
        });
      } else {
        return res.json({
          _id: userLog._id,
          username: userLog.username,
          count: result.length,
          log: result
        });
      }
    } catch (error) {
      console.log(error);
      return res.json({error: error.message})
    }
  };

  getLogs();
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
