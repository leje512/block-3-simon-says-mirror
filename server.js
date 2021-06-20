var express = require('express');
var normalizePort = require('normalize-port');

var app = express();
//var server = app.listen(3000);
const PORT = normalizePort(process.env.PORT || '3000');
app.set('PORT', PORT);
var server = app.listen(app.get('PORT'));

app.use(express.static('public'));

var socket = require('socket.io');

var io = socket(server);

io.sockets.on('connection', function(socket) {
    
    socket.on('room', function(room) {
        room = room;
        console.log("joined room: " + room);
        socket.join(room);
    });

    socket.on('player', function(room, playerNumber) {
        //io.to(room).emit("player", playerNumber);
        socket.broadcast.to(room).emit("player", playerNumber);
    });

    socket.on("message", function(room, msg) {
        io.to(room).emit("message", msg);
    });

    socket.on("command", function(room, data) {
        socket.broadcast.to(room).emit("command", data);
    });

    socket.on("startGame", function(room) {
        console.log("start in server");
        socket.broadcast.to(room).emit("startGame");
    });

    socket.on("sendImage", function(room, image) {
        socket.broadcast.to(room).emit("sendImage", image);
    });

    socket.on("sendResults", function(room, data) {
        socket.broadcast.to(room).emit("sendResults", data);
    });

    socket.on("keyPoints", function(room, x, y) {
        socket.broadcast.to(room).emit("keyPoints", x, y);
    });

    socket.on("skeleton", function(room, data) {
        socket.broadcast.to(room).emit("skeleton", data);
    });

    socket.on("countdown", function(room, sec) {
        socket.broadcast.to(room).emit("countdown", sec);
    });

    socket.on("gameOver", function(room, stats) {
        socket.broadcast.to(room).emit("gameOver", stats);
    });
});