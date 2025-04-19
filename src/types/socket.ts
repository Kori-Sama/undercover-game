import { Server as NetServer } from 'http';
import { NextApiResponse } from 'next';
import { Server as IOServer } from 'socket.io';

// 扩展Next.js API响应类型，添加Socket.io服务器实例
export interface NextApiResponseServerIO extends NextApiResponse {
    socket: NextApiResponse['socket'] & {
        server: NetServer & {
            io: IOServer;
        };
    };
}