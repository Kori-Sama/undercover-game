"use client";

import { useState, useEffect, use } from "react";
import { Room, PlayerRole, Player, GameState } from "@/types/game";
import { useSocket } from "@/context/SocketContext";

// Define props interface
interface HostPageProps {
    params: Promise<{ roomId: string }>;
    // searchParams could be added here if needed
}

export default function HostPage({ params: paramsPromise }: HostPageProps) {
    const params = use(paramsPromise);
    const { socket, isConnected } = useSocket();
    const [room, setRoom] = useState<Room | null>(null);
    const [loading, setLoading] = useState(true);
    const [roleAssignment, setRoleAssignment] = useState<Record<string, PlayerRole>>({});
    const [error, setError] = useState<string | null>(null);
    const [voteCounts, setVoteCounts] = useState<Record<string, number>>({});

    // 连接到WebSocket服务器并获取房间信息
    useEffect(() => {
        if (!socket || !isConnected) return;

        // 监听房间更新事件
        socket.on('room_updated', (updatedRoom) => {
            if (updatedRoom.roomId === params.roomId) {
                setRoom(updatedRoom);
                setLoading(false);

                if (updatedRoom.state !== "voting") {
                    setVoteCounts({});
                }

                if (updatedRoom.state === "voting") {
                    const counts: Record<string, number> = {};
                    updatedRoom.players.forEach((player: Player) => {
                        if (player.vote && player.status === "alive") {
                            counts[player.vote] = (counts[player.vote] || 0) + 1;
                        }
                    });
                    setVoteCounts(counts);
                }
            }
        });

        // 监听投票开始事件
        socket.on('voting_started', (updatedRoom) => {
            if (updatedRoom.roomId === params.roomId) {
                setRoom(updatedRoom);
                setVoteCounts({});
            }
        });

        // 监听所有玩家已投票事件
        socket.on('all_voted', () => {
            alert('所有玩家已完成投票');
        });

        // 监听投票结果事件
        socket.on('voting_result', (result) => {
            if (result.voteCounts) {
                setVoteCounts(result.voteCounts);
            }

            const eliminatedPlayer = room?.players.find(p => p.id === result.eliminated);
            console.log('投票结果:', result);
            console.log('被淘汰的玩家:', eliminatedPlayer);
            const message = result.eliminatedPlayerId
                ? `${eliminatedPlayer?.name || '一名玩家'} 被投票淘汰。`
                : '平票或无人被淘汰。';
            alert(`投票结果: ${message}`);
            if (result.eliminatedPlayerId && result.canGuess) {
                alert(`${eliminatedPlayer?.name} 是 ${result.eliminatedPlayerRole}，现在可以猜词。`);
            }

            setRoom((prev: Room | null) => {
                if (!prev) return prev;
                return {
                    ...prev,
                    players: prev.players.map((player) => {
                        if (player.id === result.eliminatedPlayerId) {
                            return { ...player, status: "eliminated" };
                        }
                        return player;
                    }),
                    state: (result.gameEnded ? "ended" : "playing") as GameState,
                    winner: result.winner,

                }
            });
        });

        // 监听投票无效事件
        socket.on('voting_invalid', () => {
            alert('投票未达到半数或出现平票，投票无效，请重新投票。');
        });

        // 监听玩家投票事件
        socket.on('player_voted', ({ targetId }) => {
            setVoteCounts(prev => ({
                ...prev,
                [targetId]: (prev[targetId] || 0) + 1
            }));
        });

        // 监听猜词结果
        socket.on('guess_result', (result) => {
            const guesser = room?.players.find(p => p.id === result.playerId);
            const message = result.correct
                ? `${guesser?.name || '玩家'} 猜对了!`
                : `${guesser?.name || '玩家'} 猜错了。`;
            alert(`猜词结果: ${message}`);

            setRoom((prev: Room | null) => {
                if (!prev) return prev;
                return {
                    ...prev,
                    players: prev.players.map((player) => {
                        if (player.id === result.playerId) {
                            return { ...player, status: "eliminated" };
                        }
                        return player;
                    }),
                    state: (result.gameEnded ? "ended" : "playing") as GameState,
                    winner: result.winner,
                }
            });
        });

        // 监听玩家被淘汰
        socket.on('player_eliminated', (data) => {
            const eliminatedPlayer = room?.players.find(p => p.id === data.playerId);
            alert(`${eliminatedPlayer?.name || '一名玩家'} 已被淘汰。`);

            setRoom((prev: Room | null) => {
                if (!prev) return prev;
                return {
                    ...prev,
                    players: prev.players.map((player) => {
                        if (player.id === data.playerId) {
                            return { ...player, status: "eliminated" };
                        }
                        return player;
                    }),
                    state: (data.gameEnded ? "ended" : "playing") as GameState,
                    winner: data.winner,
                }
            });
        });

        // 监听玩家离开
        socket.on('player_left', ({ playerId, updatedRoom }) => {
            const leftPlayer = room?.players.find(p => p.id === playerId);
            alert(`${leftPlayer?.name || '一名玩家'} 离开了房间。`);
            if (updatedRoom.roomId === params.roomId) {
                setRoom(updatedRoom);
            }
        });

        // 监听错误
        socket.on('error', (err) => {
            setError(err.message);
        });

        socket.emit('get_room', { roomId: params.roomId });

        return () => {
            socket.off('room_updated');
            socket.off('voting_started');
            socket.off('all_voted');
            socket.off('voting_result');
            socket.off('voting_invalid');
            socket.off('player_voted');
            socket.off('guess_result');
            socket.off('player_eliminated');
            socket.off('player_left');
            socket.off('error');
        };
    }, [socket, isConnected, params.roomId]);

    const assignRolesRandomly = () => {
        if (!room || !socket) return;

        socket.emit('start_game', { roomId: params.roomId });
    };

    const assignRole = (playerId: string, role: PlayerRole) => {
        setRoleAssignment((prev) => ({
            ...prev,
            [playerId]: role
        }));
    };

    const saveRoleAssignments = () => {
        if (!room || !socket) return;

        let goodAssigned = 0;
        let evilAssigned = 0;
        let blankAssigned = 0;

        Object.values(roleAssignment).forEach(role => {
            if (role === "good") goodAssigned++;
            else if (role === "evil") evilAssigned++;
            else if (role === "blank") blankAssigned++;
        });

        if (goodAssigned !== room.goodCount ||
            evilAssigned !== room.evilCount ||
            blankAssigned !== room.blankCount) {
            alert(`请分配正确数量的角色: ${room.goodCount}好人, ${room.evilCount}坏人, ${room.blankCount}白板`);
            return;
        }

        socket.emit('start_game', {
            roomId: params.roomId,
            playerRoles: roleAssignment
        });
    };

    const startVoting = () => {
        if (!room || !socket) return;

        socket.emit('start_voting', { roomId: params.roomId });
    };

    const endVoting = () => {
        if (!room || !socket) return;

        socket.emit('end_voting', { roomId: params.roomId });
    };

    const restartGame = () => {
        if (!room || !socket) return;

        socket.emit('restart_game', { roomId: params.roomId });
        setRoleAssignment({});
        setVoteCounts({});
        setRoom((prev: Room | null) => {
            if (!prev) return prev;
            return {
                ...prev,
                players: prev.players.map((player) => ({ ...player, status: "alive" })),
                state: "waiting",
                winner: undefined,
            };
        });
    };

    if (!isConnected) {
        return <div className="p-4">正在连接服务器...</div>;
    }

    if (loading) {
        return <div className="p-4">加载中...</div>;
    }

    if (error) {
        return <div className="p-4 text-red-500">错误: {error}</div>;
    }

    if (!room) {
        return <div className="p-4">找不到房间信息</div>;
    }

    return (
        <div className="p-4 max-w-md mx-auto">
            <h1 className="text-2xl font-bold mb-4">主持人视图</h1>

            <div className="bg-gray-100 p-3 rounded-lg mb-6 dark:bg-gray-800 text-white">
                <p className="text-lg font-semibold">房间号: {params.roomId}</p>
                <p>游戏状态: {
                    room.state === "waiting" ? "等待开始" :
                        room.state === "playing" ? "游戏中" :
                            room.state === "voting" ? "投票中" :
                                room.state === "ended" ? "已结束" : ""
                }</p>
                <p>玩家数: {room.players.length} / {room.goodCount + room.evilCount + room.blankCount}</p>

                <div className="mt-2 grid grid-cols-2 gap-2">
                    <div className="text-sm">好人词: <span className="font-medium">{room.goodWord}</span></div>
                    <div className="text-sm">坏人词: <span className="font-medium">{room.evilWord}</span></div>
                </div>
            </div>

            <div className="mb-6">
                <h2 className="text-xl font-semibold mb-3">玩家列表</h2>

                {room.players.length === 0 ? (
                    <p className="text-gray-500">等待玩家加入...</p>
                ) : (
                    <ul className="space-y-2">
                        {room.players.map((player) => (
                            <li
                                key={player.id}
                                className={`p-2 border rounded-md ${player.status === "eliminated" ? "bg-red-100 dark:bg-red-900/20" : ""
                                    }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <span className="font-medium">{player.name}</span>
                                        {player.status === "eliminated" && (
                                            <span className="ml-2 text-red-600 dark:text-red-400 text-sm">已出局</span>
                                        )}
                                        {room.state !== "waiting" && player.role && (
                                            <span className="ml-2 text-sm">
                                                ({player.role === "good" ? "好人" : player.role === "evil" ? "坏人" : "白板"})
                                            </span>
                                        )}
                                        {room.state === "voting" && (
                                            <span className="ml-2 text-sm bg-yellow-100 dark:bg-yellow-800 rounded px-2 py-0.5 text-yellow-800 dark:text-yellow-200">
                                                {voteCounts[player.id] || 0} 票
                                            </span>
                                        )}
                                    </div>

                                    {room.state === "waiting" && (
                                        <select
                                            value={roleAssignment[player.id] || ""}
                                            onChange={(e) => assignRole(player.id, e.target.value as PlayerRole)}
                                            className="text-sm border rounded px-2 py-1 text-black"
                                        >
                                            <option value="">选择角色</option>
                                            <option value="good">好人</option>
                                            <option value="evil">坏人</option>
                                            <option value="blank">白板</option>
                                        </select>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div className="space-y-3">
                {room.state === "waiting" && (
                    <>
                        <button
                            onClick={assignRolesRandomly}
                            disabled={room.players.length < (room.goodCount + room.evilCount + room.blankCount)}
                            className={`w-full py-2 rounded-md ${room.players.length >= (room.goodCount + room.evilCount + room.blankCount)
                                ? "bg-green-600 text-white hover:bg-green-700"
                                : "bg-gray-300 text-gray-600"
                                }`}
                        >
                            随机分配角色并开始游戏
                        </button>

                        <button
                            onClick={saveRoleAssignments}
                            className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700"
                        >
                            保存手动分配并开始游戏
                        </button>
                    </>
                )}

                {room.state === "playing" && (
                    <button
                        onClick={startVoting}
                        className="w-full bg-yellow-600 text-white py-2 rounded-md hover:bg-yellow-700"
                    >
                        开始投票
                    </button>
                )}

                {room.state === "voting" && (
                    <button
                        onClick={endVoting}
                        className="w-full bg-red-600 text-white py-2 rounded-md hover:bg-red-700"
                    >
                        结束投票
                    </button>
                )}

                {room.state === "ended" && (
                    <div className="space-y-4">
                        <div className="bg-yellow-100 dark:bg-yellow-900/20 p-4 rounded-md text-center">
                            <h3 className="text-lg font-bold">游戏结束</h3>
                            <p className="text-xl mt-2">
                                {room.winner === "good" ? "好人胜利!" :
                                    room.winner === "evil" ? "坏人胜利!" :
                                        room.winner === "blank" ? "白板胜利!" : "游戏结束"}
                            </p>
                        </div>

                        <button
                            onClick={restartGame}
                            className="w-full bg-green-600 text-white py-2 rounded-md hover:bg-green-700"
                        >
                            重新开始游戏
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}