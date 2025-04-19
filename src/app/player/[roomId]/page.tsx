"use client";

import { useState, useEffect, use } from "react";
import { useSocket } from "@/context/SocketContext";
import { Player, PlayerRole, GameState } from "@/types/game";

// Define props interface for clarity, matching the expected structure
interface PlayerPageProps {
    params: Promise<{ roomId: string }>;
}

export default function PlayerPage({ params: paramsPromise }: PlayerPageProps) {
    const params = use(paramsPromise); // Unwrap the promise
    const { socket, isConnected } = useSocket();
    const [playerName, setPlayerName] = useState("");
    const [isNameSet, setIsNameSet] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError,] = useState<string | null>(null);

    // 游戏状态
    const [gameState, setGameState] = useState<GameState>("waiting");
    const [players, setPlayers] = useState<Player[]>([]);
    const [myRole, setMyRole] = useState<PlayerRole | undefined>();
    const [myWord, setMyWord] = useState<string | undefined>();
    const [votedFor, setVotedFor] = useState<string | undefined>();
    const [guessWord, setGuessWord] = useState("");
    const [isEliminated, setIsEliminated] = useState(false);
    const [winner, setWinner] = useState<"good" | "evil" | "blank" | undefined>();

    // 连接到WebSocket服务器
    useEffect(() => {
        if (!socket || !isConnected || !isNameSet) return;

        // 监听房间更新
        socket.on('room_updated', (room) => {
            if (room.roomId === params.roomId) {
                setGameState(room.state);
                setPlayers(room.players);

                // 检查自己是否被淘汰
                const me = room.players.find((p: Player) => p.id === socket.id);
                if (me && me.status === "eliminated") {
                    setIsEliminated(true);
                }

                // 检查游戏是否结束
                if (room.state === "ended") {
                    setWinner(room.winner);
                }

                setLoading(false);
            }
        });

        // 监听游戏开始事件
        socket.on('game_started', ({ role, word }) => {
            setMyRole(role);
            setMyWord(word);
        });

        // 监听投票阶段开始
        socket.on('voting_started', (room) => {
            if (room.roomId === params.roomId) {
                setGameState("voting");
                setVotedFor(undefined); // 重置投票
            }
        });

        // 监听投票结果
        socket.on('voting_result', ({ eliminated, gameEnded, winner }) => {
            // 检查自己是否被淘汰
            if (eliminated === socket.id) {
                setIsEliminated(true);
            }

            // 重置投票
            setVotedFor(undefined);

            // 检查游戏是否结束
            if (gameEnded) {
                setGameState("ended");
                setWinner(winner);
            } else {
                setGameState("playing");
            }
        });

        // 监听投票无效
        socket.on('voting_invalid', () => {
            setVotedFor(undefined);
            setGameState("playing");
        });

        // 监听猜词结果
        socket.on('guess_result', ({ playerId, correct, word, gameEnded, winner }) => {
            if (playerId === socket.id) {
                if (!correct) {
                    setIsEliminated(true);
                }
            }

            if (gameEnded) {
                setGameState("ended");
                setWinner(winner);
            }
        });

        // 监听玩家被淘汰
        socket.on('player_eliminated', ({ playerId, gameEnded, winner }) => {
            if (playerId === socket.id) {
                setIsEliminated(true);
            }

            if (gameEnded) {
                setGameState("ended");
                setWinner(winner);
            }
        });

        // 监听房间关闭
        socket.on('room_closed', ({ message }) => {
            setError(message);
        });

        // 监听游戏重新开始
        socket.on('game_restarted', (room) => {
            setGameState("waiting");
            setPlayers(room.players);
            setMyRole(undefined);
            setMyWord(undefined);
            setVotedFor(undefined);
            setIsEliminated(false);
            setWinner(undefined);
        });

        // 监听错误
        socket.on('error', (err) => {
            setError(err.message);
        });

        return () => {
            // 清理事件监听
            socket.off('room_updated');
            socket.off('game_started');
            socket.off('voting_started');
            socket.off('voting_result');
            socket.off('voting_invalid');
            socket.off('guess_result');
            socket.off('player_eliminated');
            socket.off('room_closed');
            socket.off('game_restarted');
            socket.off('error');
        };
    }, [socket, isConnected, isNameSet, params.roomId]);

    // 处理玩家名字提交
    const handleNameSubmit = () => {
        if (!playerName.trim() || !socket || !isConnected) return;

        setLoading(true);

        // 加入房间
        socket.emit('join_room', {
            roomId: params.roomId,
            playerName: playerName.trim()
        });

        // 监听加入成功事件
        socket.once('joined_room', () => {
            setIsNameSet(true);
        });

        // 监听错误
        socket.once('error', (err) => {
            setError(err.message);
            setLoading(false);
        });
    };

    // 投票功能
    const handleVote = (targetId: string) => {
        if (!socket || gameState !== "voting" || isEliminated) return;

        // 发送投票
        socket.emit('vote', {
            roomId: params.roomId,
            targetId
        });

        setVotedFor(targetId);
    };

    // 猜词功能
    const handleGuessWord = () => {
        if (!socket || gameState !== "playing" || isEliminated || !guessWord.trim()) return;

        // 发送猜词
        socket.emit('guess_word', {
            roomId: params.roomId,
            word: guessWord.trim()
        });

        setGuessWord("");
    };

    // 显示连接状态
    if (!isConnected) {
        return (
            <div className="p-4">
                <h1 className="text-2xl font-bold mb-4">玩家视图</h1>
                <p>正在连接服务器...</p>
            </div>
        );
    }

    // 显示错误
    if (error) {
        return (
            <div className="p-4">
                <h1 className="text-2xl font-bold mb-4">玩家视图</h1>
                <p className="text-red-500">错误: {error}</p>
                <button
                    onClick={() => window.location.href = "/"}
                    className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-md"
                >
                    返回首页
                </button>
            </div>
        );
    }

    // 显示名字输入
    if (!isNameSet) {
        return (
            <div className="p-4">
                <h1 className="text-2xl font-bold mb-4">玩家视图</h1>
                <p className="mb-4">房间号: {params.roomId}</p>

                <div className="flex flex-col gap-2 max-w-xs">
                    <input
                        type="text"
                        placeholder="输入你的玩家名"
                        value={playerName}
                        onChange={(e) => setPlayerName(e.target.value)}
                        className="border border-gray-300 rounded-md px-3 py-2 text-black"
                        disabled={loading}
                    />
                    <button
                        onClick={handleNameSubmit}
                        disabled={!playerName.trim() || loading}
                        className={`rounded-md px-4 py-2 transition-colors ${playerName.trim() && !loading
                            ? "bg-blue-600 text-white hover:bg-blue-700"
                            : "bg-gray-400 text-gray-700 cursor-not-allowed"
                            }`}
                    >
                        {loading ? "加入中..." : "确认加入"}
                    </button>
                </div>
            </div>
        );
    }

    // 显示游戏界面
    return (
        <div className="p-6 max-w-md mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-md">
            <h1 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">玩家视图</h1>

            {/* 游戏状态信息 */}
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg mb-6 shadow-sm">
                <p className="text-gray-700 dark:text-gray-200">房间号: <span className="font-medium">{params.roomId}</span></p>
                <p className="text-gray-700 dark:text-gray-200">状态: <span className="font-medium">{
                    gameState === "waiting" ? "等待开始" :
                        gameState === "playing" ? "游戏中" :
                            gameState === "voting" ? "投票中" :
                                gameState === "ended" ? "已结束" : ""
                }</span></p>

                {/* 角色和词语信息 */}
                {myRole && (
                    <div className="mt-3 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-md border border-blue-100 dark:border-blue-800">
                        {/* Only show role if it's 'blank' */}
                        {myRole === "blank" && (
                            <p className="text-blue-800 dark:text-blue-200">你的身份: <span className="font-bold">白板</span></p>
                        )}
                        {myWord && <p className="text-blue-800 dark:text-blue-200 mt-1">你的词语: <span className="font-bold">{myWord}</span></p>}
                        {myRole === "blank" && <p className="text-sm mt-2 text-blue-700 dark:text-blue-300">作为白板，你需要通过猜测好人的词来获胜</p>}
                    </div>
                )}

                {/* 已淘汰提示 */}
                {isEliminated && (
                    <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/30 rounded-md border border-red-100 dark:border-red-800 flex items-center">
                        <svg className="w-5 h-5 mr-2 text-red-500 dark:text-red-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"></path>
                        </svg>
                        <span className="text-red-700 dark:text-red-300">你已被淘汰，但可以继续观战</span>
                    </div>
                )}
            </div>

            {/* 玩家列表 */}
            <div className="mb-6">
                <h2 className="text-xl font-semibold mb-3 text-gray-800 dark:text-white">玩家列表</h2>
                {loading ? (
                    <div className="flex justify-center items-center py-4">
                        <svg className="animate-spin h-6 w-6 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    </div>
                ) : (
                    <ul className="space-y-2">
                        {players.map((player) => (
                            <li
                                key={player.id}
                                className={`p-3 rounded-md flex justify-between items-center border ${player.status === "eliminated"
                                    ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                                    : "bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600"
                                    } ${player.id === socket?.id
                                        ? "ring-2 ring-blue-400 dark:ring-blue-500"
                                        : ""
                                    }`}
                            >
                                <div>
                                    <span className="font-medium text-gray-800 dark:text-gray-200">{player.name}</span>
                                    {player.id === socket?.id && <span className="ml-2 text-blue-600 dark:text-blue-400 text-sm">(你)</span>}
                                    {player.status === "eliminated" && (
                                        <span className="ml-2 text-red-600 dark:text-red-400 text-sm">已出局</span>
                                    )}
                                    {/* Hide own role in the list */}
                                    {/* {gameState !== "waiting" && player.role && player.id !== socket?.id && (
                                        <span className="ml-2 text-sm">
                                            ({player.role === "good" ? "好人" : player.role === "evil" ? "坏人" : "白板"})
                                        </span>
                                    )} */}
                                </div>

                                {/* 投票按钮 */}
                                {gameState === "voting" && player.id !== socket?.id && player.status !== "eliminated" && !isEliminated && (
                                    <button
                                        onClick={() => handleVote(player.id)}
                                        disabled={votedFor !== undefined}
                                        className={`px-3 py-1.5 rounded-md text-sm transition-colors ${votedFor === player.id
                                            ? "bg-yellow-500 text-white"
                                            : votedFor !== undefined
                                                ? "bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-400 cursor-not-allowed"
                                                : "bg-yellow-500 hover:bg-yellow-600 text-white"
                                            }`}
                                    >
                                        {votedFor === player.id ? "已投票" : "投票"}
                                    </button>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* 猜词功能 */}
            {gameState === "playing" && !isEliminated && (
                <div className="mb-6 bg-gray-50 dark:bg-gray-700 p-4 rounded-lg shadow-sm">
                    <h2 className="text-lg font-semibold mb-3 text-gray-800 dark:text-white">猜词</h2>
                    <div className="flex space-x-2">
                        <input
                            type="text"
                            value={guessWord}
                            onChange={(e) => setGuessWord(e.target.value)}
                            placeholder="输入你猜的词"
                            className="flex-1 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400 dark:placeholder-gray-500"
                        />
                        <button
                            onClick={handleGuessWord}
                            disabled={!guessWord.trim()}
                            className={`px-4 py-2 rounded-md transition-colors ${guessWord.trim()
                                ? "bg-red-600 hover:bg-red-700 text-white"
                                : "bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-400 cursor-not-allowed"
                                }`}
                        >
                            猜词
                        </button>
                    </div>
                </div>
            )}

            {/* 游戏结束信息 */}
            {gameState === "ended" && winner && (
                <div className="p-5 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg border border-yellow-200 dark:border-yellow-800 text-center">
                    <svg className="w-12 h-12 mx-auto mb-3 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd"></path>
                    </svg>
                    <h2 className="text-xl font-bold mb-2 text-yellow-800 dark:text-yellow-200">游戏结束</h2>
                    <p className="text-lg text-yellow-700 dark:text-yellow-300">
                        {winner === "good" ? "好人胜利!" :
                            winner === "evil" ? "坏人胜利!" :
                                winner === "blank" ? "白板胜利!" : "游戏结束"}
                    </p>
                </div>
            )}
        </div>
    );
}