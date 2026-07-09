// Importamos Express (servidor web) y Socket.io (conexiones en tiempo real WAN)
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

// Inicializamos el entorno del servidor HTTP
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Le decimos al servidor que ofrezca los archivos visuales (HTML, JS, CSS) al navegador del cliente
app.use(express.static('public'));

// Evento principal: Se dispara cada vez que un usuario abre la página en su navegador
io.on('connection', (socket) => {
    
    // Un jugador intenta unirse a una "sala" o cuarto virtual privado
    socket.on('join_room', (room) => {
        // Consultamos cuántos jugadores hay actualmente en la sala solicitada
        const clientsInRoom = io.sockets.adapter.rooms.get(room);
        const numClients = clientsInRoom ? clientsInRoom.size : 0;
        
        // Bloqueo de seguridad: El Tic Tac Toe solo permite 2 jugadores máximo
        if (numClients >= 2) {
            socket.emit('error_msg', 'La sala está llena.');
            return;
        }

        socket.join(room); // Introduce al jugador en el cuarto virtual
        socket.currentRoom = room; // Registra la sala en la memoria persistente del usuario
        socket.wantsRestart = false; // Bandera de estado para revanchas
        
        // Asignación de fichas: El primero en llegar es la X, el segundo es la O
        const role = numClients === 0 ? 'X' : 'O';
        socket.emit('joined', role);

        // Si este usuario fue el segundo en llegar, la sala está completa. Arranca la partida.
        if (numClients === 1) { 
            io.to(room).emit('game_ready');
        }
    });

    // Túnel de comunicación central: Recibe la coordenada jugada (X,Y,Z) y se la reenvía al oponente
    socket.on('make_move', (data) => {
        socket.to(data.room).emit('move_made', data);
    });

    // LÓGICA DE SINCRONIZACIÓN MUTUA PARA REVANCHAS
    socket.on('request_restart', (room) => {
        socket.wantsRestart = true; // Marca que este usuario quiere reiniciar
        
        const clientsInRoom = io.sockets.adapter.rooms.get(room);
        if (!clientsInRoom) return;

        let allReady = true;
        // Verifica si TODOS los jugadores en la sala activaron su bandera de reinicio
        for (const clientId of clientsInRoom) {
            const clientSocket = io.sockets.sockets.get(clientId);
            if (!clientSocket || !clientSocket.wantsRestart) {
                allReady = false;
                break;
            }
        }

        // Si ambos presionaron el botón simultáneamente, se concede la revancha
        if (allReady && clientsInRoom.size === 2) {
            // Se bajan las banderas de reinicio para la próxima partida
            for (const clientId of clientsInRoom) {
                const clientSocket = io.sockets.sockets.get(clientId);
                if (clientSocket) clientSocket.wantsRestart = false;
            }
            io.to(room).emit('restart_game'); // Ordena a las pantallas limpiarse
        } else {
            // Si solo uno presionó el botón, le notifica al oponente que están esperando su confirmación
            socket.to(room).emit('opponent_wants_restart');
        }
    });

    // LÓGICA DE ABANDONO INTENCIONAL
    socket.on('leave_room', () => {
        if (socket.currentRoom) {
            // Avisa a la sala que el jugador huyó y aborta la partida
            socket.to(socket.currentRoom).emit('error_msg', 'El oponente ha salido de la sala. Partida cancelada.');
            socket.leave(socket.currentRoom);
            socket.currentRoom = null;
            socket.wantsRestart = false;
        }
    });

    // LÓGICA DE DESCONEXIÓN ACCIDENTAL (Cierre del navegador o caída de internet)
    socket.on('disconnect', () => {
        if (socket.currentRoom) {
            socket.to(socket.currentRoom).emit('error_msg', 'Un jugador se ha desconectado. Partida terminada.');
        }
    });
});

// Levanta el servidor en el puerto asignado por la nube (WAN) o en el 3000 si se corre local
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor de red WAN corriendo en el puerto ${PORT}`);
});