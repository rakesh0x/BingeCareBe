"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const socket_io_1 = require("socket.io");
const http_1 = require("http");
const crypto_1 = require("crypto");
const httpServer = (0, http_1.createServer)();
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: "*"
    }
});
const users = new Map();
const rooms = new Map();
io.on('connection', (socket) => {
    socket.on("join", ({ data }) => {
        console.log("A user connected:", socket.id);
        try {
            const roomCode = data.roomId;
            if (!rooms.has(roomCode)) {
                socket.emit("error", { message: "Room does not exist" });
                return;
            }
            const room = rooms.get(roomCode);
            if (!room) {
                socket.emit("error", { newMessage: "Room not found" });
                return;
            }
            socket.join(roomCode);
            room.users.add(socket.id);
            socket.to(roomCode).emit("joined-room", {
                roomCode,
                messages: room.newMessages
            });
            console.log(`User ${socket.id} joined room ${roomCode}`);
        }
        catch (error) {
            console.error("Error in join event:", error);
            socket.emit("error", { message: "Invalid data format" });
        }
    });
    // Create a new room
    socket.on("create", ({ roomname }) => {
        try {
            let roomCode;
            do {
                roomCode = (0, crypto_1.randomBytes)(3).toString('hex').toUpperCase();
            } while (rooms.has(roomCode));
            console.log("Generated Room Code:", roomCode);
            rooms.set(roomCode, {
                users: new Set([socket.id]),
                newMessages: []
            });
            socket.join(roomCode);
            console.log("Room created successfully:", roomCode);
            socket.emit("roomCreated", {
                roomCode,
                socketId: socket.id,
                roomname
            });
        }
        catch (error) {
            console.error("Error in create event:", error);
            socket.emit("error", { message: "Failed to create room" });
        }
    });
    socket.on("getRooms", () => {
        socket.emit("roomList", Array.from(rooms.keys()));
    });
    socket.on("roomMessage", ({ roomCode, message }) => {
        var _a;
        try {
            const room = rooms.get(roomCode);
            if (!room) {
                socket.emit("error", { message: "Room does not exist" });
                return;
            }
            const messageData = {
                id: (0, crypto_1.randomBytes)(4).toString('hex'),
                content: message,
                senderId: socket.id,
                sender: ((_a = users.get(socket.id)) === null || _a === void 0 ? void 0 : _a.name) || 'Anonymous',
                timestamp: new Date()
            };
            room.newMessages.push(messageData);
            io.to(roomCode).emit("roomMessage", { messageData });
            console.log(`Message sent to room ${roomCode}:`, messageData);
        }
        catch (error) {
            console.error("Error in roomMessage event:", error);
            socket.emit("error", { message: "Failed to send message" });
        }
    });
    // Leave a room
    socket.on("leaveRoom", (roomCode) => {
        try {
            if (rooms.has(roomCode)) {
                const room = rooms.get(roomCode);
                if (!room) {
                    socket.emit("error", { message: "Room not found" });
                    return;
                }
                room.users.delete(socket.id);
                socket.leave(roomCode);
                if (room.users.size === 0) {
                    rooms.delete(roomCode);
                    io.emit("roomList", Array.from(rooms.keys()));
                }
                else {
                    socket.to(roomCode).emit("userLeftRoom", {
                        room: roomCode,
                        user: users.get(socket.id)
                    });
                }
                console.log(`User ${socket.id} left room ${roomCode}`);
            }
        }
        catch (error) {
            console.error("Error in leaveRoom event:", error);
            socket.emit("error", { message: "Failed to leave room" });
        }
    });
    // Handle user disconnect
    socket.on("disconnect", () => {
        try {
            const user = users.get(socket.id);
            if (user) {
                rooms.forEach((room, roomCode) => {
                    room.users.delete(socket.id);
                    if (room.users.size === 0) {
                        rooms.delete(roomCode);
                        io.emit("roomList", Array.from(rooms.keys()));
                    }
                });
                users.delete(socket.id);
                socket.broadcast.emit("userLeft", user);
            }
            console.log("A user disconnected:", socket.id);
        }
        catch (error) {
            console.error("Error in disconnect event:", error);
        }
    });
});
httpServer.listen(8080, () => {
    console.log("Server running on port 8080");
});
