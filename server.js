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
        const roomClients = io.sockets.adapter.rooms.get(room) || { size: 0 };
        
        if (roomClients.size >= 2) {
            socket.emit('error_msg', 'La sala está llena.');
            return;
        }

        socket.join(room);
        const role = roomClients.size === 0 ? 'X' : 'O';
        socket.emit('joined', role);

        if (roomClients.size === 1) { // Acaba de entrar el segundo jugador
            io.to(room).emit('game_ready');
        }
    });

    socket.on('make_move', (data) => {
        // Enviar la jugada al otro jugador de la sala
        socket.to(data.room).emit('move_made', data);
    });

    socket.on('disconnect', () => {
        // Si alguien se desconecta, no complicamos la lógica: avisamos a todos
        socket.broadcast.emit('error_msg', 'Un jugador se ha desconectado.');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});