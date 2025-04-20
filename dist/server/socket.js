import { Server } from 'socket.io';
// 存储所有游戏房间的信息
const rooms = new Map();
// 存储玩家的最后活跃时间
const playerLastActive = new Map();
// 心跳超时时间（毫秒）
const HEARTBEAT_TIMEOUT = 30000; // 30秒
// 心跳检查间隔
const HEARTBEAT_INTERVAL = 25000; // 25秒
export default function initSocketServer(httpServer) {
    const io = new Server(httpServer, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        },
        pingTimeout: HEARTBEAT_TIMEOUT,
        pingInterval: HEARTBEAT_INTERVAL
    });
    // 处理Socket.io连接
    io.on('connection', (socket) => {
        console.log(`用户已连接: ${socket.id}`);
        // 记录玩家连接时间
        playerLastActive.set(socket.id, Date.now());
        // 处理心跳ping事件
        socket.on('heartbeat', () => {
            // 更新玩家最后活跃时间
            playerLastActive.set(socket.id, Date.now());
            // 回复pong
            socket.emit('heartbeat_ack');
        });
        // 获取房间信息
        socket.on('get_room', ({ roomId }) => {
            const room = rooms.get(roomId);
            if (room) {
                // 如果是房主，发送完整信息
                if (room.host === socket.id) {
                    socket.emit('room_updated', room);
                }
                else {
                    // 对普通玩家隐藏敏感信息
                    const sanitizedRoom = Object.assign(Object.assign({}, room), { players: room.players.map(p => ({
                            id: p.id,
                            name: p.name,
                            status: p.status
                        })) });
                    socket.emit('room_updated', sanitizedRoom);
                }
            }
            else {
                socket.emit('error', { message: '房间不存在' });
            }
        });
        // 创建房间
        socket.on('create_room', (roomSettings) => {
            // 生成随机房间ID (6位数字)
            const roomId = Math.floor(100000 + Math.random() * 900000).toString();
            // 创建房间对象
            const room = Object.assign(Object.assign({}, roomSettings), { roomId, host: socket.id, players: [], state: "waiting", createdAt: new Date().toISOString() });
            // 存储房间信息
            rooms.set(roomId, room);
            // 将当前socket加入到房间
            socket.join(roomId);
            // 向创建者发送房间信息
            socket.emit('room_created', room);
            console.log(`房间已创建: ${roomId}`);
        });
        // 玩家加入房间
        socket.on('join_room', ({ roomId, playerName }) => {
            const room = rooms.get(roomId);
            if (!room) {
                // 房间不存在
                socket.emit('error', { message: '房间不存在' });
                return;
            }
            // 创建玩家对象
            const player = {
                id: socket.id,
                name: playerName,
                status: 'alive'
            };
            // 将玩家添加到房间
            room.players.push(player);
            // 将当前socket加入到房间
            socket.join(roomId);
            // 向所有房间成员发送更新后的房间信息
            io.to(roomId).emit('room_updated', room);
            // 向加入的玩家发送确认信息
            socket.emit('joined_room', {
                roomId,
                playerId: socket.id,
            });
            console.log(`玩家 ${playerName} 已加入房间: ${roomId}`);
        });
        // 开始游戏 (分配角色)
        socket.on('start_game', ({ roomId, playerRoles }) => {
            const room = rooms.get(roomId);
            if (!room || room.host !== socket.id) {
                // 房间不存在或请求者不是主持人
                socket.emit('error', { message: '无权操作或房间不存在' });
                return;
            }
            if (room.players.length < (room.goodCount + room.evilCount + room.blankCount)) {
                // 玩家数量不足
                socket.emit('error', { message: `需要至少 ${room.goodCount + room.evilCount + room.blankCount} 名玩家参与游戏` });
                return;
            }
            let updatedPlayers = [...room.players];
            if (playerRoles) {
                // 手动分配角色
                updatedPlayers = updatedPlayers.map(player => {
                    const role = playerRoles[player.id];
                    return Object.assign(Object.assign({}, player), { role, word: role === "good" ? room.goodWord : role === "evil" ? room.evilWord : undefined });
                });
            }
            else {
                // 随机分配角色
                const roles = [
                    ...Array(room.goodCount).fill("good"),
                    ...Array(room.evilCount).fill("evil"),
                    ...Array(room.blankCount).fill("blank")
                ];
                // 随机打乱角色
                for (let i = roles.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [roles[i], roles[j]] = [roles[j], roles[i]];
                }
                // 分配角色和词语给玩家
                updatedPlayers = updatedPlayers.map((player, index) => {
                    if (index < roles.length) {
                        const role = roles[index];
                        return Object.assign(Object.assign({}, player), { role, word: role === "good" ? room.goodWord : role === "evil" ? room.evilWord : undefined });
                    }
                    return player;
                });
            }
            // 更新房间信息
            const updatedRoom = Object.assign(Object.assign({}, room), { players: updatedPlayers, state: "playing" });
            rooms.set(roomId, updatedRoom);
            // 向房间内所有玩家发送自己的角色信息
            updatedPlayers.forEach(player => {
                io.to(player.id).emit('game_started', {
                    role: player.role,
                    word: player.word
                });
            });
            // 向主持人发送完整的房间信息
            socket.emit('room_updated', updatedRoom);
            // 向其他玩家发送不含角色和词的房间信息
            const sanitizedRoom = Object.assign(Object.assign({}, updatedRoom), { players: updatedPlayers.map(p => ({
                    id: p.id,
                    name: p.name,
                    status: p.status
                })) });
            socket.to(roomId).emit('room_updated', sanitizedRoom);
            console.log(`房间 ${roomId} 游戏开始`);
        });
        // 开始投票
        socket.on('start_voting', ({ roomId }) => {
            const room = rooms.get(roomId);
            if (!room || room.host !== socket.id) {
                socket.emit('error', { message: '无权操作或房间不存在' });
                return;
            }
            // 更新房间状态
            const updatedRoom = Object.assign(Object.assign({}, room), { state: "voting" });
            rooms.set(roomId, updatedRoom);
            // 通知所有玩家进入投票阶段
            io.to(roomId).emit('voting_started', updatedRoom);
            console.log(`房间 ${roomId} 开始投票`);
        });
        // 玩家投票
        socket.on('vote', ({ roomId, targetId }) => {
            const room = rooms.get(roomId);
            if (!room || room.state !== "voting") {
                socket.emit('error', { message: '非投票阶段或房间不存在' });
                return;
            }
            // 更新玩家的投票
            const updatedPlayers = room.players.map(player => {
                if (player.id === socket.id) {
                    return Object.assign(Object.assign({}, player), { vote: targetId });
                }
                return player;
            });
            // 更新房间信息
            const updatedRoom = Object.assign(Object.assign({}, room), { players: updatedPlayers });
            rooms.set(roomId, updatedRoom);
            // 通知所有玩家有新的投票
            io.to(roomId).emit('player_voted', {
                playerId: socket.id,
                targetId
            });
            // 检查是否所有活着的玩家都已投票
            const alivePlayers = updatedPlayers.filter(p => p.status === "alive");
            const allVoted = alivePlayers.every(p => p.vote);
            if (allVoted) {
                // 通知主持人所有玩家已投票
                io.to(room.host).emit('all_voted');
            }
            console.log(`玩家 ${socket.id} 投票给 ${targetId}`);
        });
        // 结束投票
        socket.on('end_voting', ({ roomId }) => {
            var _a;
            const room = rooms.get(roomId);
            if (!room || room.host !== socket.id) {
                socket.emit('error', { message: '无权操作或房间不存在' });
                return;
            }
            // 统计票数
            const votes = {};
            room.players.forEach(player => {
                if (player.vote && player.status === "alive") {
                    votes[player.vote] = (votes[player.vote] || 0) + 1;
                }
            });
            // 找出得票最多的玩家
            let maxVotes = 0;
            let eliminatedPlayerId = "";
            Object.entries(votes).forEach(([playerId, voteCount]) => {
                if (voteCount > maxVotes) {
                    maxVotes = voteCount;
                    eliminatedPlayerId = playerId;
                }
            });
            // 获取活着的玩家数量
            const alivePlayers = room.players.filter(p => p.status === "alive").length;
            // 清除投票
            const playersWithoutVotes = room.players.map(p => (Object.assign(Object.assign({}, p), { vote: undefined })));
            // 检查是否达到半数
            if (maxVotes > alivePlayers / 2 && eliminatedPlayerId) {
                // 更新被淘汰玩家状态
                const updatedPlayers = playersWithoutVotes.map(player => {
                    if (player.id === eliminatedPlayerId) {
                        return Object.assign(Object.assign({}, player), { status: "eliminated" });
                    }
                    return player;
                });
                // 检查游戏是否结束
                const { winner, gameEnded } = checkGameEnd(updatedPlayers);
                // 更新房间信息
                const updatedRoom = Object.assign(Object.assign({}, room), { players: updatedPlayers, state: (gameEnded ? "ended" : "playing"), winner: gameEnded ? winner : undefined });
                rooms.set(roomId, updatedRoom);
                // 通知所有玩家投票结果
                io.to(roomId).emit('voting_result', {
                    eliminated: eliminatedPlayerId,
                    eliminatedPlayerRole: (_a = updatedPlayers.find(p => p.id === eliminatedPlayerId)) === null || _a === void 0 ? void 0 : _a.role,
                    canGuess: !gameEnded,
                    gameEnded,
                    winner,
                    voteCounts: votes
                });
                // 向所有玩家发送更新后的房间信息
                io.to(room.host).emit('room_updated', updatedRoom);
                // 向普通玩家发送不含角色和词的房间信息
                const sanitizedRoom = Object.assign(Object.assign({}, updatedRoom), { players: updatedPlayers.map(p => ({
                        id: p.id,
                        name: p.name,
                        status: p.status
                    })) });
                socket.to(roomId).emit('room_updated', sanitizedRoom);
                console.log(`房间 ${roomId} 投票结束，玩家 ${eliminatedPlayerId} 被淘汰`);
            }
            else {
                // 未达到半数，重新开始
                const updatedRoom = Object.assign(Object.assign({}, room), { players: playersWithoutVotes, state: "playing" });
                rooms.set(roomId, updatedRoom);
                // 向所有玩家发送更新后的房间信息
                io.to(room.host).emit('room_updated', updatedRoom);
                // 向普通玩家发送不含角色和词的房间信息
                const sanitizedRoom = Object.assign(Object.assign({}, updatedRoom), { players: playersWithoutVotes.map(p => ({
                        id: p.id,
                        name: p.name,
                        status: p.status
                    })) });
                socket.to(roomId).emit('room_updated', sanitizedRoom);
                // 通知所有玩家投票无效
                io.to(roomId).emit('voting_invalid');
                console.log(`房间 ${roomId} 投票无效，没有玩家被淘汰`);
            }
        });
        // 猜词功能
        socket.on('guess_word', ({ roomId, word }) => {
            const room = rooms.get(roomId);
            if (!room || room.state !== "playing") {
                socket.emit('error', { message: '非游戏阶段或房间不存在' });
                return;
            }
            // 找到当前玩家
            const player = room.players.find(p => p.id === socket.id);
            if (!player || player.status !== "alive") {
                socket.emit('error', { message: '玩家不存在或已被淘汰' });
                return;
            }
            let guessCorrect = false;
            let gameEnded = false;
            let winner = undefined;
            // 检查猜词是否正确
            if (player.role === "evil" && word === room.goodWord) {
                // 坏人猜对好人词，坏人胜利
                guessCorrect = true;
                gameEnded = true;
                winner = "evil";
            }
            else if (player.role === "blank" && word === room.goodWord) {
                // 白板猜对好人词，白板胜利
                guessCorrect = true;
                gameEnded = true;
                winner = "blank";
            }
            else if (player.role === "good") {
                // 好人猜词，直接淘汰
                guessCorrect = false;
                // 更新玩家状态
                const updatedPlayers = room.players.map(p => {
                    if (p.id === socket.id) {
                        return Object.assign(Object.assign({}, p), { status: "eliminated" });
                    }
                    return p;
                });
                // 检查游戏是否结束
                const gameEndResult = checkGameEnd(updatedPlayers);
                gameEnded = gameEndResult.gameEnded;
                winner = gameEndResult.winner;
                // 更新房间信息
                const updatedRoom = Object.assign(Object.assign({}, room), { players: updatedPlayers, state: (gameEnded ? "ended" : "playing"), winner });
                rooms.set(roomId, updatedRoom);
                // 通知所有玩家
                io.to(roomId).emit('player_eliminated', {
                    playerId: socket.id,
                    reason: "猜词失败",
                    gameEnded,
                    winner
                });
                console.log(`房间 ${roomId} 好人 ${socket.id} 猜词失败被淘汰`);
                return;
            }
            if (guessCorrect) {
                // 更新房间信息
                const updatedRoom = Object.assign(Object.assign({}, room), { state: "ended", winner });
                rooms.set(roomId, updatedRoom);
                // 通知所有玩家
                io.to(roomId).emit('guess_result', {
                    playerId: socket.id,
                    correct: true,
                    word,
                    gameEnded: true,
                    winner
                });
                console.log(`房间 ${roomId} 玩家 ${socket.id} 猜词正确，游戏结束`);
            }
            else {
                // 猜词错误
                // 更新玩家状态
                const updatedPlayers = room.players.map(p => {
                    if (p.id === socket.id) {
                        return Object.assign(Object.assign({}, p), { status: "eliminated" });
                    }
                    return p;
                });
                // 检查游戏是否结束
                const gameEndResult = checkGameEnd(updatedPlayers);
                gameEnded = gameEndResult.gameEnded;
                winner = gameEndResult.winner;
                // 更新房间信息
                const updatedRoom = Object.assign(Object.assign({}, room), { players: updatedPlayers, state: (gameEnded ? "ended" : "playing"), winner });
                rooms.set(roomId, updatedRoom);
                // 通知所有玩家
                io.to(roomId).emit('guess_result', {
                    playerId: socket.id,
                    correct: false,
                    word,
                    gameEnded,
                    winner
                });
                console.log(`房间 ${roomId} 玩家 ${socket.id} 猜词错误被淘汰`);
            }
        });
        // 重新开始游戏
        socket.on('restart_game', ({ roomId }) => {
            const room = rooms.get(roomId);
            if (!room || room.host !== socket.id) {
                socket.emit('error', { message: '无权操作或房间不存在' });
                return;
            }
            // 重置玩家状态
            const resetPlayers = room.players.map(p => (Object.assign(Object.assign({}, p), { role: undefined, word: undefined, status: "alive", vote: undefined })));
            // 更新房间信息
            const updatedRoom = Object.assign(Object.assign({}, room), { players: resetPlayers, state: "waiting", winner: undefined });
            rooms.set(roomId, updatedRoom);
            // 通知所有玩家
            io.to(roomId).emit('game_restarted', updatedRoom);
            console.log(`房间 ${roomId} 重新开始游戏`);
        });
        // 玩家离开房间/断开连接
        socket.on('disconnect', () => {
            console.log(`用户断开连接: ${socket.id}`);
            // 查找玩家所在的房间
            for (const [roomId, room] of rooms.entries()) {
                // 检查是否是房主
                if (room.host === socket.id) {
                    // 通知所有其他玩家房间已解散
                    socket.to(roomId).emit('room_closed', { message: '主持人已离开，房间已关闭' });
                    // 删除房间
                    rooms.delete(roomId);
                    console.log(`房间 ${roomId} 已关闭（主持人离开）`);
                }
                else {
                    // 检查普通玩家
                    const playerIndex = room.players.findIndex(p => p.id === socket.id);
                    if (playerIndex !== -1) {
                        // 从房间中移除玩家
                        const updatedPlayers = [...room.players];
                        updatedPlayers.splice(playerIndex, 1);
                        // 更新房间信息
                        const updatedRoom = Object.assign(Object.assign({}, room), { players: updatedPlayers });
                        rooms.set(roomId, updatedRoom);
                        // 通知房间内其他玩家
                        socket.to(roomId).emit('player_left', {
                            playerId: socket.id,
                            updatedRoom
                        });
                        console.log(`玩家 ${socket.id} 离开房间 ${roomId}`);
                    }
                }
            }
        });
    });
    return io;
}
// 检查游戏是否结束
function checkGameEnd(players) {
    const alive = players.filter(p => p.status === "alive");
    const aliveGood = alive.filter(p => p.role === "good").length;
    const aliveEvil = alive.filter(p => p.role === "evil").length;
    const aliveBlank = alive.filter(p => p.role === "blank").length;
    if (aliveEvil === 0 && aliveBlank === 0) {
        // 所有坏人和白板出局，好人胜利
        return { winner: "good", gameEnded: true };
    }
    else if (aliveGood <= aliveEvil) {
        // 好人人数小于等于坏人，坏人胜利
        return { winner: "evil", gameEnded: true };
    }
    return { winner: undefined, gameEnded: false };
}
