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

// Generar UI del tablero
const container = document.getElementById('board-container');
const layers = ['Z=0 (Inferior)', 'Z=1', 'Z=2', 'Z=3 (Superior)'];

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

const statusTxt = document.getElementById('status');

function joinGame() {
    room = document.getElementById('roomName').value.trim();
    if (!room) return;
    socket.emit('join_room', room);
    document.getElementById('controls').style.display = 'none';
    container.style.display = 'grid';
    statusTxt.innerText = 'Conectando...';
}

// Eventos de Red
socket.on('joined', (role) => {
    myRole = role;
    statusTxt.innerText = role === 'X' ? 'Esperando al Jugador 2...' : 'Conectado. Esperando turno de X.';
});

socket.on('game_ready', () => {
    gameActive = true;
    if (myRole === 'X') statusTxt.innerText = '¡Tu turno! (X)';
});

socket.on('move_made', (data) => {
    applyMove(data.z, data.y, data.x, data.role);
    currentTurn = myRole;
    statusTxt.innerText = `¡Tu turno! (${myRole})`;
});

socket.on('error_msg', (msg) => {
    statusTxt.innerText = msg;
    gameActive = false;
});

// Lógica de juego
function handleMove(z, y, x) {
    if (!gameActive || currentTurn !== myRole || board[z][y][x] !== 0) return;
    
    applyMove(z, y, x, myRole);
    socket.emit('make_move', { room, z, y, x, role: myRole });
    
    if (gameActive) { // Si nadie ha ganado aún
        currentTurn = myRole === 'X' ? 'O' : 'X';
        statusTxt.innerText = `Turno del oponente (${currentTurn})...`;
    }
}

function applyMove(z, y, x, role) {
    board[z][y][x] = role === 'X' ? -1 : 1;
    const cell = document.getElementById(`cell-${z}-${y}-${x}`);
    cell.innerText = role;
    cell.classList.add(role);
    checkWinCondition(z, y, x, role);
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
            statusTxt.innerText = `🏆 ¡${role} HA GANADO!`;
            winCells.forEach(id => document.getElementById(id).classList.add('win'));
            return;
        }
    }
}