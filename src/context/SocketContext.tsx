"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { io, Socket } from "socket.io-client";

// Socket上下文类型
interface SocketContextType {
    socket: Socket | null;
    isConnected: boolean;
}

// 创建上下文
const SocketContext = createContext<SocketContextType>({
    socket: null,
    isConnected: false,
});

// Socket提供器组件接口
interface SocketProviderProps {
    children: ReactNode;
}

// Socket提供器组件
export function SocketProvider({ children }: SocketProviderProps) {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        // 在客户端创建Socket.io连接
        const socketInstance = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001", {
            transports: ["websocket"],
            autoConnect: true,
        });

        // 连接事件
        socketInstance.on("connect", () => {
            console.log("Socket.io 已连接");
            setIsConnected(true);
        });

        // 断开连接事件
        socketInstance.on("disconnect", () => {
            console.log("Socket.io 已断开连接");
            setIsConnected(false);
        });

        // 连接错误事件
        socketInstance.on("connect_error", (err) => {
            console.error("Socket.io 连接错误:", err.message);
            setIsConnected(false);
        });

        // 设置socket实例
        setSocket(socketInstance);

        // 清理函数
        return () => {
            socketInstance.disconnect();
        };
    }, []);

    return (
        <SocketContext.Provider value={{ socket, isConnected }}>
            {children}
        </SocketContext.Provider>
    );
}

// 自定义Hook，方便在组件中使用Socket上下文
export function useSocket() {
    return useContext(SocketContext);
}