import { Server } from 'socket.io';
import { createServer } from 'http';
import { randomBytes } from 'crypto';

const httpServer = createServer();
const io = new Server(httpServer, {
    cors: {
        origin: "*" 
    }
});

interface Message {
    id: string;
    content: string;
    senderId: string;
    sender: string;
    timestamp: Date;
}

interface Room {
    users: Set<string>;
    newMessages: Message[];
}

const users = new Map();
const rooms = new Map<string, Room>(); 

io.on('connection', (socket) => {

    socket.on("join", (data) => {
        console.log("Join event received data:", data);
        console.log("Join event received data type:", typeof data);
        console.log("Join event received data value:", JSON.stringify(data));
        console.log("A user connected:", socket.id);
        try {
            const roomCode = data.roomId;
            console.log("Extracted roomCode:", roomCode);
            
            if (!roomCode) {
                console.log("Room code is undefined or empty");
                socket.emit("error", { message: "Room code is required"});
                return;
            }
            
            if (!rooms.has(roomCode)) {
                console.log("Room does not exist:", roomCode);
                socket.emit("error", { message: "Room does not exist"});
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
        } catch (error) {
            console.error("Error in join event:", error);
            socket.emit("error", { message: "Invalid data format" });
        }
    });

    // Create a new room
    socket.on("create", ({ roomname}) => {
        try {
            let roomCode;
            do {
                roomCode = randomBytes(3).toString('hex').toUpperCase();
            } while (rooms.has(roomCode))

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
        } catch (error) {
            console.error("Error in create event:", error);
            socket.emit("error", { message: "Failed to create room" });
        }
    });

    socket.on("getRooms", () => {
        socket.emit("roomList", Array.from(rooms.keys()));
    });

    socket.on("roomMessage", ({ roomCode, message }) => {
        try {
            const room = rooms.get(roomCode);
            if (!room) {
                socket.emit("error", { message: "Room does not exist" });
                return;
            }

            const messageData: Message = {
                id: randomBytes(4).toString('hex'),
                content: message,
                senderId: socket.id,
                sender: users.get(socket.id)?.name || 'Anonymous',
                timestamp: new Date()
            };

            room.newMessages.push(messageData);
            io.to(roomCode).emit("roomMessage", { messageData });

            console.log(`Message sent to room ${roomCode}:`, messageData);
        } catch (error) {
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
                } else {
                    socket.to(roomCode).emit("userLeftRoom", {
                        room: roomCode,
                        user: users.get(socket.id)
                    });
                }

                console.log(`User ${socket.id} left room ${roomCode}`);
            }
        } catch (error) {
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
        } catch (error) {
            console.error("Error in disconnect event:", error);
        }
    });
});

httpServer.listen(8080, () => {
    console.log("Server running on port 8080");
});