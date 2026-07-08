const socket = io();
let myRole = '';
let currentTurn = 'X';
let room = '';
let gameActive = false;
let board = Array.from({ length: 4 }, () => 
    Array.from({ length: 4 }, () => Array(4).fill(0))
);

// Direcciones para verificar victoria
const C = [
    [1, 1, 0], [1, 0, 1], [0, 1, 1], [1, 0, 0], [1, -1, 0], [0, 0, 1], [-1, 0, 1],
    [0, 1, 0], [0, 1, -1], [0, -1, -1], [0, -1, 0], [0, 0, -1], [0, 0, 0]
];

const container = document.getElementById('board-container');
const statusTxt = document.getElementById('status');
const endActions = document.getElementById('end-actions');
const roomActions = document.getElementById('room-actions');
const btnRestart = document.getElementById('btnRestart');

const layers = ['Z=0 (Inferior)', 'Z=1', 'Z=2', 'Z=3 (Superior)'];

// Dibujar Tablero
layers.forEach((name, z) => {
    const layerDiv = document.createElement('div');
    layerDiv.className = 'layer';
    layerDiv.innerHTML = `<h3>${name}</h3>`;
    const grid = document.createElement('div');
    grid.className = 'grid';
    
    for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 4; x++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.id = `cell-${z}-${y}-${x}`;
            cell.onclick = () => handleMove(z, y, x);
            grid.appendChild(cell);
        }
    }
    layerDiv.appendChild(grid);
    container.appendChild(layerDiv);
});

// ==================== RED Y EVENTOS ====================
function joinGame() {
    room = document.getElementById('roomName').value.trim();
    if (!room) return;
    socket.emit('join_room', room);
    document.getElementById('controls').style.display = 'none';
    container.style.display = 'grid';
    roomActions.style.display = 'block'; // Mostrar botón Salir
    statusTxt.innerText = 'Conectando...';
}

socket.on('joined', (role) => {
    myRole = role;
    statusTxt.style.color = '#fcd34d';
    statusTxt.innerText = role === 'X' ? 'Esperando al Jugador 2...' : 'Conectado. Esperando turno de X.';
});

socket.on('game_ready', () => {
    gameActive = true;
    if (myRole === 'X') {
        statusTxt.innerText = '¡Tu turno! (X)';
        statusTxt.style.color = '#38bdf8';
    }
});

socket.on('move_made', (data) => {
    applyMove(data.z, data.y, data.x, data.role);
    if (gameActive) {
        currentTurn = myRole;
        statusTxt.innerText = `¡Tu turno! (${myRole})`;
        statusTxt.style.color = '#38bdf8';
    }
});

socket.on('error_msg', (msg) => {
    statusTxt.innerText = msg;
    statusTxt.style.color = '#e11d48';
    gameActive = false;
    endActions.style.display = 'none'; // No se puede reiniciar si alguien se fue
});

// ==================== LÓGICA DE JUEGO ====================
function handleMove(z, y, x) {
    if (!gameActive || currentTurn !== myRole || board[z][y][x] !== 0) return;
    
    applyMove(z, y, x, myRole);
    socket.emit('make_move', { room, z, y, x, role: myRole });
    
    if (gameActive) {
        currentTurn = myRole === 'X' ? 'O' : 'X';
        statusTxt.innerText = `Turno del oponente (${currentTurn})...`;
        statusTxt.style.color = '#94a3b8';
    }
}

function applyMove(z, y, x, role) {
    board[z][y][x] = role === 'X' ? -1 : 1;
    const cell = document.getElementById(`cell-${z}-${y}-${x}`);
    cell.innerText = role;
    cell.classList.add(role);
    
    const isWin = checkWinCondition(z, y, x, role);
    
    // Si nadie ganó, comprobamos si hay empate
    if (!isWin && checkDraw()) {
        gameActive = false;
        statusTxt.innerText = "🤝 ¡Empate! El tablero está lleno.";
        statusTxt.style.color = '#fcd34d';
        endActions.style.display = 'block';
    }
}

function checkWinCondition(pz, py, px, role) {
    for (let c = 0; c < 13; c++) {
        let [tz, ty, tx] = C[c];
        let z1 = tz > 0 ? pz : -1, y1 = ty > 0 ? py : -1, x1 = tx > 0 ? px : -1;
        let s = 0, winCells = [];
        
        for (let i = 0; i < 4; i++) {
            let zz = z1 >= 0 ? pz : (tz ? 3 - i : i);
            let yy = y1 >= 0 ? py : (ty ? 3 - i : i);
            let xx = x1 >= 0 ? px : (tx ? 3 - i : i);
            s += board[zz][yy][xx];
            winCells.push(`cell-${zz}-${yy}-${xx}`);
        }
        
        if (s === 4 || s === -4) {
            gameActive = false;
            winCells.forEach(id => document.getElementById(id).classList.add('win'));
            
            // Textos distintos si ganas o pierdes
            if (role === myRole) {
                statusTxt.innerText = `🏆 ¡HAS GANADO!`;
                statusTxt.style.color = '#34d399'; // Verde
            } else {
                statusTxt.innerText = `💀 Has perdido. El jugador ${role} ha ganado.`;
                statusTxt.style.color = '#e11d48'; // Rojo
            }
            endActions.style.display = 'block'; // Mostrar botón de jugar de nuevo
            return true;
        }
    }
    return false;
}

function checkDraw() {
    for (let z = 0; z < 4; z++) {
        for (let y = 0; y < 4; y++) {
            for (let x = 0; x < 4; x++) {
                if (board[z][y][x] === 0) return false;
            }
        }
    }
    return true;
}

// ==================== REINICIAR Y SALIR ====================
function requestRestart() {
    socket.emit('request_restart', room);
    btnRestart.disabled = true;
    btnRestart.innerText = "Esperando al otro jugador...";
}

// Escuchar si el otro apretó reiniciar primero
socket.on('opponent_wants_restart', () => {
    if (!gameActive && !btnRestart.disabled) {
        btnRestart.innerText = "¡El oponente quiere jugar! (Aceptar)";
        btnRestart.style.backgroundColor = "#0284c7"; // Llamar la atención en azul
    }
});

socket.on('restart_game', () => {
    // Resetear tablero
    board = Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => Array(4).fill(0)));
    document.querySelectorAll('.cell').forEach(c => {
        c.innerText = '';
        c.className = 'cell'; 
    });
    
    // Resetear estado del juego
    gameActive = true;
    currentTurn = 'X';
    endActions.style.display = 'none'; // Ocultar botón
    
    // Resetear diseño del botón por si se cambió
    btnRestart.disabled = false;
    btnRestart.innerText = "🔄 Jugar de Nuevo";
    btnRestart.style.backgroundColor = "#059669";
    
    // Mensajes iniciales
    if (myRole === 'X') {
        statusTxt.innerText = '¡Nueva partida! Tu turno (X)';
        statusTxt.style.color = '#38bdf8';
    } else {
        statusTxt.innerText = '¡Nueva partida! Esperando a X...';
        statusTxt.style.color = '#fcd34d';
    }
});

function leaveRoom() {
    socket.emit('leave_room');
    window.location.reload(); // Recarga la página devolviendo al usuario al inicio
}