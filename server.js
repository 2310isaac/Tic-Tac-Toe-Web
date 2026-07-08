const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Servir los archivos estáticos de la carpeta "public"
app.use(express.static('public'));

io.on('connection', (socket) => {
    socket.on('join_room', (room) => {
        // 1. Miramos cuánta gente hay ANTES de entrar
        const clientsInRoom = io.sockets.adapter.rooms.get(room);
        const numClients = clientsInRoom ? clientsInRoom.size : 0;
        
        if (numClients >= 2) {
            socket.emit('error_msg', 'La sala está llena.');
            return;
        }

        // 2. El jugador entra a la sala
        socket.join(room);
        
        // 3. Si no había nadie (0), eres la X. Si había 1, eres la O.
        const role = numClients === 0 ? 'X' : 'O';
        socket.emit('joined', role);

        // 4. Si el que acaba de entrar es el SEGUNDO jugador (numClients era 1), empezamos
        if (numClients === 1) { 
            io.to(room).emit('game_ready');
        }
    });

    socket.on('make_move', (data) => {
        // Enviar la jugada al otro jugador de la sala
        socket.to(data.room).emit('move_made', data);
    });

    socket.on('disconnect', () => {
        // Aviso si alguien se sale
        socket.broadcast.emit('error_msg', 'Un jugador se ha desconectado. Partida terminada.');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});