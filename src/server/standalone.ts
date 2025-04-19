import { createServer } from 'http';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import initSocketServer from './socket.js';

// Get __dirname equivalent in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');

dotenv.config({ path: resolve(__dirname, '../../.env.local') });

try {
    // 创建HTTP服务器
    const httpServer = createServer();


    // 初始化Socket.io服务器
    const io = initSocketServer(httpServer);

    // 启动服务器
    const PORT = process.env.SOCKET_PORT || 3001;
    httpServer.listen(PORT, () => {
        console.log(`📢 Socket.io server running on port ${PORT}`);
    });
} catch (error) {
    console.error('Failed to start Socket.io server:', error);
}