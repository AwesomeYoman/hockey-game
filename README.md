# 🏒 在線曲棍球遊戲 - 1v1 多人對戰

一個使用 HTML、CSS、JavaScript、Node.js 和 Socket.io 構建的實時多人曲棍球遊戲。

## ✨ 功能特點

- 🎮 **房間系統**：創建或加入房間，支持最多2人對戰
- 🖱️ **多平台控制**：桌面端使用鼠標，移動端使用觸摸控制
- 🎨 **流暢動畫**：Canvas 渲染，60 FPS 遊戲體驗
- ⚡ **實時同步**：Socket.io 實時同步遊戲狀態
- 📱 **響應式設計**：適配桌面和移動設備
- 🎯 **物理引擎**：真實的冰球碰撞和反彈效果

## 📋 項目結構

```
曲棍球/
├── server.js          # Node.js 後端服務器
├── package.json       # 項目依賴配置
├── .gitignore        # Git 忽略文件
├── README.md         # 項目說明文檔
└── public/           # 前端靜態文件
    ├── index.html    # 主頁面
    ├── style.css     # 樣式文件
    └── script.js     # 客戶端邏輯
```

## 🚀 本地運行

### 1. 安裝依賴

```bash
npm install
```

### 2. 啟動服務器

```bash
npm start
```

### 3. 訪問遊戲

打開瀏覽器訪問：`http://localhost:3000`

## 🌐 部署到免費託管平台

### 方法一：部署到 Railway

1. **註冊 Railway 賬號**
   - 訪問 [Railway](https://railway.app)
   - 使用 GitHub 登錄

2. **連接 GitHub 倉庫**
   - 將項目推送到 GitHub
   - 在 Railway 中點擊 "New Project"
   - 選擇 "Deploy from GitHub repo"
   - 選擇你的倉庫

3. **配置部署**
   - Railway 會自動檢測 Node.js 項目
   - 確保 `package.json` 中有 `start` 腳本
   - Railway 會自動設置 `PORT` 環境變量

4. **部署完成**
   - Railway 會自動部署並提供一個 URL
   - 訪問該 URL 即可開始遊戲

### 方法二：部署到 Render

1. **註冊 Render 賬號**
   - 訪問 [Render](https://render.com)
   - 使用 GitHub 登錄

2. **創建 Web Service**
   - 點擊 "New +" → "Web Service"
   - 連接你的 GitHub 倉庫
   - 選擇倉庫和分支

3. **配置服務**
   - **Name**: 輸入服務名稱（如：hockey-game）
   - **Environment**: 選擇 `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Environment Variables**: 不需要額外設置（Render 會自動設置 PORT）

4. **部署**
   - 點擊 "Create Web Service"
   - Render 會自動構建和部署
   - 部署完成後會提供一個 URL（格式：`https://your-app.onrender.com`）

### 方法三：部署到 Vercel（需要調整）

⚠️ **注意**：Vercel 主要用於靜態網站和 Serverless 函數。對於 Socket.io 這種需要持久連接的應用，建議使用 Railway 或 Render。

如果必須使用 Vercel，需要：

1. **創建 `vercel.json` 配置文件**：

```json
{
  "version": 2,
  "builds": [
    {
      "src": "server.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "server.js"
    }
  ]
}
```

2. **安裝 Vercel CLI**：
```bash
npm i -g vercel
```

3. **部署**：
```bash
vercel
```

⚠️ **限制**：Vercel 的 Serverless 函數有執行時間限制，可能不適合長時間運行的 Socket.io 連接。

## 📝 環境變量

項目會自動使用以下環境變量（如果提供）：

- `PORT`: 服務器端口（默認：3000）

在 Railway 和 Render 上，這些平台會自動設置 `PORT` 環境變量。

## 🎮 遊戲玩法

1. **創建或加入房間**
   - 點擊 "創建房間" 創建新房間
   - 或輸入房間 ID 加入現有房間
   - 或從房間列表中選擇房間

2. **等待對手**
   - 房間需要2名玩家才能開始
   - 第一個玩家自動分配為左側
   - 第二個玩家自動分配為右側

3. **控制球拍**
   - **桌面端**：移動鼠標上下移動球拍
   - **移動端**：觸摸屏幕上下移動球拍

4. **遊戲目標**
   - 將冰球擊入對方球門得分
   - 先達到 5 分的玩家獲勝

## 🔧 技術棧

- **後端**：
  - Node.js
  - Express.js
  - Socket.io

- **前端**：
  - HTML5 Canvas
  - Vanilla JavaScript
  - CSS3

## 📦 依賴包

- `express`: Web 服務器框架
- `socket.io`: 實時雙向通信

## 🐛 故障排除

### 問題：Socket.io 連接失敗

**解決方案**：
- 確保服務器正在運行
- 檢查防火牆設置
- 在部署平台上確保 WebSocket 連接已啟用

### 問題：遊戲卡頓

**解決方案**：
- 檢查網絡連接
- 確保瀏覽器支持 WebSocket
- 嘗試刷新頁面

### 問題：移動端控制不響應

**解決方案**：
- 確保使用觸摸事件而非點擊
- 檢查瀏覽器是否支持觸摸事件
- 嘗試使用不同的瀏覽器

## 📄 許可證

MIT License

## 🤝 貢獻

歡迎提交 Issue 和 Pull Request！

## 📧 聯繫方式

如有問題或建議，請提交 Issue。

---

**享受遊戲！** 🎮🏒
