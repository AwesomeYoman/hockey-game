const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// 靜態文件服務 - 提供public文件夾中的文件
app.use(express.static(path.join(__dirname, 'public')));

// 房間管理系統
// 存儲所有房間的數據結構：{ roomId: { players: [], gameState: {...} } }
const rooms = {};

// 遊戲配置
const GAME_CONFIG = {
  MAX_PLAYERS_PER_ROOM: 2,
  WIN_SCORE: 5, // 達到此分數即獲勝
  CANVAS_WIDTH: 800,
  CANVAS_HEIGHT: 400,
  PADDLE_WIDTH: 10,
  PADDLE_HEIGHT: 80,
  PUCK_RADIUS: 10,
  GOAL_HEIGHT: 100,
  PADDLE_SPEED: 5,
  PUCK_SPEED: 8
};

/**
 * 生成隨機房間ID
 */
function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

/**
 * 創建新房間
 */
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
      scores: {
        left: 0,
        right: 0
      },
      gameStatus: 'waiting', // waiting, countdown, playing, paused, gameOver
      countdown: 0,
      winner: null
    }
  };
}

/**
 * 獲取可用房間列表
 */
function getAvailableRooms() {
  return Object.keys(rooms).filter(roomId => 
    rooms[roomId].players.length < GAME_CONFIG.MAX_PLAYERS_PER_ROOM
  );
}

/**
 * 初始化遊戲狀態（開始新遊戲）
 */
function initializeGame(roomId) {
  const room = rooms[roomId];
  if (!room || room.players.length !== 2) return;

  // 重置遊戲狀態
  room.gameState.puck = {
    x: GAME_CONFIG.CANVAS_WIDTH / 2,
    y: GAME_CONFIG.CANVAS_HEIGHT / 2,
    vx: 0,
    vy: 0
  };
  room.gameState.leftPaddle.y = GAME_CONFIG.CANVAS_HEIGHT / 2 - GAME_CONFIG.PADDLE_HEIGHT / 2;
  room.gameState.rightPaddle.y = GAME_CONFIG.CANVAS_HEIGHT / 2 - GAME_CONFIG.PADDLE_HEIGHT / 2;
  room.gameState.scores = { left: 0, right: 0 };
  room.gameState.gameStatus = 'countdown';
  room.gameState.countdown = 3;
  room.gameState.winner = null;

  // 發送倒計時開始
  io.to(roomId).emit('gameStateUpdate', room.gameState);
  
  // 倒計時處理
  let countdown = 3;
  const countdownInterval = setInterval(() => {
    countdown--;
    if (countdown > 0) {
      room.gameState.countdown = countdown;
      io.to(roomId).emit('gameStateUpdate', room.gameState);
    } else {
      clearInterval(countdownInterval);
      room.gameState.gameStatus = 'playing';
      room.gameState.countdown = 0;
      // 開始遊戲時給冰球一個初始速度
      room.gameState.puck.vx = Math.random() > 0.5 ? GAME_CONFIG.PUCK_SPEED : -GAME_CONFIG.PUCK_SPEED;
      room.gameState.puck.vy = (Math.random() - 0.5) * GAME_CONFIG.PUCK_SPEED;
      io.to(roomId).emit('gameStateUpdate', room.gameState);
    }
  }, 1000);
}

/**
 * 更新冰球物理
 */
function updatePuckPhysics(roomId) {
  const room = rooms[roomId];
  if (!room || room.gameState.gameStatus !== 'playing') return;

  const puck = room.gameState.puck;
  const leftPaddle = room.gameState.leftPaddle;
  const rightPaddle = room.gameState.rightPaddle;

  // 更新冰球位置
  puck.x += puck.vx;
  puck.y += puck.vy;

  // 碰撞檢測：頂部和底部牆壁
  if (puck.y - GAME_CONFIG.PUCK_RADIUS <= 0 || 
      puck.y + GAME_CONFIG.PUCK_RADIUS >= GAME_CONFIG.CANVAS_HEIGHT) {
    puck.vy = -puck.vy;
    puck.y = Math.max(GAME_CONFIG.PUCK_RADIUS, 
      Math.min(GAME_CONFIG.CANVAS_HEIGHT - GAME_CONFIG.PUCK_RADIUS, puck.y));
  }

  // 碰撞檢測：左側球拍
  if (puck.x - GAME_CONFIG.PUCK_RADIUS <= GAME_CONFIG.PADDLE_WIDTH &&
      puck.y >= leftPaddle.y &&
      puck.y <= leftPaddle.y + GAME_CONFIG.PADDLE_HEIGHT &&
      puck.vx < 0) {
    // 根據擊中球拍的位置調整角度
    const hitPos = (puck.y - leftPaddle.y) / GAME_CONFIG.PADDLE_HEIGHT; // 0-1
    const angle = (hitPos - 0.5) * Math.PI / 3; // -60° 到 60°
    const speed = Math.sqrt(puck.vx * puck.vx + puck.vy * puck.vy) * 1.1; // 速度增加10%
    puck.vx = Math.abs(Math.cos(angle) * speed);
    puck.vy = Math.sin(angle) * speed;
    puck.x = GAME_CONFIG.PADDLE_WIDTH + GAME_CONFIG.PUCK_RADIUS;
  }

  // 碰撞檢測：右側球拍
  if (puck.x + GAME_CONFIG.PUCK_RADIUS >= GAME_CONFIG.CANVAS_WIDTH - GAME_CONFIG.PADDLE_WIDTH &&
      puck.y >= rightPaddle.y &&
      puck.y <= rightPaddle.y + GAME_CONFIG.PADDLE_HEIGHT &&
      puck.vx > 0) {
    const hitPos = (puck.y - rightPaddle.y) / GAME_CONFIG.PADDLE_HEIGHT;
    const angle = (hitPos - 0.5) * Math.PI / 3;
    const speed = Math.sqrt(puck.vx * puck.vx + puck.vy * puck.vy) * 1.1;
    puck.vx = -Math.abs(Math.cos(angle) * speed);
    puck.vy = Math.sin(angle) * speed;
    puck.x = GAME_CONFIG.CANVAS_WIDTH - GAME_CONFIG.PADDLE_WIDTH - GAME_CONFIG.PUCK_RADIUS;
  }

  // 進球檢測：左側球門（右側玩家得分）
  if (puck.x - GAME_CONFIG.PUCK_RADIUS <= 0) {
    const goalTop = (GAME_CONFIG.CANVAS_HEIGHT - GAME_CONFIG.GOAL_HEIGHT) / 2;
    const goalBottom = goalTop + GAME_CONFIG.GOAL_HEIGHT;
    if (puck.y >= goalTop && puck.y <= goalBottom) {
      room.gameState.scores.right++;
      resetPuckAfterGoal(roomId, 'left');
      checkGameOver(roomId);
      return;
    }
  }

  // 進球檢測：右側球門（左側玩家得分）
  if (puck.x + GAME_CONFIG.PUCK_RADIUS >= GAME_CONFIG.CANVAS_WIDTH) {
    const goalTop = (GAME_CONFIG.CANVAS_HEIGHT - GAME_CONFIG.GOAL_HEIGHT) / 2;
    const goalBottom = goalTop + GAME_CONFIG.GOAL_HEIGHT;
    if (puck.y >= goalTop && puck.y <= goalBottom) {
      room.gameState.scores.left++;
      resetPuckAfterGoal(roomId, 'right');
      checkGameOver(roomId);
      return;
    }
  }

  // 如果冰球超出邊界（未進球），重置到中心
  if (puck.x < 0 || puck.x > GAME_CONFIG.CANVAS_WIDTH) {
    resetPuckAfterGoal(roomId, puck.x < 0 ? 'left' : 'right');
  }
}

/**
 * 進球後重置冰球
 */
function resetPuckAfterGoal(roomId, side) {
  const room = rooms[roomId];
  if (!room) return;

  room.gameState.puck = {
    x: GAME_CONFIG.CANVAS_WIDTH / 2,
    y: GAME_CONFIG.CANVAS_HEIGHT / 2,
    vx: 0,
    vy: 0
  };
  room.gameState.gameStatus = 'paused';
  
  // 發送進球事件
  io.to(roomId).emit('goal', { side, scores: room.gameState.scores });
  
  // 2秒後繼續遊戲
  setTimeout(() => {
    if (room.gameState.gameStatus === 'paused' && room.gameState.gameStatus !== 'gameOver') {
      room.gameState.gameStatus = 'playing';
      // 根據進球方向決定冰球初始方向
      room.gameState.puck.vx = side === 'left' ? GAME_CONFIG.PUCK_SPEED : -GAME_CONFIG.PUCK_SPEED;
      room.gameState.puck.vy = (Math.random() - 0.5) * GAME_CONFIG.PUCK_SPEED;
      io.to(roomId).emit('gameStateUpdate', room.gameState);
    }
  }, 2000);
}

/**
 * 檢查遊戲是否結束
 */
function checkGameOver(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  if (room.gameState.scores.left >= GAME_CONFIG.WIN_SCORE) {
    room.gameState.gameStatus = 'gameOver';
    room.gameState.winner = 'left';
    io.to(roomId).emit('gameOver', { winner: 'left', scores: room.gameState.scores });
  } else if (room.gameState.scores.right >= GAME_CONFIG.WIN_SCORE) {
    room.gameState.gameStatus = 'gameOver';
    room.gameState.winner = 'right';
    io.to(roomId).emit('gameOver', { winner: 'right', scores: room.gameState.scores });
  }
}

// Socket.io 連接處理
io.on('connection', (socket) => {
  console.log('玩家連接:', socket.id);

  // 獲取房間列表
  socket.on('getRoomList', () => {
    const availableRooms = getAvailableRooms();
    socket.emit('roomList', availableRooms);
  });

  // 創建房間
  socket.on('createRoom', () => {
    const roomId = generateRoomId();
    createRoom(roomId);
    socket.join(roomId);
    
    const room = rooms[roomId];
    room.players.push({
      id: socket.id,
      side: 'left' // 第一個玩家是左側
    });

    socket.emit('roomCreated', { roomId, side: 'left', players: room.players.length });
    io.emit('roomList', getAvailableRooms()); // 更新所有玩家的房間列表
  });

  // 加入房間
  socket.on('joinRoom', (roomId) => {
    if (!rooms[roomId]) {
      socket.emit('joinRoomError', { message: '房間不存在' });
      return;
    }

    const room = rooms[roomId];
    if (room.players.length >= GAME_CONFIG.MAX_PLAYERS_PER_ROOM) {
      socket.emit('joinRoomError', { message: '房間已滿' });
      return;
    }

    socket.join(roomId);
    const side = room.players.length === 0 ? 'left' : 'right';
    room.players.push({
      id: socket.id,
      side: side
    });

    socket.emit('roomJoined', { roomId, side, players: room.players.length });
    io.to(roomId).emit('playerJoined', { players: room.players.length });
    io.emit('roomList', getAvailableRooms());

    // 如果房間有2個玩家，開始遊戲
    if (room.players.length === 2) {
      initializeGame(roomId);
    } else {
      // 發送當前遊戲狀態
      socket.emit('gameStateUpdate', room.gameState);
    }
  });

  // 更新球拍位置
  socket.on('paddleMove', (data) => {
    const { roomId, y, side } = data;
    const room = rooms[roomId];
    if (!room) return;

    // 驗證玩家是否在房間中且是正確的側邊
    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.side !== side) return;

    // 更新球拍位置（限制在畫布範圍內）
    const paddle = side === 'left' ? room.gameState.leftPaddle : room.gameState.rightPaddle;
    paddle.y = Math.max(0, Math.min(GAME_CONFIG.CANVAS_HEIGHT - GAME_CONFIG.PADDLE_HEIGHT, y));

    // 廣播給房間內所有玩家
    io.to(roomId).emit('paddleUpdate', { side, y });
  });

  // 重新開始遊戲
  socket.on('restartGame', (roomId) => {
    const room = rooms[roomId];
    if (!room || room.players.length !== 2) return;
    
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    initializeGame(roomId);
  });

  // 玩家斷開連接
  socket.on('disconnect', () => {
    console.log('玩家斷開連接:', socket.id);

    // 從所有房間中移除玩家
    for (const roomId in rooms) {
      const room = rooms[roomId];
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      
      if (playerIndex !== -1) {
        room.players.splice(playerIndex, 1);
        io.to(roomId).emit('playerLeft', { players: room.players.length });
        
        // 如果房間為空，刪除房間
        if (room.players.length === 0) {
          delete rooms[roomId];
        } else {
          // 重置遊戲狀態為等待
          room.gameState.gameStatus = 'waiting';
          io.to(roomId).emit('gameStateUpdate', room.gameState);
        }
        
        io.emit('roomList', getAvailableRooms());
        break;
      }
    }
  });
});

// 遊戲循環：每幀更新冰球物理
setInterval(() => {
  for (const roomId in rooms) {
    if (rooms[roomId].gameState.gameStatus === 'playing') {
      updatePuckPhysics(roomId);
      io.to(roomId).emit('gameStateUpdate', rooms[roomId].gameState);
    }
  }
}, 1000 / 60); // 60 FPS

// 啟動服務器
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`服務器運行在端口 ${PORT}`);
  console.log(`訪問 http://localhost:${PORT} 開始遊戲`);
});
