const socket = io();
let username = '', myAvatar = null, replyToMsg = null;
const $ = id => document.getElementById(id);

// Rasm yuklash (Avatar)
$('avatarUpload').onclick = () => $('avatarInput').click();
$('avatarInput').onchange = (e) => {
  const file = e.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => { myAvatar = ev.target.result; $('avatarPreview').style.backgroundImage = `url(${myAvatar})`; $('avatarPreview').textContent = ''; };
  reader.readAsDataURL(file);
};

// Kirish
$('joinBtn').onclick = () => {
  const name = $('usernameInput').value.trim();
  if(!name) return alert('Ism kiriting!');
  username = name;
  socket.emit('join', { username, room: 'general', avatar: myAvatar });
  $('loginScreen').classList.add('hidden');
  $('chatScreen').classList.remove('hidden');
  $('input').focus();
};

// Xabar yuborish
$('form').onsubmit = (e) => {
  e.preventDefault();
  const text = $('input').value.trim();
  if(!text) return;
  socket.emit('chat message', { text, replyTo: replyToMsg });
  $('input').value = '';
  window.replyToMsg = null;
  $('replyBar').classList.add('hidden');
};

// Tarixni yuklash va yangilanishlarni kuzatish
socket.on('history', msgs => { $('messages').innerHTML = ''; msgs.forEach(renderMsg); });
socket.on('chat message', renderMsg);
socket.on('msg update', msg => {
  const el = document.querySelector(`[data-id="${msg.id}"]`);
  if(msg.deleted) { if(el) el.remove(); return; }
  if(el) renderMsg(msg, el);
});

// Xabarni ekranga chiqarish
function renderMsg(msg, el = null) {
  const isMine = msg.user === username;
  const li = el || document.createElement('li');
  li.className = isMine ? 'mine' : 'other';
  li.dataset.id = msg.id;

  let reply = msg.replyTo ? `<div class="msg-reply"><b>${msg.replyTo.user}</b><br>${msg.replyTo.text}</div>` : '';
  let reactions = Object.keys(msg.reactions).length ? `<div class="reactions">${Object.entries(msg.reactions).map(([e,u])=>`<span class="reaction">${e} ${u.length}</span>`).join('')}</div>` : '';
  
  let fileHtml = '';
  if (msg.file) {
    if (msg.file.type.startsWith('image/')) fileHtml = `<div class="msg-file"><img src="${msg.file.data}"></div>`;
    else if (msg.file.type.startsWith('video/')) fileHtml = `<div class="msg-file"><video src="${msg.file.data}" controls></video></div>`;
    else if (msg.file.type.startsWith('audio/')) fileHtml = `<div class="msg-file"><audio src="${msg.file.data}" controls></audio></div>`;
    else fileHtml = `<div class="msg-file"><a href="${msg.file.data}" download="${msg.file.name}" style="color:inherit">📎 ${msg.file.name}</a></div>`;
  }

  const avatarStyle = msg.avatar ? `background-image:url(${msg.avatar});` : `background:${msg.color};`;
  
  li.innerHTML = `
    <div class="msg-actions">
      <button onclick="window.setReply(${msg.id}, '${msg.user}', '${msg.text ? msg.text.replace(/'/g,"\\'") : 'Fayl'}')">↩️</button>
      ${isMine ? `<button onclick="editMsg(${msg.id}, '${msg.text ? msg.text.replace(/'/g,"\\'") : ''}')">✏️</button><button onclick="delMsg(${msg.id})">🗑️</button>` : ''}
      <button onclick="reactMsg(${msg.id}, '❤️')">❤️</button>
    </div>
    ${!isMine ? `<div style="font-size:12px;font-weight:bold;color:${msg.color};margin-bottom:3px;display:flex;align-items:center;gap:5px;"><div class="avatar" style="${avatarStyle}"></div>${msg.user}</div>` : ''}
    ${reply}
    <div>${msg.text || ''}</div>
    ${fileHtml}
    ${reactions}
    <div class="msg-time">${msg.timeStr} ${msg.edited?'(tahrirlangan)':''}</div>
  `;
  
  if(!el) { $('messages').appendChild(li); $('chatBody').scrollTop = $('chatBody').scrollHeight; }
}

// Fayl yuborish
$('fileBtn').onclick = () => $('fileInput').click();
$('fileInput').onchange = (e) => {
  const file = e.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    socket.emit('chat message', { text: '', file: { name: file.name, type: file.type, data: ev.target.result } });
    $('fileInput').value = '';
  };
  reader.readAsDataURL(file);
};

// Amallar (Reply, Edit, Delete, React)
window.setReply = (id, user, text) => { window.replyToMsg = {id, user, text}; $('replyUser').textContent = user; $('replyText').textContent = text; $('replyBar').classList.remove('hidden'); $('input').focus(); };
window.editMsg = (id, old) => { const t = prompt('Tahrirlash:', old); if(t && t.trim()) socket.emit('edit message', {id, newText:t.trim()}); };
window.delMsg = id => { if(confirm("O'chirilsinmi?")) socket.emit('delete message', id); };
window.reactMsg = (id, e) => socket.emit('react message', {id, emoji:e});

// Emoji
const emojis = ['😀','😂','😍','👍','🔥','❤️','😢','😡','🎉','🙏','🤔','😎','🥰','🤩','😭','🤯','🤬','🤮','🤧','😷','🤒','🤕','🤠','🤡','🤢','🤓','🧐','🤨','🤫','🤭'];
$('emojiPanel').innerHTML = emojis.map(e=>`<span onclick="insertEmoji('${e}')">${e}</span>`).join('');
$('emojiBtn').onclick = () => $('emojiPanel').classList.toggle('hidden');
window.insertEmoji = e => { $('input').value += e; $('emojiPanel').classList.add('hidden'); $('input').focus(); };

// Yozayotganini ko'rsatish
let typingTimer;
$('input').oninput = () => {
  socket.emit('typing');
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => socket.emit('stop typing'), 1000);
};
socket.on('typing', u => $('typingIndicator').textContent = `${u} yozmoqda...`);
socket.on('stop typing', () => $('typingIndicator').textContent = '');

// Tizim va Onlayn foydalanuvchilar
socket.on('system message', m => {
  const li = document.createElement('li'); li.className = 'system'; li.textContent = m;
  $('messages').appendChild(li); $('chatBody').scrollTop = $('chatBody').scrollHeight;
});
socket.on('user list', users => {
  $('onlineCount').textContent = users.length;
  $('userList').innerHTML = users.map(u => `<li><div class="avatar" style="${u.avatar ? `background-image:url(${u.avatar})` : `background:${u.color}`}"></div> ${u.name}</li>`).join('');
});

// Tungi rejim
$('themeToggle').onclick = () => {
  document.body.classList.toggle('dark');
  $('themeToggle').textContent = document.body.classList.contains('dark') ? '☀️' : '🌙';
};