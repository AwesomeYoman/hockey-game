const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

// ✅ Socket.io（Railway OK）
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// ===============================
// 靜態檔案（public）
// ===============================
app.use(express.static(path.join(__dirname, 'public')));

// ===============================
// 房間與遊戲設定
// ===============================
const rooms = {};

const GAME_CONFIG = {
  MAX_PLAYERS_PER_ROOM: 2,
  WIN_SCORE: 5,
  CANVAS_WIDTH: 800,
  CANVAS_HEIGHT: 400,
  PADDLE_WIDTH: 10,
  PADDLE_HEIGHT: 80,
  PUCK_RADIUS: 10,
  GOAL_HEIGHT: 100,
  PADDLE_SPEED: 5,
  PUCK_SPEED: 8
};

// ===============================
// 工具函式
// ===============================
function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function createRoom(roomId) {
  rooms[roomId] = {
    players: [],
    gameState: {
      puck: {
        x: GAME_CONFIG.CANVAS_WIDTH / 2,
        y: GAME_CONFIG.CANVAS_HEIGHT / 2,
        vx: 0,
        vy: 0
      },
      leftPaddle: {
        y: GAME_CONFIG.CANVAS_HEIGHT / 2 - GAME_CONFIG.PADDLE_HEIGHT / 2
      },
      rightPaddle: {
        y: GAME_CONFIG.CANVAS_HEIGHT / 2 - GAME_CONFIG.PADDLE_HEIGHT / 2
      },
      scores: { left: 0, right: 0 },
      gameStatus: 'waiting',
      countdown: 0,
      winner: null
    }
  };
}

function getAvailableRooms() {
  return Object.keys(rooms).filter(
    id => rooms[id].players.length < GAME_CONFIG.MAX_PLAYERS_PER_ROOM
  );
}

// ===============================
// 遊戲流程
// ===============================
function initializeGame(roomId) {
  const room = rooms[roomId];
  if (!room || room.players.length !== 2) return;

  room.gameState.scores = { left: 0, right: 0 };
  room.gameState.gameStatus = 'countdown';
  room.gameState.countdown = 3;

  io.to(roomId).emit('gameStateUpdate', room.gameState);

  let countdown = 3;
  const timer = setInterval(() => {
    countdown--;
    room.gameState.countdown = countdown;

    if (countdown <= 0) {
      clearInterval(timer);
      room.gameState.gameStatus = 'playing';
      room.gameState.puck.vx =
        Math.random() > 0.5 ? GAME_CONFIG.PUCK_SPEED : -GAME_CONFIG.PUCK_SPEED;
      room.gameState.puck.vy =
        (Math.random() - 0.5) * GAME_CONFIG.PUCK_SPEED;
    }

    io.to(roomId).emit('gameStateUpdate', room.gameState);
  }, 1000);
}

function updatePuckPhysics(roomId) {
  const room = rooms[roomId];
  if (!room || room.gameState.gameStatus !== 'playing') return;

  const puck = room.gameState.puck;
  puck.x += puck.vx;
  puck.y += puck.vy;

  if (puck.y <= GAME_CONFIG.PUCK_RADIUS ||
      puck.y >= GAME_CONFIG.CANVAS_HEIGHT - GAME_CONFIG.PUCK_RADIUS) {
    puck.vy *= -1;
  }
}

// ===============================
// Socket.io
// ===============================
io.on('connection', socket => {
  console.log('玩家連線:', socket.id);

  socket.on('getRoomList', () => {
    socket.emit('roomList', getAvailableRooms());
  });

  socket.on('createRoom', () => {
    const roomId = generateRoomId();
    createRoom(roomId);
    socket.join(roomId);

    rooms[roomId].players.push({ id: socket.id, side: 'left' });
    socket.emit('roomCreated', { roomId, side: 'left' });
    io.emit('roomList', getAvailableRooms());
  });

  socket.on('joinRoom', roomId => {
    const room = rooms[roomId];
    if (!room || room.players.length >= 2) return;

    const side = room.players.length === 0 ? 'left' : 'right';
    room.players.push({ id: socket.id, side });
    socket.join(roomId);

    socket.emit('roomJoined', { roomId, side });
    io.to(roomId).emit('playerJoined');

    if (room.players.length === 2) {
      initializeGame(roomId);
    }
  });

  socket.on('disconnect', () => {
    console.log('玩家離線:', socket.id);
    for (const id in rooms) {
      const index = rooms[id].players.findIndex(p => p.id === socket.id);
      if (index !== -1) {
        rooms[id].players.splice(index, 1);
        if (rooms[id].players.length === 0) delete rooms[id];
        io.emit('roomList', getAvailableRooms());
        break;
      }
    }
  });
});

// ===============================
// 遊戲更新 Loop
// ===============================
setInterval(() => {
  for (const roomId in rooms) {
    updatePuckPhysics(roomId);
    io.to(roomId).emit('gameStateUpdate', rooms[roomId].gameState);
  }
}, 1000 / 60);

// ===============================
// 🚀 Railway 正確啟動方式（關鍵）
// ===============================
const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
});
