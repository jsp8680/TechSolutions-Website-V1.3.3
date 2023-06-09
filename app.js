const express = require('express');
const mongoose = require('mongoose');
const Routes = require('./routes/availableRoutes');
const cookieParser = require('cookie-parser');
const { requireAuth, checkUser } = require('./middleware/middleware');
const bodyParser = require('body-parser');
const app = express();

// middleware
app.use(express.static('public'));
app.use(express.json());
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// view engine
app.set('view engine', 'ejs');

// database connection
const dbURI = 'mongodb+srv://censedpower8:coco1234@cluster1.hupl8dz.mongodb.net/clients';
mongoose.connect(dbURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then((result) => app.listen(3000),console.log('Server is running on port 3000 http://localhost:3000/'))
  .catch((err) => console.log(err));

// routes

// checks if the user is authenticated for every route.
app.get('*', checkUser);
// renders the "home" view when accessing the root URL.
app.get('/', (req, res) => res.render('home'));

app.use(Routes);

// for testing purposes
// const createApp = () => app;

// module.exports = createApp;