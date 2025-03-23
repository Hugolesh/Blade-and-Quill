// server.js

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const redisAdapter = require('socket.io-redis'); // Enables scaling with Redis if needed

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Global object to track players: key is socket.id and value is player data.
const players = {};

// Define a simple game world with locations and available exits.
const world = {
  house: {
    description: "You are in your house. It's cozy and familiar. Available exit: store",
    exits: { store: "store" }
  },
  store: {
    description: "You are at the Elder's Shop. 'Please be silent and don't break anything!' Available exits: house, park",
    exits: { house: "house", park: "park" }
  },
  park: {
    description: "You are at the park. The fresh air feels nice. Available exits: store, library",
    exits: { store: "store", library: "library" }
  },
  library: {
    description: "You are in the library. It smells of old books and secrets. Available exit: park",
    exits: { park: "park" }
  }
};

if (process.env.REDIS_URL) {
  io.adapter(redisAdapter(process.env.REDIS_URL));
  console.log('Redis adapter configured with URL:', process.env.REDIS_URL);
} else {
  console.log('No Redis adapter configured. Running on a single dyno.');
}

// Serve static files from the "public" folder
app.use(express.static(__dirname + '/public'));

io.on('connection', (socket) => {
  // Initialize player state
  players[socket.id] = {
    username: null,
    location: "house", // Start at "house"
    inventory: [],
    level: 1
  };

  console.log('A user connected:', socket.id);

  // When a player joins, store their username and send their starting location.
  socket.on('joinGame', (username) => {
    console.log(`${username} joined the game`);
    socket.username = username;
    players[socket.id].username = username;

    // Welcome message and location update to the new player
    socket.emit('message', `Welcome, ${username}!`);
    socket.emit('locationUpdate', {
      description: world[players[socket.id].location].description,
      exits: world[players[socket.id].location].exits
    });

    io.emit('message', `${username} has joined the game.`);
  });

  // Listen for "move" events when a player clicks an exit link.
  socket.on('move', (destination) => {
    const currentLocation = players[socket.id].location;
    const availableExits = world[currentLocation].exits;
    
    if (availableExits[destination]) {
      players[socket.id].location = availableExits[destination];
      const newLocation = players[socket.id].location;
      
      // Send updated location information to the moving player
      socket.emit('locationUpdate', {
        description: world[newLocation].description,
        exits: world[newLocation].exits
      });
    } else {
      // If the destination is not available from the current location
      socket.emit('locationUpdate', {
        description: "You can't go that way from here!",
        exits: availableExits
      });
    }
  });

  // Regular chat messages broadcast to everyone
  socket.on('message', (msg) => {
    console.log(`Message from ${socket.username}: ${msg}`);
    io.emit('message', `${socket.username}: ${msg}`);
  });

  socket.on('disconnect', () => {
    console.log(`${socket.username} disconnected`);
    io.emit('message', `${socket.username} left the game.`);
    delete players[socket.id];
  });
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
