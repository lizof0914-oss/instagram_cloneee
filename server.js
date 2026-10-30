const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
// Rasm va fayllar yuborish uchun limitni oshiramiz
const io = new Server(server, { cors: { origin: "*" }, maxHttpBufferSize: 1e7 });

app.use(express.static(path.join(__dirname, 'public')));

const users = {};
const messages = { general: [] };
const colors = ['#667eea', '#f093fb', '#4facfe', '#43e97b', '#fa709a', '#feca57', '#ff6b6b', '#48dbfb'];
let colorIndex = 0;
let msgId = Date.now();

io.on('connection', (socket) => {
  socket.on('join', ({ username, room, avatar }) => {
    const r = room || 'general';
    if (!messages[r]) messages[r] = [];
    users[socket.id] = { name: username, color: colors[colorIndex++ % colors.length], avatar, room: r };

    socket.join(r);
    socket.emit('history', messages[r]);
    io.to(r).emit('system message', `${username} chatga qo'shildi`);
    broadcastUsers(r);
  });

  socket.on('chat message', (data) => {
    const user = users[socket.id];
    if (!user) return;
    const msg = {
      id: msgId++, userId: socket.id, user: user.name, color: user.color, avatar: user.avatar,
      text: data.text || '', file: data.file || null, replyTo: data.replyTo || null,
      timeStr: new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }),
      edited: false, deleted: false, reactions: {}
    };
    messages[user.room].push(msg);
    if (messages[user.room].length > 200) messages[user.room].shift();
    io.to(user.room).emit('chat message', msg);
  });

  socket.on('edit message', ({ id, newText }) => {
    const user = users[socket.id]; if (!user) return;
    const msg = messages[user.room].find(m => m.id === id);
    if (msg && msg.userId === socket.id) { 
      msg.text = newText; msg.edited = true; 
      io.to(user.room).emit('msg update', msg); 
    }
  });

  socket.on('delete message', (id) => {
    const user = users[socket.id]; if (!user) return;
    const msg = messages[user.room].find(m => m.id === id);
    if (msg && msg.userId === socket.id) { 
      msg.deleted = true; msg.text = ''; msg.file = null; 
      io.to(user.room).emit('msg update', msg); 
    }
  });

  socket.on('react message', ({ id, emoji }) => {
    const user = users[socket.id]; if (!user) return;
    const msg = messages[user.room].find(m => m.id === id); if (!msg) return;
    if (!msg.reactions[emoji]) msg.reactions[emoji] = [];
    const idx = msg.reactions[emoji].indexOf(socket.id);
    if (idx === -1) { msg.reactions[emoji].push(socket.id); } 
    else { msg.reactions[emoji].splice(idx, 1); if (!msg.reactions[emoji].length) delete msg.reactions[emoji]; }
    io.to(user.room).emit('msg update', msg);
  });

  socket.on('typing', () => { const u = users[socket.id]; if (u) socket.to(u.room).emit('typing', u.name); });
  socket.on('stop typing', () => { const u = users[socket.id]; if (u) socket.to(u.room).emit('stop typing'); });

  socket.on('disconnect', () => {
    const user = users[socket.id];
    if (user) { io.to(user.room).emit('system message', `${user.name} chiqdi`); delete users[socket.id]; broadcastUsers(user.room); }
  });
});

function broadcastUsers(room) {
  io.to(room).emit('user list', Object.entries(users).filter(([_, u]) => u.room === room).map(([id, u]) => ({ id, name: u.name, color: u.color, avatar: u.avatar })));
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server ishga tushdi: http://localhost:${PORT}`));