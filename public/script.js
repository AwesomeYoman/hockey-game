// Socket.io 客戶端連接
const socket = io();

// 遊戲配置（與服務器端保持一致）
const GAME_CONFIG = {
  CANVAS_WIDTH: 800,
  CANVAS_HEIGHT: 400,
  PADDLE_WIDTH: 10,
  PADDLE_HEIGHT: 80,
  PUCK_RADIUS: 10,
  GOAL_HEIGHT: 100
};

// 遊戲狀態
let gameState = {
  roomId: null,
  playerSide: null, // 'left' 或 'right'
  puck: { x: 0, y: 0, vx: 0, vy: 0 },
  leftPaddle: { y: 0 },
  rightPaddle: { y: 0 },
  scores: { left: 0, right: 0 },
  gameStatus: 'waiting', // waiting, countdown, playing, paused, gameOver
  countdown: 0,
  winner: null
};

// Canvas 和上下文
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// 設置 Canvas 尺寸
function setupCanvas() {
  const container = canvas.parentElement;
  const maxWidth = Math.min(800, window.innerWidth - 40);
  const aspectRatio = GAME_CONFIG.CANVAS_HEIGHT / GAME_CONFIG.CANVAS_WIDTH;
  
  canvas.width = maxWidth;
  canvas.height = maxWidth * aspectRatio;
  
  // 保存縮放比例用於繪製
  canvas.scaleX = canvas.width / GAME_CONFIG.CANVAS_WIDTH;
  canvas.scaleY = canvas.height / GAME_CONFIG.CANVAS_HEIGHT;
}

setupCanvas();
window.addEventListener('resize', setupCanvas);

// DOM 元素引用
const menuScreen = document.getElementById('menuScreen');
const gameScreen = document.getElementById('gameScreen');
const createRoomBtn = document.getElementById('createRoomBtn');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const roomIdInput = document.getElementById('roomIdInput');
const refreshRoomsBtn = document.getElementById('refreshRoomsBtn');
const roomList = document.getElementById('roomList');
const leaveRoomBtn = document.getElementById('leaveRoomBtn');
const currentRoomId = document.getElementById('currentRoomId');
const playerSide = document.getElementById('playerSide');
const leftScore = document.getElementById('leftScore');
const rightScore = document.getElementById('rightScore');
const countdownOverlay = document.getElementById('countdownOverlay');
const countdownText = document.getElementById('countdownText');
const goalOverlay = document.getElementById('goalOverlay');
const goalMessage = document.getElementById('goalMessage');
const gameOverOverlay = document.getElementById('gameOverOverlay');
const winnerText = document.getElementById('winnerText');
const finalScore = document.getElementById('finalScore');
const restartGameBtn = document.getElementById('restartGameBtn');
const waitingOverlay = document.getElementById('waitingOverlay');
const playersCount = document.getElementById('playersCount');

// 球拍移動追蹤
let mouseY = 0;
let isMouseDown = false;
let touchY = 0;
let isTouching = false;

/**
 * 初始化事件監聽器
 */
function initEventListeners() {
  // 創建房間
  createRoomBtn.addEventListener('click', () => {
    socket.emit('createRoom');
  });

  // 加入房間（按鈕）
  joinRoomBtn.addEventListener('click', () => {
    const roomId = roomIdInput.value.trim().toUpperCase();
    if (roomId) {
      socket.emit('joinRoom', roomId);
    }
  });

  // 加入房間（回車鍵）
  roomIdInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      joinRoomBtn.click();
    }
  });

  // 刷新房間列表
  refreshRoomsBtn.addEventListener('click', () => {
    socket.emit('getRoomList');
  });

  // 離開房間
  leaveRoomBtn.addEventListener('click', () => {
    showMenu();
  });

  // 重新開始遊戲
  restartGameBtn.addEventListener('click', () => {
    if (gameState.roomId) {
      socket.emit('restartGame', gameState.roomId);
    }
  });

  // 桌面：鼠標移動控制球拍
  canvas.addEventListener('mousemove', (e) => {
    if (gameState.gameStatus === 'playing' && gameState.playerSide) {
      const rect = canvas.getBoundingClientRect();
      const y = (e.clientY - rect.top) / canvas.scaleY;
      mouseY = y;
      updatePaddlePosition(y);
    }
  });

  // 桌面：鼠標按下
  canvas.addEventListener('mousedown', (e) => {
    isMouseDown = true;
    const rect = canvas.getBoundingClientRect();
    const y = (e.clientY - rect.top) / canvas.scaleY;
    mouseY = y;
    if (gameState.gameStatus === 'playing' && gameState.playerSide) {
      updatePaddlePosition(y);
    }
  });

  // 桌面：鼠標釋放
  canvas.addEventListener('mouseup', () => {
    isMouseDown = false;
  });

  // 移動端：觸摸控制球拍
  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (gameState.gameStatus === 'playing' && gameState.playerSide && e.touches.length > 0) {
      const rect = canvas.getBoundingClientRect();
      const y = (e.touches[0].clientY - rect.top) / canvas.scaleY;
      touchY = y;
      isTouching = true;
      updatePaddlePosition(y);
    }
  });

  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (e.touches.length > 0) {
      const rect = canvas.getBoundingClientRect();
      const y = (e.touches[0].clientY - rect.top) / canvas.scaleY;
      touchY = y;
      isTouching = true;
      if (gameState.gameStatus === 'playing' && gameState.playerSide) {
        updatePaddlePosition(y);
      }
    }
  });

  canvas.addEventListener('touchend', () => {
    isTouching = false;
  });
}

/**
 * 更新球拍位置並發送到服務器
 */
function updatePaddlePosition(y) {
  if (!gameState.roomId || !gameState.playerSide) return;
  
  // 限制球拍在畫布範圍內
  const clampedY = Math.max(0, Math.min(GAME_CONFIG.CANVAS_HEIGHT - GAME_CONFIG.PADDLE_HEIGHT, y));
  
  // 發送到服務器
  socket.emit('paddleMove', {
    roomId: gameState.roomId,
    y: clampedY,
    side: gameState.playerSide
  });
}

/**
 * 顯示菜單界面
 */
function showMenu() {
  menuScreen.classList.remove('hidden');
  gameScreen.classList.add('hidden');
  gameState.roomId = null;
  gameState.playerSide = null;
  socket.emit('getRoomList');
}

/**
 * 顯示遊戲界面
 */
function showGame() {
  menuScreen.classList.add('hidden');
  gameScreen.classList.remove('hidden');
}

/**
 * 渲染遊戲畫面
 */
function render() {
  // 清空畫布
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 縮放上下文以匹配實際畫布尺寸
  ctx.save();
  ctx.scale(canvas.scaleX, canvas.scaleY);

  // 繪製中線
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 10]);
  ctx.beginPath();
  ctx.moveTo(GAME_CONFIG.CANVAS_WIDTH / 2, 0);
  ctx.lineTo(GAME_CONFIG.CANVAS_WIDTH / 2, GAME_CONFIG.CANVAS_HEIGHT);
  ctx.stroke();
  ctx.setLineDash([]);

  // 繪製中心圓
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(GAME_CONFIG.CANVAS_WIDTH / 2, GAME_CONFIG.CANVAS_HEIGHT / 2, 50, 0, Math.PI * 2);
  ctx.stroke();

  // 繪製球門（左側）
  const goalTop = (GAME_CONFIG.CANVAS_HEIGHT - GAME_CONFIG.GOAL_HEIGHT) / 2;
  const goalBottom = goalTop + GAME_CONFIG.GOAL_HEIGHT;
  ctx.strokeStyle = '#4CAF50';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, goalTop);
  ctx.lineTo(0, goalBottom);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, GAME_CONFIG.CANVAS_HEIGHT / 2, GAME_CONFIG.GOAL_HEIGHT / 2, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();

  // 繪製球門（右側）
  ctx.beginPath();
  ctx.moveTo(GAME_CONFIG.CANVAS_WIDTH, goalTop);
  ctx.lineTo(GAME_CONFIG.CANVAS_WIDTH, goalBottom);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(GAME_CONFIG.CANVAS_WIDTH, GAME_CONFIG.CANVAS_HEIGHT / 2, GAME_CONFIG.GOAL_HEIGHT / 2, Math.PI / 2, -Math.PI / 2);
  ctx.stroke();

  // 繪製左側球拍
  ctx.fillStyle = '#667eea';
  ctx.fillRect(0, gameState.leftPaddle.y, GAME_CONFIG.PADDLE_WIDTH, GAME_CONFIG.PADDLE_HEIGHT);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, gameState.leftPaddle.y, GAME_CONFIG.PADDLE_WIDTH, GAME_CONFIG.PADDLE_HEIGHT);

  // 繪製右側球拍
  ctx.fillStyle = '#764ba2';
  ctx.fillRect(
    GAME_CONFIG.CANVAS_WIDTH - GAME_CONFIG.PADDLE_WIDTH,
    gameState.rightPaddle.y,
    GAME_CONFIG.PADDLE_WIDTH,
    GAME_CONFIG.PADDLE_HEIGHT
  );
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.strokeRect(
    GAME_CONFIG.CANVAS_WIDTH - GAME_CONFIG.PADDLE_WIDTH,
    gameState.rightPaddle.y,
    GAME_CONFIG.PADDLE_WIDTH,
    GAME_CONFIG.PADDLE_HEIGHT
  );

  // 繪製冰球
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(gameState.puck.x, gameState.puck.y, GAME_CONFIG.PUCK_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 繪製冰球光暈效果
  const gradient = ctx.createRadialGradient(
    gameState.puck.x,
    gameState.puck.y,
    0,
    gameState.puck.x,
    gameState.puck.y,
    GAME_CONFIG.PUCK_RADIUS * 2
  );
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(gameState.puck.x, gameState.puck.y, GAME_CONFIG.PUCK_RADIUS * 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // 繼續動畫循環
  requestAnimationFrame(render);
}

// 開始渲染循環
render();

// Socket.io 事件處理

/**
 * 房間創建成功
 */
socket.on('roomCreated', (data) => {
  gameState.roomId = data.roomId;
  gameState.playerSide = data.side;
  currentRoomId.textContent = data.roomId;
  playerSide.textContent = data.side === 'left' ? '左側' : '右側';
  showGame();
  updateWaitingOverlay(1);
});

/**
 * 加入房間成功
 */
socket.on('roomJoined', (data) => {
  gameState.roomId = data.roomId;
  gameState.playerSide = data.side;
  currentRoomId.textContent = data.roomId;
  playerSide.textContent = data.side === 'left' ? '左側' : '右側';
  showGame();
  updateWaitingOverlay(data.players);
});

/**
 * 加入房間失敗
 */
socket.on('joinRoomError', (data) => {
  alert(data.message);
});

/**
 * 玩家加入房間
 */
socket.on('playerJoined', (data) => {
  updateWaitingOverlay(data.players);
});

/**
 * 玩家離開房間
 */
socket.on('playerLeft', (data) => {
  updateWaitingOverlay(data.players);
  if (data.players === 0) {
    showMenu();
  }
});

/**
 * 更新等待覆蓋層
 */
function updateWaitingOverlay(playerCount) {
  playersCount.textContent = `${playerCount}/2`;
  if (playerCount < 2) {
    waitingOverlay.classList.remove('hidden');
  } else {
    waitingOverlay.classList.add('hidden');
  }
}

/**
 * 遊戲狀態更新
 */
socket.on('gameStateUpdate', (newState) => {
  gameState = { ...gameState, ...newState };
  
  // 更新分數顯示
  leftScore.textContent = gameState.scores.left;
  rightScore.textContent = gameState.scores.right;

  // 處理倒計時
  if (gameState.gameStatus === 'countdown' && gameState.countdown > 0) {
    countdownOverlay.classList.remove('hidden');
    countdownText.textContent = gameState.countdown;
  } else {
    countdownOverlay.classList.add('hidden');
  }

  // 處理等待狀態
  if (gameState.gameStatus === 'waiting') {
    updateWaitingOverlay(1);
  } else {
    waitingOverlay.classList.add('hidden');
  }
});

/**
 * 球拍位置更新
 */
socket.on('paddleUpdate', (data) => {
  if (data.side === 'left') {
    gameState.leftPaddle.y = data.y;
  } else {
    gameState.rightPaddle.y = data.y;
  }
});

/**
 * 進球事件
 */
socket.on('goal', (data) => {
  goalOverlay.classList.remove('hidden');
  goalMessage.textContent = `${data.side === 'left' ? '右側' : '左側'} 進球！`;
  
  setTimeout(() => {
    goalOverlay.classList.add('hidden');
  }, 2000);
});

/**
 * 遊戲結束
 */
socket.on('gameOver', (data) => {
  gameOverOverlay.classList.remove('hidden');
  const winnerSide = data.winner === 'left' ? '左側玩家' : '右側玩家';
  winnerText.textContent = `${winnerSide} 獲勝！`;
  finalScore.textContent = `最終比分: ${data.scores.left} : ${data.scores.right}`;
});

/**
 * 房間列表更新
 */
socket.on('roomList', (rooms) => {
  if (rooms.length === 0) {
    roomList.innerHTML = '<p class="empty-message">暫無可用房間</p>';
    return;
  }

  roomList.innerHTML = '';
  rooms.forEach(roomId => {
    const roomItem = document.createElement('div');
    roomItem.className = 'room-item';
    roomItem.innerHTML = `
      <span class="room-id">${roomId}</span>
      <span class="room-players">點擊加入</span>
    `;
    roomItem.addEventListener('click', () => {
      roomIdInput.value = roomId;
      socket.emit('joinRoom', roomId);
    });
    roomList.appendChild(roomItem);
  });
});

// 初始化
initEventListeners();
socket.emit('getRoomList');

// 連接成功提示
socket.on('connect', () => {
  console.log('已連接到服務器');
});

// 斷開連接處理
socket.on('disconnect', () => {
  console.log('與服務器斷開連接');
  alert('與服務器斷開連接，請刷新頁面');
});
