// Iniciamos la conexión con el servidor usando WebSockets
const socket = io();

// Variables de estado del jugador y del juego
let myRole = ''; // 'X' o 'O'
let currentTurn = 'X'; // Siempre empieza la X
let room = '';
let gameActive = false;

// Creación de la matriz tridimensional 4x4x4 llena de ceros (0 = vacío)
let board = Array.from({ length: 4 }, () => 
    Array.from({ length: 4 }, () => Array(4).fill(0))
);

// Array bidimensional con los vectores de dirección para buscar las 4 en línea.
// Cada sub-arreglo representa la variación en [Z, Y, X]. Cubre todas las formas de ganar (rectas y diagonales).
const C = [
    [1, 1, 0], [1, 0, 1], [0, 1, 1], [1, 0, 0], [1, -1, 0], [0, 0, 1], [-1, 0, 1],
    [0, 1, 0], [0, 1, -1], [0, -1, -1], [0, -1, 0], [0, 0, -1], [0, 0, 0]
];

// Referencias a los elementos visuales en HTML
const container = document.getElementById('board-container');
const statusTxt = document.getElementById('status');
const endActions = document.getElementById('end-actions');
const roomActions = document.getElementById('room-actions');
const btnRestart = document.getElementById('btnRestart');
const layers = ['Z=0 (Inferior)', 'Z=1', 'Z=2', 'Z=3 (Superior)'];

// ==================== DIBUJAR TABLERO ====================
// Este bucle genera automáticamente las 64 casillas (botones) y les asigna su coordenada Z, Y, X
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
            cell.id = `cell-${z}-${y}-${x}`; // ID único para manipular la casilla luego
            cell.onclick = () => handleMove(z, y, x); // Evento de clic
            grid.appendChild(cell);
        }
    }
    layerDiv.appendChild(grid);
    container.appendChild(layerDiv);
});

// ==================== COMUNICACIÓN DE RED (SOCKETS) ====================
// Función al presionar "Unirse a partida"
function joinGame() {
    room = document.getElementById('roomName').value.trim();
    if (!room) return;
    socket.emit('join_room', room); // Pide al servidor unirse a la sala indicada
    document.getElementById('controls').style.display = 'none';
    container.style.display = 'grid';
    roomActions.style.display = 'block';
    statusTxt.innerText = 'Conectando...';
}

// El servidor responde asignándonos un rol (Jugador 1 es X, Jugador 2 es O)
socket.on('joined', (role) => {
    myRole = role;
    statusTxt.style.color = '#fcd34d';
    statusTxt.innerText = role === 'X' ? 'Esperando al Jugador 2...' : 'Conectado. Esperando turno de X.';
});

// El servidor avisa que ya hay 2 personas en la sala
socket.on('game_ready', () => {
    gameActive = true;
    if (myRole === 'X') {
        statusTxt.innerText = '¡Tu turno! (X)';
        statusTxt.style.color = '#38bdf8';
    }
});

// Recibe la jugada del oponente desde el servidor a través de internet
socket.on('move_made', (data) => {
    applyMove(data.z, data.y, data.x, data.role);
    if (gameActive) {
        currentTurn = myRole; // Pasa el turno
        statusTxt.innerText = `¡Tu turno! (${myRole})`;
        statusTxt.style.color = '#38bdf8';
    }
});

// Manejo de errores (desconexiones, sala llena, etc.)
socket.on('error_msg', (msg) => {
    statusTxt.innerText = msg;
    statusTxt.style.color = '#e11d48';
    gameActive = false;
    endActions.style.display = 'none';
});

// ==================== LÓGICA DE JUEGO Y MATRICES ====================
// Verifica si podemos hacer el movimiento
function handleMove(z, y, x) {
    if (!gameActive || currentTurn !== myRole || board[z][y][x] !== 0) return; // Rechaza clics inválidos
    
    applyMove(z, y, x, myRole); // Registra movimiento local
    socket.emit('make_move', { room, z, y, x, role: myRole }); // Envía movimiento a la red WAN
    
    if (gameActive) {
        currentTurn = myRole === 'X' ? 'O' : 'X';
        statusTxt.innerText = `Turno del oponente (${currentTurn})...`;
        statusTxt.style.color = '#94a3b8';
    }
}

// Actualiza la matriz interna y la interfaz gráfica
function applyMove(z, y, x, role) {
    board[z][y][x] = role === 'X' ? -1 : 1; // Matemáticamente representamos X como -1 y O como 1
    const cell = document.getElementById(`cell-${z}-${y}-${x}`);
    cell.innerText = role;
    cell.classList.add(role);

    // Registra la jugada de cualquier jugador (local u oponente) en el panel de coordenadas
    const logContainer = document.getElementById('move-log-container');
    const log = document.getElementById('move-log');
    logContainer.style.display = 'block'; // Muestra el panel desde la primera jugada
    const entry = document.createElement('div');
    entry.className = `log-entry ${role}`;
    const moveNum = log.children.length + 1;
    // Indica si la jugada es propia o del oponente para mayor claridad visual
    const label = role === myRole ? 'Tú' : 'Oponente';
    entry.innerText = `#${moveNum}  ${label} (${role})  →  Z=${z}, Y=${y}, X=${x}`;
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight; // Auto-scroll a la jugada más reciente
    
    const isWin = checkWinCondition(z, y, x, role); // Revisar si este movimiento formó una línea de 4
    
    // Validar empate si nadie ganó y la matriz no tiene ceros
    if (!isWin && checkDraw()) {
        gameActive = false;
        statusTxt.innerText = "🤝 ¡Empate! El tablero está lleno.";
        statusTxt.style.color = '#fcd34d';
        endActions.style.display = 'block';
    }
}

// Registra en pantalla las coordenadas exactas (Z, Y, X) de cada jugada en tiempo real
function logMove(z, y, x, role) {
    const logContainer = document.getElementById('move-log-container');
    const log = document.getElementById('move-log');

    logContainer.style.display = 'block'; // Muestra el panel al primer movimiento

    const entry = document.createElement('div');
    entry.className = `log-entry ${role}`;
    const moveNum = log.children.length + 1;
    entry.innerText = `#${moveNum}  Jugador ${role}  →  Z=${z}, Y=${y}, X=${x}`;
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight; // Auto-scroll al movimiento más reciente
}

// Algoritmo de validación 3D para determinar al ganador
function checkWinCondition(pz, py, px, role) {
    for (let c = 0; c < 13; c++) { // Recorre los 13 vectores direccionales
        let [tz, ty, tx] = C[c];
        let z1 = tz > 0 ? pz : -1, y1 = ty > 0 ? py : -1, x1 = tx > 0 ? px : -1;
        let s = 0, winCells = [];
        
        // Sumamos los valores a lo largo de la línea recta proyectada en la matriz 3D
        for (let i = 0; i < 4; i++) {
            let zz = z1 >= 0 ? pz : (tz ? 3 - i : i);
            let yy = y1 >= 0 ? py : (ty ? 3 - i : i);
            let xx = x1 >= 0 ? px : (tx ? 3 - i : i);
            s += board[zz][yy][xx];
            winCells.push(`cell-${zz}-${yy}-${xx}`);
        }
        
        // Si la suma es 4 (cuatro '1') o -4 (cuatro '-1'), hay ganador absoluto
        if (s === 4 || s === -4) {
            gameActive = false;
            winCells.forEach(id => document.getElementById(id).classList.add('win')); // Pinta las casillas
            
            // Lógica de mensajes de victoria/derrota personalizada
            if (role === myRole) {
                statusTxt.innerText = `🏆 ¡HAS GANADO!`;
                statusTxt.style.color = '#34d399';
            } else {
                statusTxt.innerText = `💀 Has perdido. El jugador ${role} ha ganado.`;
                statusTxt.style.color = '#e11d48';
            }
            endActions.style.display = 'block'; 
            return true;
        }
    }
    return false;
}

// Recorre toda la matriz tridimensional buscando si hay algún espacio vacío (0)
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

// ==================== CONTROL DE FLUJO: REINICIAR Y SALIR ====================
// El usuario presiona el botón de reinicio
function requestRestart() {
    socket.emit('request_restart', room);
    btnRestart.disabled = true;
    btnRestart.innerText = "Esperando al otro jugador...";
}

// Escuchamos si el oponente pidió la revancha primero
socket.on('opponent_wants_restart', () => {
    if (!gameActive && !btnRestart.disabled) {
        btnRestart.innerText = "¡El oponente quiere jugar! (Aceptar)";
        btnRestart.style.backgroundColor = "#0284c7";
    }
});

// Ambos aceptaron reiniciar. El servidor limpia la sala y se reinicia la matriz.
socket.on('restart_game', () => {
    board = Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => Array(4).fill(0))); // Matriz a cero
    document.querySelectorAll('.cell').forEach(c => {
        c.innerText = '';
        c.className = 'cell'; 
    });

    // Limpia el registro de coordenadas para la nueva partida
    document.getElementById('move-log').innerHTML = '';
    document.getElementById('move-log-container').style.display = 'none';
    
    gameActive = true;
    currentTurn = 'X';
    endActions.style.display = 'none'; 
    btnRestart.disabled = false;
    btnRestart.innerText = "🔄 Jugar de Nuevo";
    btnRestart.style.backgroundColor = "#059669";
    
    if (myRole === 'X') {
        statusTxt.innerText = '¡Nueva partida! Tu turno (X)';
        statusTxt.style.color = '#38bdf8';
    } else {
        statusTxt.innerText = '¡Nueva partida! Esperando a X...';
        statusTxt.style.color = '#fcd34d';
    }
});

// Botón de salir de la sala (refresca la página y desconecta el socket)
function leaveRoom() {
    socket.emit('leave_room');
    window.location.reload(); 
}
