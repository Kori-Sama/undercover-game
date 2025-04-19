"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSocket } from "@/context/SocketContext";

export default function CreateRoom() {
    const router = useRouter();
    const { socket, isConnected } = useSocket();
    const [roomSettings, setRoomSettings] = useState({
        goodCount: 4,
        evilCount: 2,
        blankCount: 0,
        goodWord: "",
        evilWord: "",
    });
    const [isCreating, setIsCreating] = useState(false);

    // 处理表单输入改变
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        let parsedValue: string | number = value;

        // 如果是数字输入，转换为数字类型
        if (name === "goodCount" || name === "evilCount" || name === "blankCount") {
            parsedValue = value === "" ? 0 : Math.max(0, parseInt(value, 10));
        }

        setRoomSettings((prev) => ({
            ...prev,
            [name]: parsedValue,
        }));
    };

    // 创建房间
    const createRoom = () => {
        // 检查必填字段
        if (!roomSettings.goodWord || !roomSettings.evilWord) {
            alert("请设置好人词和坏人词");
            return;
        }

        if (roomSettings.goodCount < 1) {
            alert("至少需要1名好人");
            return;
        }

        if (roomSettings.evilCount < 1) {
            alert("至少需要1名坏人");
            return;
        }

        // 检查Socket连接
        if (!socket || !isConnected) {
            alert("服务器连接失败，请刷新页面重试");
            return;
        }

        setIsCreating(true);

        // 通过Socket发送创建房间请求
        socket.emit("create_room", roomSettings);

        // 监听房间创建成功事件
        socket.once("room_created", (room) => {
            setIsCreating(false);
            // 重定向到主持人房间页面
            router.push(`/host/${room.roomId}`);
        });

        // 监听错误
        socket.once("error", (error) => {
            setIsCreating(false);
            alert(`创建房间失败: ${error.message}`);
        });
    };

    return (
        <div className="p-6 max-w-md mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-md">
            <h1 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">创建游戏房间</h1>

            {!isConnected && (
                <div className="mb-4 p-3 bg-yellow-100 dark:bg-yellow-800/30 text-yellow-800 dark:text-yellow-200 rounded-lg border border-yellow-200 dark:border-yellow-700">
                    <div className="flex items-center">
                        <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"></path>
                        </svg>
                        正在连接服务器，请稍候...
                    </div>
                </div>
            )}

            <div className="space-y-6">
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                    <h2 className="text-xl font-semibold mb-3 text-gray-800 dark:text-white">玩家设置</h2>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-200">好人数量</label>
                            <input
                                type="number"
                                name="goodCount"
                                min="1"
                                value={roomSettings.goodCount}
                                onChange={handleChange}
                                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-200">坏人数量</label>
                            <input
                                type="number"
                                name="evilCount"
                                min="1"
                                value={roomSettings.evilCount}
                                onChange={handleChange}
                                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-200">白板数量</label>
                            <input
                                type="number"
                                name="blankCount"
                                min="0"
                                value={roomSettings.blankCount}
                                onChange={handleChange}
                                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                    </div>
                    <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
                        总人数: <span className="font-medium">{roomSettings.goodCount + roomSettings.evilCount + roomSettings.blankCount}</span>
                    </p>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                    <h2 className="text-xl font-semibold mb-3 text-gray-800 dark:text-white">词语设置</h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-200">好人词</label>
                            <input
                                type="text"
                                name="goodWord"
                                value={roomSettings.goodWord}
                                onChange={handleChange}
                                placeholder="例如：苹果"
                                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400 dark:placeholder-gray-500"
                            />
                        </div>
                        <div>
                            <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-200">坏人词</label>
                            <input
                                type="text"
                                name="evilWord"
                                value={roomSettings.evilWord}
                                onChange={handleChange}
                                placeholder="例如：香蕉"
                                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400 dark:placeholder-gray-500"
                            />
                            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                                请设置相似但不同的词，例如苹果和梨
                            </p>
                        </div>
                    </div>
                </div>

                <button
                    onClick={createRoom}
                    disabled={isCreating || !isConnected}
                    className={`w-full py-3 rounded-md transition-colors shadow-sm ${isCreating || !isConnected
                        ? "bg-gray-400 dark:bg-gray-600 text-gray-700 dark:text-gray-400 cursor-not-allowed"
                        : "bg-blue-600 text-white hover:bg-blue-700 dark:hover:bg-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
                        }`}
                >
                    {isCreating ? (
                        <span className="flex items-center justify-center">
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            创建中...
                        </span>
                    ) : "创建房间"}
                </button>
            </div>
        </div>
    );
}