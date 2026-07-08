const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

io.on('connection', (socket) => {
    socket.on('join_room', (room) => {
        const clientsInRoom = io.sockets.adapter.rooms.get(room);
        const numClients = clientsInRoom ? clientsInRoom.size : 0;
        
        if (numClients >= 2) {
            socket.emit('error_msg', 'La sala está llena.');
            return;
        }

        socket.join(room);
        socket.currentRoom = room; // Guardamos la sala en la memoria del socket
        socket.wantsRestart = false; // Bandera para reiniciar
        
        const role = numClients === 0 ? 'X' : 'O';
        socket.emit('joined', role);

        if (numClients === 1) { 
            io.to(room).emit('game_ready');
        }
    });

    socket.on('make_move', (data) => {
        socket.to(data.room).emit('move_made', data);
    });

    // LÓGICA DE REINICIAR MUTUAMENTE
    socket.on('request_restart', (room) => {
        socket.wantsRestart = true;
        
        const clientsInRoom = io.sockets.adapter.rooms.get(room);
        if (!clientsInRoom) return;

        let allReady = true;
        for (const clientId of clientsInRoom) {
            const clientSocket = io.sockets.sockets.get(clientId);
            if (!clientSocket || !clientSocket.wantsRestart) {
                allReady = false;
                break;
            }
        }

        // Si ambos presionaron el botón y hay 2 personas
        if (allReady && clientsInRoom.size === 2) {
            // Reiniciamos las banderas
            for (const clientId of clientsInRoom) {
                const clientSocket = io.sockets.sockets.get(clientId);
                if (clientSocket) clientSocket.wantsRestart = false;
            }
            io.to(room).emit('restart_game'); // Avisamos a ambos que el juego se limpia
        } else {
            // Avisamos al otro jugador que queremos reiniciar
            socket.to(room).emit('opponent_wants_restart');
        }
    });

    // LÓGICA PARA SALIR DE LA SALA MANUALMENTE
    socket.on('leave_room', () => {
        if (socket.currentRoom) {
            socket.to(socket.currentRoom).emit('error_msg', 'El oponente ha salido de la sala. Partida cancelada.');
            socket.leave(socket.currentRoom);
            socket.currentRoom = null;
            socket.wantsRestart = false;
        }
    });

    socket.on('disconnect', () => {
        if (socket.currentRoom) {
            socket.to(socket.currentRoom).emit('error_msg', 'Un jugador se ha desconectado. Partida terminada.');
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});