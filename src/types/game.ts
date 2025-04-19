// 游戏相关的类型定义

// 玩家角色类型
export type PlayerRole = "good" | "evil" | "blank";

// 玩家状态
export type PlayerStatus = "alive" | "eliminated";

// 游戏状态
export type GameState = "waiting" | "playing" | "voting" | "guessing" | "ended";

// 玩家信息
export interface Player {
    id: string;
    name: string;
    role?: PlayerRole; // 角色
    status: PlayerStatus;
    word?: string; // 分配的词
    vote?: string; // 投票给谁
}

// 房间设置
export interface RoomSettings {
    goodCount: number;
    evilCount: number;
    blankCount: number;
    goodWord: string;
    evilWord: string;
}

// 房间信息
export interface Room extends RoomSettings {
    roomId: string;
    host: string;
    players: Player[];
    state: GameState;
    createdAt: string;
    winner?: "good" | "evil" | "blank"; // 获胜方
}