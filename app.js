const express = require("express");
const app = express();
const mongoose = require("mongoose");
const Listing = require("./models/listing.js");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const wrapAsync = require("./utils/wrapAsync.js");
const ExpressError = require("./utils/ExpressError.js");
const { error } = require("console");
const Review = require("./models/review.js");
const session = require("express-session");
const flash = require("connect-flash");
const passport = require("passport");
const passportlocal = require("passport-local");
const User = require("./models/users.js");
const { isLogin } = require("./middleware.js");
const { register } = require("module");

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.engine("ejs", ejsMate);
app.use(express.static(path.join(__dirname, "/public")));

const sessionoption = {
  secret: "yamanrajsingh",
  resave: false,
  saveUninitialized: true,
  cookie: {
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
  },
};
// Checking route
app.get("/", (req, res) => {
  res.send("Working");
});

app.use(session(sessionoption));
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());
passport.use(new passportlocal(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.currUser = req.user;
  next();
});

main()
  .then((res) => {
    console.log("Connection with Database Succesfully...");
  })
  .catch((err) => {
    console.log(" Opps Error in Connection with Database ");
  });
async function main() {
  await mongoose.connect("mongodb://127.0.0.1:27017/wanderlust");
}
// ------------------------SignUp
app.get("/signup", (req, res) => {
  res.render("users/signup.ejs");
});

app.post(
  "/signup",
  wrapAsync(async (req, res) => {
    try {
      let { username, email, password } = req.body;
      const newUser = new User({ email, username });
      const Registeruser = await User.register(newUser, password);
      console.log(Registeruser);
      req.login(Registeruser, (err) => {
        if (err) {
          return next(err);
        }
        req.flash("success", "Welcome to wanderlust");
        res.redirect("/lists");
      });
    } catch (e) {
      req.flash("error", "User already register");
      res.redirect("/signup");
    }
  })
);

//--------------------------Login
app.get("/login", (req, res) => {
  res.render("users/login.ejs");
});

app.post(
  "/login",
  passport.authenticate("local", {
    failureRedirect: "/login",
    failureFlash: true,
  }),
  wrapAsync(async (req, res) => {
    req.flash("success", "Welcome to Wanderlust");
    res.redirect("/lists");
  })
);

//-------------------------Logout

app.get("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    req.flash("success", "You are logout now");
    res.redirect("/lists");
  });
});
// All Listings show
app.get("/lists", async (req, res) => {
  const allisting = await Listing.find({});
  res.render("listings/index.ejs", { allisting });
});
//render create.ejs
app.get("/list/new", isLogin, (req, res) => {
  res.render("listings/create.ejs");
});

// Add a list
app.post(
  "/lists",
  isLogin,
  wrapAsync(async (req, res) => {
    const newListing = new Listing(req.body.listing);
    newListing.owner=req.user._id;
    await newListing.save();
    console.log(newListing);
    req.flash("success", " New List Added Succesful!");
    res.redirect("/lists");
  })
);

// show a list by id
app.get(
  "/list/:id",
  wrapAsync(async (req, res) => {
    let { id } = req.params;
    const list = await Listing.findById(id)
      .populate("reviews")
      .populate("owner");
    if (!list) {
      req.flash("error", "Requested list does nor exist");
      res.redirect("/lists");
    }
    res.render("listings/show.ejs", { list });
  })
);

// to edit by id
app.get(
  "/list/:id/edit",
  isLogin,
  wrapAsync(async (req, res) => {
    let { id } = req.params;
    const list = await Listing.findById(id);
    if (!list) {
      req.flash("error", "Requested list does nor exist");
      res.redirect("/lists");
    }
    res.render("listings/edit.ejs", { list });
  })
);

//to update
app.put(
  "/list/:id",
  isLogin,
  wrapAsync(async (req, res) => {
    let { id } = req.params;
    let listing= await Listing.findById(id);
    if(!listing.owner.equals(req.locals.currUser._id))
    {
      req.flash("error", "You don't have permission to edit")
      res.redirect(`/list/${id}`)
    }
    await Listing.findByIdAndUpdate(id, { ...req.body.listing });
    req.flash("success", " List update Succesful!");
    res.redirect("/lists");
  })
);

//to Delete
app.delete(
  "/list/:id",
  isLogin,
  wrapAsync(async (req, res) => {
    let { id } = req.params;
    await Listing.findByIdAndDelete(id);
    req.flash("success", "  List Deleted Succesful!");
    res.redirect("/lists");
  })
);

// review delete
app.delete(
  "/list/:id/reviews/:rId",
  isLogin,
  wrapAsync(async (req, res) => {
    let { id, rId } = req.params;
    console.log(id);
    await Listing.findByIdAndUpdate(id, { $pull: { reviews: rId } });
    await Review.findByIdAndDelete(rId);
    req.flash("success", " Review deleted succesful!");
    res.redirect(`/list/${id}`);
  })
);

// review post

app.post(
  "/list/:id/reviews",
  wrapAsync(async (req, res) => {
    let listing = await Listing.findById(req.params.id);
    let newReview = new Review(req.body.review);
    listing.reviews.push(newReview);
    await newReview.save();
    await listing.save();
    req.flash("success", " New Review Added Succesful!");
    res.redirect(`/list/${listing._id}`);
  })
);

// delete review route

app.all("*", (req, res, next) => {
  next(new ExpressError(404, "Page Not Found!"));
});

app.use((err, req, res, next) => {
  let { statusCode = 500, message = "Something error Occured" } = err;
  res.render("listings/error.ejs", { message });
});

app.listen(8080, () => {
  console.log("server is running on  http://localhost:8080/lists ");
});
