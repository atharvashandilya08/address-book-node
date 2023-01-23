// This file handles all the server based operations and database handling

// Importing the dependencies

const express = require("express"); // Importing the server handling framework/module
const bodyParser = require("body-parser"); // Importing the framework/module to take data from the frontend
const bcrypt = require("bcrypt"); // Importing the framework/module to hash the password
const session = require("express-session") // Importing the framework/module to handle cookies/session tokens
const passport = require("passport") // Importing the framework/module to authenticate
const mongoose = require("mongoose") // Adding Databse 
const passportLocalMongoose = require("passport-local-mongoose") // Importing the Framework to register user in database
const GoogleStrategy = require('passport-google-oauth20').Strategy; // Importing the google oauth module
const GitHubStrategy = require("passport-github2"); // Importing the github oauth module

require("dotenv").config() // Configuring environment variables

// Server Configurations
const app = express(); // Creating the server
app.use(bodyParser.urlencoded({ extended: true })); // Setting the server to take data from the frontend
app.use(express.static(__dirname+"/public")) // Setting the assets path
app.set("view engine", "ejs") // Setting View Engine for the frontend
// Configuring session tokens/cookies
function configSessions() {
    // Adding cookies
    app.use(session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false
    }));

    app.use(passport.initialize()); // Initializing Authentication Systems
    app.use(passport.session()); // Initializing Session Tokens/Cookies related to authentication
}

configSessions(); // Configuring Sessions
// Configuring Session Tokens/Cookies in the Database
mongoose.connect(process.env.MONGOOSE_URL, 
    err => { 
        err ? 
        console.log(err) // Executes when there is an error
        : 
        console.log("MongoDB Server Started Successfully!") // Executes when the database is connected
});
// Setting the Schema or the structure of a database Entry
const userSchema = new mongoose.Schema({ 
    username: { type: String, required: true }, // Plain Text
    email: { type: String, required: true }, // Plain text
    password: { type: String, required: true }, // Hashed
    addressBook: { type: Array, required: true } // Structure: [{"name" : "Green Sval", group: "Friends", "companyOrSchool":"Google", "phone":"+91-1234567890", "email":"green.sval@gmail.com", "address":"#83, Frandal Brundi St, Salamala Block 4, Jyanim - 635612"}]
});

userSchema.plugin(passportLocalMongoose); // Adding the passport local mongoose plugin to the database

const User = mongoose.model("User", userSchema); // Adding the Database Model

passport.use(User.createStrategy()); // Initializing local strategy: a method to sign in through username and password

passport.serializeUser(User.serializeUser()) // Initializing sign-in method
passport.deserializeUser(User.deserializeUser()) // Initializing sign-out method

passport.use(new GoogleStrategy({ // Making the server use the google oauth
    clientID: process.env.GOOGLE_CLIENT_ID, // Client ID
    clientSecret: process.env.GOOGLE_CLIENT_SECRET, // Client Secret
    callbackURL: "https://address-book-full.onrender.com/auth/google/address-book", // Callback URL
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo" // Solving the google+ deprecation error
  },
  function(accessToken, refreshToken, profile, done) { // A function to callback
    User.findOne({
        'google.id': profile.id 
    }, function(err, user) {
        if (err) {
            return done(err);
        }
        if (!user) { // If there are no users
            user = new User({ // Creating a new user
                name: profile.displayName,
                email: profile.emails[0].value,
                username: profile.username,
                addressBook: [],
                provider: 'google',
                google: profile._json
            });
            user.save(function(err) {
                if (err) console.log(err);
                return done(err, user);
            });
        } else {
            //found user. Return
            return done(err, user);
        }
    });
  }
));

passport.use(new GitHubStrategy({ // Making the server use the github oauth
    clientID: process.env.GITHUB_CLIENT_ID, // Client ID
    clientSecret: process.env.GITHUB_CLIENT_SECRET, // Client Secret
    callbackURL: "https://address-book-full.onrender.com/auth/github/address-book", // Callback URL
  },
  function(accessToken, refreshToken, profile, done) { // A function to callback
    User.findOne({
        'github.id': profile.id 
    }, function(err, user) {
        if (err) {
            return done(err);
        }
        if (!user) { // If there are no users
            user = new User({ // Creating a new user
                name: profile.displayName,
                email: profile.emails[0].value,
                username: profile.username,
                addressBook: [],
                provider: 'github',
                github: profile._json
            });
            user.save(function(err) {
                if (err) console.log(err);
                return done(err, user);
            });
        } else {
            //found user. Return
            return done(err, user);
        }
    });
  }
));

app.get("/", (req, res) => { // Rendering the frontend of the home route
    if(req.isAuthenticated()){ // Checking wether the user is logged in or not
        res.redirect("/home") // Get's redirected to the dashboard if the user is logged in
    } else {
        res.render("homeAnonymous"); // Posts Frontend of the homepage for those who are anonymous

    }
});

app.get("/home", async (req, res) => { // Rendering the frotnend of the dashboard
    if(req.isAuthenticated()){ // If the user is logged in
        const currentUser = req.user; // The credentials of the user who has just logged in
        const [userDatabase] = await User.find({username: currentUser.username}); // The database of the user who has logged in
        const fullAddressBook = userDatabase.addressBook; // Full address book of the user who has just logged in
        const groups = [] // Number of groups
        if (fullAddressBook.length > 0){ // If the address book is not empty
            fullAddressBook.forEach(contact=>{ // For every contact in the list
                groups.push(contact.group) // The code pushes the group of the contact
            })
        } else { // If the address book is empty
            groups.push("Default"); // The code adds a "Default" group
        }
        res.render("homeAuthorized", { groups: groups }) // And renders the dashboard
    } else { // If the user is not logged in
        res.redirect("/") // User will be redirected to the homepage for anonymous users
    }
})

app.get("/about", (req, res) => { // Rendering the About Page's frontend

    if(req.isAuthenticated()){ // If the user is authenticated
        res.render("about") //Posts the About Page's frontend
    } else { // If not
        res.redirect("/") // Posts the homepage for anonymous users
    }
})

app.get("/contact", (req, res) => { // Rendering the Contact Page's frontend
    if(req.isAuthenticated()){ // If the user is authenticated
        res.render("contact") //Posts the Contact Page's frontend
    } else { // If not
        res.redirect("/") // Posts the homepage for anonymous users
    }
    
})
app.get("/book", async (req, res) => { // Rendering the Addrss Book Page's frontend.

    if(req.isAuthenticated()){ // If the user is authenticated
        const [userDatabase] = await User.find({username: req.user.username}); // The user's credentials in the database
        const fullAddressBook = userDatabase.addressBook; // The users address book
        res.render("book", {book: fullAddressBook, heading: "Your Contacts"}) // Rendering the Address Book page
    } else { // If the user is Anonymous
        res.redirect("/") // Renders the homepage for anonymous users
    }
})
app.get("/new-contact", async (req, res) => { // Rendering the page for a new contact creation
    if(req.isAuthenticated()){ // If the user is logged in
        const currentUser = req.user; // The logged in user's credentials
        const [userDatabase] = await User.find({username: currentUser.username}); // The same credentials in the database
        const fullAddressBook = userDatabase.addressBook; // The address book of the user
        const groups = [] // All the groups
        if (fullAddressBook.length > 0){ // If the address book is not empty
            fullAddressBook.forEach(contact=>{ // For every contact in the book
                groups.push(contact.group) // It pushses the group of the contact into the group array
            })
        } else { // If the address book is empty
            groups.push("Default"); // It pushes a "Default" group
        }
        res.render("entry", {groups: groups}) // Renders the new-contact page
    } else { // If the user is anonymous
        res.redirect("/") // Renders the homepage for anonymous users.
    }
});
app.get("/search", (req, res) => { // Rendering the search page
    if(req.isAuthenticated()){ // If the user is logged in
        res.render("search") // Renders the frontend
    } else { // If not
        res.redirect("/") // Renders the homepage for anonymous users
    }
});
app.post("/search", async (req, res) => { // Posting the logic of the search page
    if(req.isAuthenticated){ // If the user is logged in
        const [userDatabase] = await User.find({username: req.user.username}) // The logged in user's credentials in the database
        const fullAddressBook = userDatabase.addressBook; // The user's address book
        const filtered = fullAddressBook.filter(contact => contact.name.toLowerCase().includes(req.body.searchInput.toLowerCase())) // Filtered address book (Contacts which matches the search results)
        res.render("book", { book: filtered, heading: "Search Results" }); // Renders the search results
    } else { // If the user is not logged in
        res.redirect("/"); // Renders the homepage for anonymous users
    }
    
});
app.get("/login", (req, res) => { // Rendering the login page
    res.render("login") // Renders the frontend
});
app.post("/login", async (req, res) => { // Login page's logic
    const username = req.body.loginUsername; // The username which is typed in
    const password = req.body.loginPassword; // The password which is typed in
    const email = req.body.loginEmail; // The email which is typed in
    const [foundUser] = await User.find({ // Finds a user in the database which matches the credentials
        username: username,
        password: password,
        email: email
    });
    if(foundUser){ // If a user is found
        const user = new User({ // It creates a new user object which can be used to login
            username: username,
            email: email,
            password: password
        });
        req.login(user, function(err) { // Logging in the user
            if (err) { // If there are any errors
                 console.log(err); // Shows the error
                 res.redirect('/login') // Redirects to the login page
            } else { // if there are no errors
                passport.authenticate('local') // Authenticates the user
                res.redirect("/home") // Redirects the user to the dashboard
            }
          });
    } else { // If there are no users which match the credentials
        res.redirect("/login") // Clears all the input
    }
    


})
app.get("/register", (req, res) => { // Rendering the register page
    res.render("register"); // Renders the frontend
});
app.post("/register", async (req, res) => { // Register page's logic
    User.register({username: req.body.username, password: req.body.password, email: req.body.email}, req.body.password, (err, user)=>{ // Registering the user
        if(err){ // If there are any errors
            console.log(err); // Shows the error
            res.redirect("/register") // Redirects to the Register page
        } else { // If there are no errors
            passport.authenticate("local")(req, res, function(){ // Authenticates the user and creates a user
                res.redirect("/home"); // Redirects to the dashboard
            })
        }
    })

});



app.get("/logout", (req, res)=>{ // Logout logic
    req.logout(function(err) { // Logs out the user
        if (err) { // If there are any errors
            console.log(err); // Shows the error
            res.redirect("/home") // Redirects back to the dashboard
        }
        res.redirect('/'); // If there are no errors, it redirects to the homepage for anonymous users and logs out.
      });
});

app.post("/new-contact", async (req, res)=>{ // Logic for creating a new contact
    if(req.isAuthenticated()){ // If the user is logged in
        const username = req.user.username; // The username of the user
        const [userDatabase] = await User.find({username: username}); // The same user found in the database
        const fullAddressBook = userDatabase.addressBook; // The user's address book
        const group = req.body.group ? // If the group is not empty
        req.body.group // Sets the group to be the group entered in the form 
        : // If the group is empty
         "Default"; // Sets the group to be "Default"
        const newContact = { // Creating the new contact
            name: req.body.name, // Name of the contact
            companyOrSchool: req.body.companyOrSchool, // Company/School of the contact
            group: group, // Group of the contact
            phone: req.body.phone, // Phone of the contact
            email: req.body.email, // Email of the contact
            address: req.body.address // Address of the contact
        }
        fullAddressBook.push(newContact); // Adds a new contact into the address book
        User.updateOne({username: username}, {addressBook: fullAddressBook}, err=>{ // Updating the address book
            if(!err){ // If there are no errors
                res.redirect("/book") // Redirects the user to the Address Book page
            }else{ // If there are errors
                res.redirect("/new-contact"); // Redirects the user to the contact creation page
            }
        })
        
    }else{ // If the user is not logged in 
        res.redirect("/") // Redirects to the homepage for anonymous users
    }
});

app.get("/groups/:groupName", async(req, res)=>{ // Getting the contacts in a specific group
    if(req.isAuthenticated){ // If the user is logged in
        const [userDatabase] = await User.find({username: req.user.username}) // Finds the user in the database
        const fullAddressBook = userDatabase.addressBook // The user's address book
        const filteredAddressBook = fullAddressBook.filter(contact => contact.group === req.params.groupName); // Gets all the contacts with the same group as the filter is applied
        res.render("book", {heading: req.params.groupName, book: filteredAddressBook}); // Renders the contacts with the specific group
    } else { // If the user is anonymous
        res.redirect("/") // Redirects to the homepage for anonymous users
    }
    
})

app.get("/delete-contact/:contactName", async (req, res)=>{ // Deleting contacts using a name
    if(req.isAuthenticated){ // If the user is logged in
        const [userDatabase] = await User.find({username: req.user.username}); // Finds the user in the database
        const fullAddressBook = userDatabase.addressBook; // The full address book of the user
        const filteredAddressBook = fullAddressBook.filter(contact=>contact.name !== req.params.contactName.split("%20").join(" ")); // Takes out all the contacts which matches the name of the contact which should be deleted 
        await User.updateOne({username: req.user.username}, {addressBook: filteredAddressBook}); // Updates the address book
        res.redirect("/book") // Redirects user to the address book page
    }else{ // If the user is anonymous
        res.redirect("/") // Redirects to the homepage for anonymous users
    }
})

app.get("/auth/google/", // Get request to get the google authentication route
    passport.authenticate("google", { scope: ["profile"] }) // Authenticating the user
);

app.get("/auth/google/address-book",  // Get request to get the second step of google authentication
    passport.authenticate("google", {failureRedirect: "/"}), // Authenticating the user
    (req, res)=>{ // If authentication is successfull.
        res.redirect("/home") // Success Redirect
    }
);

app.get("/auth/github", // Getting the github authentication page
    passport.authenticate('github', { scope: [ 'user:[email,username]' ] })
    );
app.get('/auth/github/address-book', 
    passport.authenticate('github', { failureRedirect: '/' }),
    function(req, res) {
      // Successful authentication, redirect home.
      res.redirect('/home');
    });

app.listen(process.env.PORT||8080, () => { // Starts the server on port 8080 (http://localhost:8080)
    console.log("Server has started!") // Prints out if it's successfull
})