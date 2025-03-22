const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const redisAdapter = require('socket.io-redis'); // This lets multiple dynos share messages

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// If a Redis URL is provided (by Heroku Redis), use it so that multiple dynos can communicate.
if (process.env.REDIS_URL) {
  io.adapter(redisAdapter(process.env.REDIS_URL));
  console.log('Redis adapter configured with URL:', process.env.REDIS_URL);
} else {
  console.log('No Redis adapter configured. Running on a single dyno.');
}

// Serve static files from the "public" folder (like index.html)
app.use(express.static(__dirname + '/public'));

// Handle Socket.IO connections
io.on('connection', socket => {
  console.log('A user connected:', socket.id);

  // When a user joins the game, they send their username
  socket.on('joinGame', username => {
    console.log(`${username} joined the game`);
    socket.username = username;
    io.emit('message', `${username} has joined the game.`);
  });

  // When a user sends a message, broadcast it to everyone
  socket.on('message', msg => {
    console.log(`Message from ${socket.username}: ${msg}`);
    io.emit('message', `${socket.username}: ${msg}`);
  });

  // When a user disconnects, notify everyone
  socket.on('disconnect', () => {
    console.log(`${socket.username} disconnected`);
    io.emit('message', `${socket.username} left the game.`);
  });
});

// Start the server on the given port (default is 3000)
const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
