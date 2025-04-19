"use client"; // Add this line because we use useState

import Link from "next/link";
import { useState } from "react";

export default function Home() {
  const [roomId, setRoomId] = useState("");

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-8 items-center">
        <h1 className="text-4xl font-bold">谁是卧底</h1>

        <div className="flex flex-col gap-4 w-full max-w-xs">
          {/* Option to Create Room */}
          <Link
            href="/host/new" // Consider generating a unique ID server-side later
            className="text-center rounded-md bg-blue-600 text-white px-4 py-2 hover:bg-blue-700 transition-colors"
          >
            创建房间
          </Link>

          {/* Option to Join Room */}
          <div className="flex flex-col gap-2">
            <input
              type="text"
              placeholder="输入房间号"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value.trim())} // Trim whitespace
              className="border border-gray-300 rounded-md px-3 py-2 text-black"
            />
            <Link
              href={roomId ? `/player/${roomId}` : "#"} // Prevent navigation if no ID
              aria-disabled={!roomId}
              className={`text-center rounded-md px-4 py-2 transition-colors ${roomId
                ? "bg-green-600 text-white hover:bg-green-700"
                : "bg-gray-400 text-gray-700 cursor-not-allowed"
                }`}
              onClick={(e) => !roomId && e.preventDefault()} // Prevent click if no ID
            >
              加入房间
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
