"use client";

import { ReactNode } from "react";
import { SocketProvider } from "./SocketContext";

export function SocketWrapper({ children }: { children: ReactNode }) {
    return <SocketProvider>{children}</SocketProvider>;
}