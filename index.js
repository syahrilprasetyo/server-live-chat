const express = require("express");
const http = require("http");
const fs = require("fs");
const { Server } = require("socket.io");
const mysql = require("mysql");

const connection = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "thefepi2019",
  database: "hyphensDB",
});


connection.connect((err) => {
  if (err) {
    console.error("Error connecting to database:", err);
    return;
  }
  console.log("Connected to database");
});


const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (origin) {
        callback(null, true);
      } else {
        callback(new Error("Origin not allowed"));
      }
    },
    methods: ["GET", "POST"],
    allowedHeaders: ["my-custom-header"],
    credentials: true,
  },
});

// Store connected users
let connectedUsers = {};

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Authentication and Authorization
  // You can implement your authentication logic here
  // For demonstration purposes, I'm assuming a simple authentication using a token
  socket.on("authenticate", (token) => {
    // Check if token is valid and retrieve user information
   authenticateUser(token)
      .then((user) => {
       
    if (user) {
      connectedUsers[token] = socket.id;

      //  console.log(user)
      // Notify the client about successful authentication
      socket.emit("authenticated", user.name);
    } else {
      // Notify the client about failed authentication
      socket.emit("unauthenticated");
    }
      })
      .catch((error) => {
        console.error("Error authenticating user:", error);
      });

  });

  // Private Chat Initiation
  socket.on("private_chat", ({ recipientId, message }) => {

   
    const recipientSocketId = connectedUsers[recipientId];
    if (recipientSocketId) {
      // Room Creation
      const room = `${socket.id}-${recipientSocketId}`;
      socket.join(room);
      io.to(recipientSocketId).emit("private_chat_request", { room, recipientId, message });
    } else {
      // Handle recipient not found
      socket.emit("recipient_not_found");
    }
  });

  socket.on("private_message", ({ room, message }) => {
     // Broadcast the message to all users in the room
     io.to(room).emit("private_message", { message });
   });

});



const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


// Function to authenticate user
function authenticateUser(token) {

  
  return new Promise((resolve, reject) => {
    // Query to check if token exists in customer_tb
    const customerQuery = 'SELECT id, name FROM customers_tb WHERE email = ?';
    // Query to check if token exists in dokter_tb
    const dokterQuery = 'SELECT id, name FROM dokter_tb WHERE email = ?';

    // Execute both queries in parallel
    Promise.all([
      queryDatabase(customerQuery, token),
      queryDatabase(dokterQuery, token)
    ])
      .then(([customerResult, dokterResult]) => {
        // Combine results from both tables
        const combinedResult = [...customerResult, ...dokterResult];
        // If token exists in either table, resolve with user information
        if (combinedResult.length > 0) {
          resolve(combinedResult[0]); // Return the first result
        } else {
          resolve(null); // If token not found in either table, resolve with null
        }
      })
      .catch((error) => {
        reject(error); // Reject if any error occurs during database queries
      });
  });
}

// Function to execute a database query
function queryDatabase(query, token) {
  return new Promise((resolve, reject) => {
    connection.query(query, [token], (error, results) => {
      if (error) {
        console.error('Error querying database:', error);
        reject(error);
        return;
      }
      resolve(results); // Resolve with the query results
    });
  });
}

