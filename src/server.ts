import { Server } from 'socket.io';
import { createServer } from 'http';

const httpServer = createServer();
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        credentials: true,
        methods: ["GET", "POST"]
    }
});

const users = new Map();
const rooms = new Map();

io.on('connection', (socket) => {
    const username = socket.handshake.query.username;

    if (username) {
        users.set(socket.id, username);
        socket.broadcast.emit("userJoined", username);
        io.emit("users", Array.from(users.values()));
        console.log(`${username} joined the chat`);
    }

    socket.on("join", (roomname) => {
        if (!rooms.has(roomname)) {
            socket.emit("error", "Room doesn't exist");
            return;
        }

        socket.join(roomname);
        rooms.get(roomname).add(socket.id);

        socket.to(roomname).emit("userJoined", {
            room: roomname,
            user: users.get(socket.id)
        });

        const RoomMembers = Array.from(rooms.get(roomname))
            .map(id => users.get(id))
            .filter(Boolean);

        socket.emit("roomUsers", { room: roomname, users: RoomMembers });
    });

    socket.on("create", (roomname) => {
        if (rooms.has(roomname)) {
            socket.emit("error", "Room already exists");
            return;
        }

        rooms.set(roomname, new Set([socket.id]));
        socket.join(roomname);
        socket.emit("roomCreated", roomname);
        io.emit("roomList", Array.from(rooms.keys()));
    });

    socket.on("getRooms", () => {
        socket.emit("roomList", Array.from(rooms.keys()));
    });

    socket.on("roomMessage", ({ room, message }) => {
        if (!rooms.has(room)) {
            socket.emit("error", "Room doesn't exist");
            return;
        }

        if (!rooms.get(room).has(socket.id)) {
            socket.emit("error", "You're not in the room");
            return;
        }

        io.to(room).emit("roomMessage", {
            room,
            message,
            sender: users.get(socket.id),
            timeStamp: new Date()
        });
    });

    socket.on("leaveRoom", (roomname) => {
        if (rooms.has(roomname)) {
            rooms.get(roomname).delete(socket.id);
            socket.leave(roomname);

            if (rooms.get(roomname).size === 0) {
                rooms.delete(roomname);
                io.emit("roomList", Array.from(rooms.keys()));
            } else {
                socket.to(roomname).emit("userLeftRoom", {
                    room: roomname,
                    user: users.get(socket.id)
                });
            }
        }
    });

    socket.on("disconnect", () => {
        const user = users.get(socket.id);
        if (user) {
            rooms.forEach((members, roomname) => {
                members.delete(socket.id);
                if (members.size === 0) {
                    rooms.delete(roomname);
                    io.emit("roomList", Array.from(rooms.keys()));
                }
            });
            users.delete(socket.id);
            socket.broadcast.emit("userLeft", user);
        }
    });
});

httpServer.listen(8080, () => {
    console.log("Server running on port 8080");
});