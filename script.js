// Game Configuration
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 500;
const PADDLE_WIDTH = 15;
const PADDLE_HEIGHT = 100;
const BALL_SIZE = 15;
const BALL_SPEED_PPS = 400; // Pixels Per Second

class PongGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');

        // State
        this.state = {
            ball: { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2, dx: BALL_SPEED_PPS, dy: BALL_SPEED_PPS },
            paddle1Y: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2, // Left (Host)
            paddle2Y: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2, // Right (Client)
            score1: 0,
            score2: 0,
            status: 'waiting'
        };

        this.role = null;
        this.peer = null;
        this.conn = null;
        this.lastFrameTime = performance.now();
        this.lastInputTime = 0; // For throttling

        this.initDOM();
        this.initPeer();
    }

    initDOM() {
        this.menuPanel = document.getElementById('menu');
        this.gamePanel = document.getElementById('gameUI');
        this.myIdEl = document.getElementById('myPeerId');
        this.hostStatusEl = document.getElementById('hostStatus');
        this.score1El = document.getElementById('score1');
        this.score2El = document.getElementById('score2');

        document.getElementById('copyIdBtn').addEventListener('click', () => {
            navigator.clipboard.writeText(this.myIdEl.innerText);
            alert('ID Copied!');
        });

        document.getElementById('joinBtn').addEventListener('click', () => {
            const hostId = document.getElementById('joinInput').value;
            if (hostId) this.joinGame(hostId);
        });

        document.getElementById('disconnectBtn').addEventListener('click', () => location.reload());

        const handleMove = (clientY) => {
            if (this.state.status !== 'playing') return;
            const rect = this.canvas.getBoundingClientRect();
            const scaleY = CANVAS_HEIGHT / rect.height;
            const inputY = (clientY - rect.top) * scaleY;
            let newY = inputY - PADDLE_HEIGHT / 2;
            if (newY < 0) newY = 0;
            if (newY > CANVAS_HEIGHT - PADDLE_HEIGHT) newY = CANVAS_HEIGHT - PADDLE_HEIGHT;

            if (this.role === 'host') this.state.paddle1Y = newY;
            else this.state.paddle2Y = newY;

            this.sendInput(newY);
        };

        this.canvas.addEventListener('mousemove', (e) => handleMove(e.clientY));
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            handleMove(e.touches[0].clientY);
        }, { passive: false });
    }

    initPeer() {
        this.peer = new Peer();
        this.peer.on('open', (id) => {
            this.myIdEl.innerText = id;
            console.log('My Peer ID:', id);
        });
        this.peer.on('connection', (conn) => {
            if (this.conn) { conn.close(); return; }
            this.setupConnection(conn, 'host');
        });
        this.peer.on('error', (err) => alert("Error: " + err.type));
    }

    joinGame(hostId) {
        const conn = this.peer.connect(hostId);
        this.setupConnection(conn, 'client');
    }

    setupConnection(conn, role) {
        this.conn = conn;
        this.role = role;

        this.conn.on('open', () => this.startGame());
        this.conn.on('data', (data) => this.handleData(data));
        this.conn.on('close', () => { alert('Opponent disconnected'); location.reload(); });

        if (this.role === 'host') this.hostStatusEl.innerText = "Connected! Starting...";
    }

    startGame() {
        this.menuPanel.classList.add('hidden');
        this.gamePanel.classList.remove('hidden');
        this.state.status = 'playing';
        this.lastFrameTime = performance.now();

        // Start Loop
        requestAnimationFrame(this.loop.bind(this));

        // Host Network Loop (30Hz)
        if (this.role === 'host') {
            setInterval(() => this.sendGameState(), 1000 / 30);
        }
    }

    loop(now) {
        if (this.state.status !== 'playing') return;

        const dt = (now - this.lastFrameTime) / 1000;
        this.lastFrameTime = now;

        let updateDt = dt;
        if (updateDt > 0.5) updateDt = 0.5; // Cap hard for stability

        const stepSize = 0.016;
        while (updateDt > 0) {
            const step = Math.min(updateDt, stepSize);
            this.updatePhysics(step);
            updateDt -= step;
        }

        this.draw();
        requestAnimationFrame(this.loop.bind(this));
    }

    handleData(data) {
        if (this.role === 'host') {
            if (data.type === 'INPUT') {
                this.state.paddle2Y = data.y;
            }
        } else {
            if (data.type === 'STATE') {
                const serverBall = data.state.ball;

                // If reset happened (velocity 0), accept it immediately
                if (serverBall.dx === 0 && serverBall.dy === 0) {
                    this.state.ball.x = serverBall.x;
                    this.state.ball.y = serverBall.y;
                } else {
                    const distSq = Math.pow(this.state.ball.x - serverBall.x, 2) +
                        Math.pow(this.state.ball.y - serverBall.y, 2);

                    if (distSq > 150 * 150) { // Increased snap threshold
                        this.state.ball.x = serverBall.x;
                        this.state.ball.y = serverBall.y;
                    } else {
                        // Very gentle lerp to avoid stutter
                        this.state.ball.x = this.lerp(this.state.ball.x, serverBall.x, 0.1);
                        this.state.ball.y = this.lerp(this.state.ball.y, serverBall.y, 0.1);
                    }
                }

                this.state.ball.dx = serverBall.dx;
                this.state.ball.dy = serverBall.dy;

                this.state.paddle1Y = this.lerp(this.state.paddle1Y, data.state.paddle1Y, 0.2);
                this.state.score1 = data.state.score1;
                this.state.score2 = data.state.score2;
                this.updateScoreUI();
            }
        }
    }

    lerp(start, end, amt) {
        return (1 - amt) * start + amt * end;
    }

    sendInput(y) {
        // Throttling: Max 30 times per second (approx every 33ms)
        const now = Date.now();
        if (now - this.lastInputTime < 33) return;
        this.lastInputTime = now;

        if (this.conn && this.conn.open) this.conn.send({ type: 'INPUT', y: y });
    }

    sendGameState() {
        if (this.conn && this.conn.open) this.conn.send({ type: 'STATE', state: this.state });
    }

    updatePhysics(dt) {
        this.state.ball.x += this.state.ball.dx * dt;
        this.state.ball.y += this.state.ball.dy * dt;

        if (this.state.ball.y <= 0) {
            this.state.ball.y = 0;
            this.state.ball.dy = Math.abs(this.state.ball.dy);
        }
        if (this.state.ball.y + BALL_SIZE >= CANVAS_HEIGHT) {
            this.state.ball.y = CANVAS_HEIGHT - BALL_SIZE;
            this.state.ball.dy = -Math.abs(this.state.ball.dy);
        }

        // Hitbox Forgiveness (Extra 20px up/down)
        const FORGIVENESS = 20;

        // Left Paddle
        if (this.state.ball.x < PADDLE_WIDTH + 5 &&
            this.state.ball.x + BALL_SIZE > 0 &&
            this.state.ball.y + BALL_SIZE >= this.state.paddle1Y - FORGIVENESS &&
            this.state.ball.y <= this.state.paddle1Y + PADDLE_HEIGHT + FORGIVENESS) {
            this.state.ball.dx = Math.abs(this.state.ball.dx) * 1.05;
            if (this.state.ball.dx > 600) this.state.ball.dx = 600;
            this.state.ball.x = PADDLE_WIDTH + 5;
        }

        // Right Paddle
        if (this.state.ball.x + BALL_SIZE > CANVAS_WIDTH - PADDLE_WIDTH - 5 &&
            this.state.ball.x < CANVAS_WIDTH &&
            this.state.ball.y + BALL_SIZE >= this.state.paddle2Y - FORGIVENESS &&
            this.state.ball.y <= this.state.paddle2Y + PADDLE_HEIGHT + FORGIVENESS) {
            this.state.ball.dx = -Math.abs(this.state.ball.dx) * 1.05;
            if (this.state.ball.dx < -600) this.state.ball.dx = -600;
            this.state.ball.x = CANVAS_WIDTH - PADDLE_WIDTH - BALL_SIZE - 5;
        }

        if (this.role === 'host') {
            if (this.state.ball.x < -20) {
                this.state.score2++;
                this.updateScoreUI();
                this.resetBall();
            } else if (this.state.ball.x > CANVAS_WIDTH + 20) {
                this.state.score1++;
                this.updateScoreUI();
                this.resetBall();
            }
        }
    }

    resetBall() {
        this.state.ball.x = CANVAS_WIDTH / 2;
        this.state.ball.y = CANVAS_HEIGHT / 2;
        this.state.ball.dx = 0;
        this.state.ball.dy = 0;
        this.sendGameState();

        setTimeout(() => {
            const dirX = Math.random() > 0.5 ? 1 : -1;
            const dirY = Math.random() > 0.5 ? 1 : -1;
            this.state.ball.dx = dirX * BALL_SPEED_PPS;
            this.state.ball.dy = dirY * BALL_SPEED_PPS;
            this.sendGameState();
        }, 1000);
    }

    updateScoreUI() {
        this.score1El.innerText = this.state.score1;
        this.score2El.innerText = this.state.score2;
    }

    draw() {
        this.ctx.fillStyle = '#050505';
        this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        this.ctx.strokeStyle = '#333';
        this.ctx.setLineDash([10, 15]);
        this.ctx.beginPath();
        this.ctx.moveTo(CANVAS_WIDTH / 2, 0);
        this.ctx.lineTo(CANVAS_WIDTH / 2, CANVAS_HEIGHT);
        this.ctx.stroke();
        this.ctx.setLineDash([]);

        this.ctx.fillStyle = '#fff';
        this.ctx.fillRect(this.state.ball.x, this.state.ball.y, BALL_SIZE, BALL_SIZE);

        this.ctx.fillStyle = '#0ff';
        this.ctx.shadowBlur = 20;
        this.ctx.shadowColor = '#0ff';
        this.ctx.fillRect(0, this.state.paddle1Y, PADDLE_WIDTH, PADDLE_HEIGHT);

        this.ctx.fillStyle = '#f0f';
        this.ctx.shadowColor = '#f0f';
        this.ctx.fillRect(CANVAS_WIDTH - PADDLE_WIDTH, this.state.paddle2Y, PADDLE_WIDTH, PADDLE_HEIGHT);
        this.ctx.shadowBlur = 0;
    }
}

window.game = new PongGame();
