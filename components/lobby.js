import { createRoom, getRoom, listenToRoom, logout } from '../firebase/firebase.js';

export const initLobby = (user) => {
    // 创建房间按钮
    const createRoomBtn = document.getElementById('createRoomBtn');
    createRoomBtn.onclick = async () => {
        try {
            const roomId = await createRoom({
                creator: user.uid,
                creatorName: user.displayName || '匿名玩家',
                theme: '默认主题'
            });
            window.location.href = `./room.html?id=${roomId}`;
        } catch (error) {
            console.error('创建房间失败:', error);
            alert('创建房间失败，请重试');
        }
    };

    // 加入房间按钮
    const joinRoomBtn = document.getElementById('joinRoomBtn');
    joinRoomBtn.onclick = async () => {
        const roomId = document.getElementById('roomCode').value.trim();
        if (!roomId) {
            alert('请输入房间号');
            return;
        }

        try {
            const room = await getRoom(roomId);
            if (!room) {
                alert('房间不存在');
                return;
            }

            if (room.status !== 'waiting') {
                alert('该房间已经开始游戏');
                return;
            }

            if (room.playerCount >= room.maxPlayers) {
                alert('房间已满');
                return;
            }

            window.location.href = `./room.html?id=${roomId}`;
        } catch (error) {
            console.error('加入房间失败:', error);
            alert('加入房间失败，请重试');
        }
    };
    
    // 退出登录按钮
    const logoutBtn = document.getElementById('logoutBtn');
    logoutBtn.onclick = async () => {
        try {
            await logout();
            window.location.href = './index.html';
        } catch (error) {
            console.error('退出登录失败:', error);
            alert('退出登录失败，请重试');
        }
    };

    // 监听可用房间列表
    const roomList = document.getElementById('roomList');
    listenToRoom('rooms', (rooms) => {
        roomList.innerHTML = '';
        Object.entries(rooms).forEach(([roomId, roomData]) => {
            if (roomData.status === 'waiting' && roomData.playerCount < roomData.maxPlayers) {
                const li = document.createElement('li');
                li.innerHTML = `
                    <span>主题: ${roomData.theme}</span>
                    <span>玩家: ${roomData.playerCount}/${roomData.maxPlayers}</span>
                    <button onclick="window.location.href='./room.html?id=${roomId}'">加入</button>
                `;
                roomList.appendChild(li);
            }
        });
    });
}; 