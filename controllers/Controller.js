const User = require("../models/User");
const Appointment = require("../models/Appointment");
const jwt = require("jsonwebtoken");
const MongoClient = require("mongodb").MongoClient;
const sgMail = require("@sendgrid/mail");
const API_KEY =
  "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";
sgMail.setApiKey(API_KEY);

// handle errors for appointments
const handleErrorsForAppointments = (err, timeMessage) => {
  console.log(err.message, err.code);
  let errors = {
    date: "",
    time: "",
    phone: "",
    serviceType: "",
    description: "",
    timeMessage: "",
  };

  // Check if date is in the future
  if (err.message.includes("date must be in the future")) {
    errors.date = "Date must be in the future";
  }

  //
  // Check if the provided date is on a weekend (Saturday or Sunday)
  if (err.message.includes("Appointments cannot be scheduled on weekends")) {
    errors.date = "Appointments cannot be scheduled on weekends";
  }

  // Check if the time is between 9 AM and 4 PM
  if (
    err.message.includes(
      "Appointments can only be scheduled between 9 AM and 4 PM"
    )
  ) {
    errors.time = "Appointments can only be scheduled between 9 AM and 4 PM";
  }

  // Check if there are no times available
  if (err.message.includes("No times available")) {
    errors.time = "No times available.\n Choose another date.";
  }

  // Check if the provided time is already taken
  if (err.message.includes("Time is taken")) {
    errors.time = "Time is unavailable";
    errors.timeMessage =
      "The following times are available: " +
      timeMessage.timesAvailable.join(", ") +
      ".";
  }
  // Check if description data is greater than a certain length
  if (err.message.includes("description must be less than 300 characters")) {
    errors.description = "Description must be less than 300 characters";
  }

  // Check if description data is shorter than a certain length
  if (err.message.includes("description must be more than 10 characters")) {
    errors.description = "Description must be more than 10 characters";
  }
  // incorrect phone
  if (err.message === "incorrect phone") {
    errors.phone = "Invalid phone number";
  }

  // validation errors
  if (err.message.includes("appointments validation failed")) {
    Object.values(err.errors).forEach(({ properties }) => {
      errors[properties.path] = properties.message;
    });
  }

  return errors;
};

const handleErrorsForUsers = (err) => {
  console.log(err.message, err.code);
  let errors = { firstname: "", lastname: "", email: "", password: "" };

  // incorrect firstname (min)
  if (err.message === "First name must be at least 2 characters long") {
    errors.firstname = "First name must be at least 2 characters long";
  }
  // incorrect lastname (min)
  if (err.message === "Last name must be at least 2 characters long") {
    errors.lastname = "Last name must be at least 2 characters long";
  }
  // incorrect firstname length (max)
  if (err.message === "First name must be less than 30 characters long") {
    errors.firstname = "First name must be less than 30 characters long";
  }
  // incorrect lastname length (max)
  if (err.message === "Last name must be less than 30 characters long") {
    errors.lastname = "Last name must be less than 30 characters long";
  }

  // if firstname is a number
  if (err.message === "First name cannot contain a number") {
    errors.firstname = "First name cannot contain a number";
  }
  // if lastname is a number
  if (err.message === "Last name cannot contain a number") {
    errors.lastname = "Last name cannot contain a number";
  }

  // incorrect email
  if (err.message === "incorrect email") {
    errors.email = "Invalid email";
  }

  // incorrect password
  if (err.message === "incorrect password") {
    errors.password = "That password is incorrect";
  }

  // duplicate email error
  if (err.code === 11000) {
    errors.email = "That email is already registered";
    return errors;
  }

  // validation errors
  if (err.message.includes("user validation failed")) {
    // console.log(err);
    Object.values(err.errors).forEach(({ properties }) => {
      // console.log(val);
      // console.log(properties);
      errors[properties.path] = properties.message;
    });
  }

  return errors;
};

// create json web token
const maxAge = 3 * 24 * 60 * 60;
const createToken = (id) => {
  return jwt.sign({ id }, "secret", {
    expiresIn: maxAge,
  });
};

// controller actions
// get request for signup
module.exports.signup_get = (req, res) => {
  res.render("signup");
};
// get request for login
module.exports.login_get = (req, res) => {
  res.render("login");
};
// get request for logout
module.exports.logout_get = (req, res) => {
  // set cookie to nothing
  res.cookie("jwt", "", { maxAge: 1 });
  // redirect to home page
  res.redirect("/");
};
// get request for contact
module.exports.contact_get = (req, res) => {
  res.render("contact");
};

// get request for services
module.exports.services_get = (req, res) => {
  res.render("services");
};
// get request for about
module.exports.about_get = (req, res) => {
  res.render("about");
};
// get request for policies
module.exports.policies_get = (req, res) => {
  res.render("policies");
};
// get request for error
module.exports.error_get = (req, res) => {
  res.render("error");
};

// get request for profile
module.exports.profile_get = (req, res) => {
  // function that masks the password
  function maskPassword(password) {
    return "*".repeat(10);
  }
  // function that gets the full name
  function fullName(firstname, lastname) {
    return firstname + " " + lastname;
  }
  // get the password and user data
  const password = maskPassword(res.locals.user.password);
  const user = res.locals.user;
  const name = fullName(user.firstname, user.lastname);
  // render the profile page
  res.render("profile", { user, password, name });
};
// get request for schedule that provides the times that can be scheduled
module.exports.schedule_get = async (req, res) => {
  // get the times that are available regulary
  const timeValues = [
    "9:00 AM",
    "10:00 AM",
    "11:00 AM",
    "1:00 PM",
    "2:00 PM",
    "3:00 PM",
    "4:00 PM",
  ];
  res.render("schedule", { timeValues: timeValues });
};

// post request for signup
module.exports.signup_post = async (req, res) => {
  const { firstname, lastname, email, password } = req.body;
  // if firstname is less than 2 characters
  if (firstname.length < 2) {
    const errors = handleErrorsForUsers({
      message: "First name must be at least 2 characters long",
    });
    res.status(400).json({ errors });
    return;
  } // if firstname is greater than 30 characters
  else if (firstname.length > 30) {
    const errors = handleErrorsForUsers({
      message: "First name must be less than 30 characters long",
    });
    res.status(400).json({ errors });
    return;
  }
// if lastname is less than 2 characters
  if (lastname.length < 2) {
    const errors = handleErrorsForUsers({
      message: "Last name must be at least 2 characters long",
    });
    res.status(400).json({ errors });
    return;
  }// if lastname is greater than 30 characters
   else if (lastname.length > 30) {
    const errors = handleErrorsForUsers({
      message: "Last name must be less than 30 characters long",
    });
    res.status(400).json({ errors });
    return;
  }

  // check if firstname contains a number
  if (/\d/.test(firstname)) {
    const errors = handleErrorsForUsers({
      message: "First name cannot contain a number",
    });
    res.status(400).json({ errors });
    return;
  }

  // check if lastname contains a number
  if (/\d/.test(lastname)) {
    const errors = handleErrorsForUsers({
      message: "Last name cannot contain a number",
    });
    res.status(400).json({ errors });
    return;
  }

  try {
    // create a new user
    const user = await User.create({ firstname, lastname, email, password });
    // create a token
    const token = createToken(user._id);
    // set cookie
    res.cookie("jwt", token, { httpOnly: true, maxAge: maxAge * 1000 });
    // send response
    res.status(201).json({ user: user._id, email: user.email });
  } catch (err) {
    const errors = handleErrorsForUsers(err);
    res.status(400).json({ errors });
  }
};
// post request for login
module.exports.login_post = async (req, res) => {
  const { email, password } = req.body;

  try {
    // login user
    const user = await User.login(email, password);
    // create a token
    const token = createToken(user._id);
    // set cookie
    res.cookie("jwt", token, { httpOnly: true, maxAge: maxAge * 1000 });
    // send response
    res.status(200).json({ user: user._id, email: user.email });
  } catch (err) {
    const errors = handleErrorsForUsers(err);
    res.status(400).json({ errors });
  }
};

// function that gets the time values from the database
async function getData(date) {
  try {
    const appointments = await Appointment.find({ date: date });
    const timeValues = appointments.map((appointment) => appointment.time);
    return timeValues;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

// Handle the form submission for canceling an appointment
module.exports.cancelAppointment = (req, res) => {
  const appointmentId = req.params.id;

  // Update the appointment status to "canceled" in the database
  Appointment.findByIdAndDelete(appointmentId)
    .then(() => {
      res.redirect("/appointments");
    })
    .catch((err) => {
      console.log(err);
      res.render("error"); // Render an error page or handle the error appropriately
    });
};

// Shows the appointments page with the appointments for the logged in user
module.exports.appointment_get = (req, res) => {
  const userEmail = res.locals.user.email;
  Appointment.find({ email: userEmail, status: "Scheduled" })
    .then((appointments) => {
      appointments.forEach((appointment) => {
        const appointmentDate = new Date(appointment.date);
        const timeZoneOffset = appointmentDate.getTimezoneOffset() * 60000;
        const adjustedDate = new Date(
          appointmentDate.getTime() + timeZoneOffset
        );

        appointment.date = adjustedDate.toLocaleDateString("en-US", {
          timeZone: "America/Denver",
          year: "numeric",
          month: "long",
          day: "numeric",
        });
      });

      res.render("appointments", { appointments });
    })
    .catch((err) => {
      console.log(err);
      res.render("error");
    });
};

// Handle the form submission for scheduling an appointment
module.exports.schedule_post = async (req, res) => {
  const { email, date, time, phone, serviceType, description } = req.body;

  const timeValues = await getData(date);
  const timesAvailable = [
    "9:00 AM",
    "10:00 AM",
    "11:00 AM",
    "1:00 PM",
    "2:00 PM",
    "3:00 PM",
    "4:00 PM",
  ];

  // remove the times that are already taken from the times available
  for (let i = 0; i < timeValues.length; i++) {
    if (timesAvailable.includes(timeValues[i])) {
      timesAvailable.splice(timesAvailable.indexOf(timeValues[i]), 1);
    }
  }
  // Check if there are no times available
  if (timesAvailable.length === 0) {
    const errors = handleErrorsForAppointments({
      message: "No times available",
    });
    res.status(400).json({ errors });
    return;
  }

  // Check if the provided time is already taken
  if (timeValues.includes(time)) {
    const errors = handleErrorsForAppointments(
      { message: "Time is taken" },
      { timesAvailable }
    );
    res
      .status(400)
      .json({ errors: { ...errors, timeMessage: errors.timeMessage } });
    return;
  }
  // Check if the provided date is in the past
  if (new Date(date) < new Date()) {
    const errors = handleErrorsForAppointments({
      message: "date must be in the future",
    });
    res.status(400).json({ errors });
    return;
  }
  // Check if the provided date is on a weekend (Saturday or Sunday)
  const appointmentDate = new Date(date);
  const dayOfWeek = appointmentDate.getDay();

  // 5 is Saturday, 6 is Sunday and if the day is either of those, then return an error
  if (dayOfWeek === 5 || dayOfWeek === 6) {
    const errors = handleErrorsForAppointments({
      message: "Appointments cannot be scheduled on weekends",
    });
    res.status(400).json({ errors });
    return;
  }
  // check if time is between 9am and 4pm
  const appointmentTime = new Date(`2000-01-01T${time}`);
  const hour = appointmentTime.getHours();
  if (hour < 9 || hour >= 16) {
    const errors = handleErrorsForAppointments({
      message: "Appointments can only be scheduled between 9 AM and 4 PM",
    });
    res.status(400).json({ errors });
    return;
  }
  //check if description data is greater than a certain length
  if (description.length > 300) {
    const errors = handleErrorsForAppointments({
      message: "description must be less than 300 characters",
    });
    res.status(400).json({ errors });
    return;
  }
  //check if description data is shorter than a certain length
  if (description.length < 10) {
    const errors = handleErrorsForAppointments({
      message: "description must be more than 10 characters",
    });
    res.status(400).json({ errors });
    return;
  }

  // Create a new appointment instance
  const newAppointment = new Appointment({
    email,
    date,
    time,
    phone,
    serviceType,
    description,
    status: "Scheduled", // Set initial status as 'Scheduled'
  });
  // Save the new appointment to the database
  newAppointment
    .save()
    .then((savedAppointment) => {
      console.log("Appointment saved successfully!");
      // Send the appointment confirmation email
      sendEmail(email, date, time);
      // Redirect to appointments page after successful scheduling

      // Send the appointment data back in the response
      res.status(200).json({ appointment: savedAppointment });
    })
    .catch((err) => {
      const errors = handleErrorsForAppointments(err);
      res.status(400).json({ errors }); // Redirect to schedule page with an error message
    });
};

// For deleting an account and all appointments associated with that account
module.exports.delete_post = async (req, res) => {
  const user = req.params.id;
  const userEmail = req.params.email;
  try {
    // Delete the user from the database
    await User.findOneAndDelete({ _id: user });
    console.log("User deleted successfully");

    await Appointment.deleteMany({ email: userEmail });
    console.log("Appointments deleted successfully");

    // Redirect or send a response indicating successful deletion
    res.cookie("jwt", "secret", { maxAge: 1 });
    res.redirect("/"); // Example: Redirect to the homepage
  } catch (error) {
    console.error(error);
    // Handle any errors that occur during the deletion process
    // Redirect or send an error response
    res
      .status(500)
      .json({ error: "An error occurred while deleting the user account." });
  }
};

// Function that sends the email
function sendEmail(email, date, time) {
  const msg = {
    to: email,
    from: "techsolutions598@gmail.com",
    subject: "Appointment Confirmation",
    text: "dd",
    html: `<h1>Appointment Confirmation</h1>
    <p>Thank you for scheduling an appointment with us. Your appointment is scheduled for ${date} at ${time}. We will contact you if there are any changes. We look forward to seeing you!</p>
    <p>Thank you,</p>
    <p>TechSolutions</p>
    <p><a href="http://localhost:3000/appointments">Cancel</a></p>
    <p>For any questions or concerns, please contact us at 1-800-555-5555</p>`,
  };

  sgMail
    .send(msg)
    .then(() => {
      console.log("Email sent");
    })
    .catch((error) => {
      console.error(error);
    });
}
