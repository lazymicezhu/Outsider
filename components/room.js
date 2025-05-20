import { getRoom, listenToRoom, joinRoom, startGame, endGame, isSuperAdmin, useOutsiderAbility, OUTSIDER_ABILITIES } from '../firebase/firebase.js';
import { initChat } from './chat.js';
import { initVote } from './vote.js';
import { showResult } from './result.js';
import { getFirestore, collection, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { auth } from '../firebase/firebase.js';

const db = getFirestore();

// 倒计时时间（秒）
const CHAT_PHASE_TIME = 300; // 5分钟聊天
const VOTE_PHASE_TIME = 60;  // 1分钟投票

let timerInterval = null;
let remainingTime = 0;

export const initRoom = async (user, roomId) => {
    // 获取房间信息
    let room = await getRoom(roomId);
    if (!room) {
        alert('房间不存在');
        window.location.href = './lobby.html';
        return;
    }

    // 更新房间信息显示
    document.getElementById('roomTheme').textContent = room.theme || '默认主题';
    document.getElementById('playerCount').textContent = `玩家数: ${room.playerCount || 0}/${room.maxPlayers || 10}`;

    // 检查是否是超级管理员
    const isUserSuperAdmin = isSuperAdmin(user);
    if (isUserSuperAdmin) {
        console.log("当前用户是超级管理员");
    }

    // 检查localStorage中保存的所有数据
    console.log("localStorage中所有保存的数据:");
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        console.log(`${key}: ${localStorage.getItem(key)}`);
    }

    // 获取玩家可靠的显示名称
    const getPlayerName = (user) => {
        // 首先尝试从localStorage获取注册时保存的名称
        const savedName = localStorage.getItem('playerName');
        if (savedName) {
            console.log("使用localStorage中的玩家名称:", savedName);
            return savedName;
        }
        
        // 然后尝试使用displayName
        if (user.displayName) {
            console.log("使用用户displayName:", user.displayName);
            // 保存到localStorage以便后续使用
            localStorage.setItem('playerName', user.displayName);
            return user.displayName;
        }
        
        // 其次使用email的用户名部分
        if (user.email) {
            const emailName = user.email.split('@')[0];
            console.log("使用邮箱用户名:", emailName);
            return emailName;
        }
        
        // 最后使用随机生成的名称
        const randomName = `玩家${Math.floor(Math.random() * 10000)}`;
        console.log("使用随机名称:", randomName);
        return randomName;
    };
    
    const playerName = getPlayerName(user);
    console.log("最终使用的玩家名称:", playerName);

    // 加入房间
    try {
        // 确保一定使用正确的名称
        console.log("开始加入房间，使用玩家名称:", playerName);
        
        // 直接使用我们获取的可靠玩家名称
        await joinRoom(roomId, {
            name: playerName,
            uid: user.uid
        });
    } catch (error) {
        console.error('加入房间失败:', error);
        alert('加入房间失败，请重试');
        return;
    }

    // 检查当前用户是否是管理员（房主）
    const isAdmin = room.creator === user.uid;
    if (isAdmin) {
        console.log("当前用户是房间管理员");
    }

    // 监听玩家列表变化
    const playerListElement = document.getElementById('playerList');
    const playersRef = collection(db, "rooms", roomId, "players");
    const playersQuery = query(playersRef, orderBy("joinedAt", "asc"));
    
    onSnapshot(playersQuery, (snapshot) => {
        playerListElement.innerHTML = '';
        snapshot.forEach((doc) => {
            const playerData = doc.data();
            const li = document.createElement('li');
            li.className = 'player-item';
            li.dataset.playerId = doc.id;
            li.dataset.uid = playerData.uid;
            
            let roleIcon = '';
            // 如果是超级管理员，显示所有玩家的角色
            if (isUserSuperAdmin) {
                roleIcon = ` ${playerData.role === 'outsider' ? '🔍' : '👤'} (${playerData.role === 'outsider' ? '局外人' : '好人'})`;
            } else if (playerData.role === 'outsider' && room.status === 'ended') {
                roleIcon = ' 🔍 (局外人)';
            } else if (playerData.isReady) {
                roleIcon = ' ✓';
            }
            
            // 检查是否是房主或超级管理员
            const isCreator = playerData.uid === room.creator;
            const creatorBadge = isCreator ? ' 👑' : '';
            const superAdminBadge = playerData.isSuperAdmin ? ' ⭐' : '';
            
            li.innerHTML = `
                <span class="player-name">${playerData.name}${creatorBadge}${superAdminBadge}</span>
                <span class="player-status">${roleIcon}</span>
                ${playerData.uid === user.uid ? ' (你)' : ''}
            `;
            
            if (playerData.uid === user.uid) {
                li.classList.add('current-player');
            }
            
            // 如果当前用户是管理员或超级管理员，并且不是自己，添加踢出按钮
            if ((isAdmin || isUserSuperAdmin) && playerData.uid !== user.uid) {
                const kickButton = document.createElement('button');
                kickButton.className = 'kick-button';
                kickButton.textContent = '踢出';
                kickButton.onclick = (e) => {
                    e.stopPropagation();
                    if (confirm(`确定要踢出玩家 ${playerData.name} 吗？`)) {
                        kickPlayer(roomId, doc.id, playerData.name);
                    }
                };
                li.appendChild(kickButton);
            }
            
            playerListElement.appendChild(li);
        });
    });

    // 设置发送消息按钮
    const sendMessageBtn = document.getElementById('sendMessageBtn');
    if (sendMessageBtn) {
        const chatInput = document.getElementById('chatInput');
        sendMessageBtn.onclick = () => {
            const content = chatInput.value.trim();
            if (content) {
                initChat(roomId).sendMessage(content, playerName);
                chatInput.value = '';
            }
        };
    }

    // 设置提交投票按钮
    const submitVoteBtn = document.getElementById('submitVoteBtn');
    if (submitVoteBtn) {
        submitVoteBtn.onclick = async () => {
            const selectedOption = document.querySelector('#voteOptions li.selected');
            if (selectedOption) {
                // 使用异步等待获取投票处理函数
                const voteHandler = await initVote(roomId, []);
                voteHandler.submitVote(selectedOption.textContent, playerName);
            } else {
                alert('请选择一名玩家');
            }
        };
    }

    // 设置返回大厅按钮
    const backToLobbyBtn = document.getElementById('backToLobbyBtn');
    if (backToLobbyBtn) {
        backToLobbyBtn.onclick = () => {
            window.location.href = './lobby.html';
        };
    }
    
    // 倒计时函数
    const startTimer = (seconds) => {
        clearInterval(timerInterval);
        remainingTime = seconds;
        updateTimerDisplay();
        
        timerInterval = setInterval(() => {
            remainingTime--;
            updateTimerDisplay();
            
            if (remainingTime <= 0) {
                clearInterval(timerInterval);
                // 如果是管理员，自动进入下一阶段
                if (isAdmin && room.status === 'playing') {
                    if (room.phase === 'chat') {
                        moveToVotePhase(roomId);
                    } else if (room.phase === 'vote') {
                        endCurrentGame(roomId);
                    }
                }
            }
        }, 1000);
    };
    
    // 更新计时器显示
    const updateTimerDisplay = () => {
        const timerElement = document.getElementById('timer');
        const minutes = Math.floor(remainingTime / 60);
        const seconds = remainingTime % 60;
        timerElement.textContent = `剩余时间: ${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    };

    // 监听房间状态变化
    const listenToRoom = (roomId) => {
        const roomRef = doc(db, "rooms", roomId);
        return onSnapshot(roomRef, async (doc) => {
            if (doc.exists()) {
                const roomData = doc.data();
                const isRoomOwner = roomData.owner === auth.currentUser.uid;
                
                // 更新玩家列表
                const playersRef = collection(roomRef, "players");
                const playersSnapshot = await getDocs(playersRef);
                const players = [];
                playersSnapshot.forEach((doc) => {
                    players.push({ id: doc.id, ...doc.data() });
                });
                
                // 更新玩家列表显示
                updatePlayerList(players, auth.currentUser.uid, isRoomOwner);
                
                // 更新开始游戏按钮状态
                if (roomData.status === 'waiting') {
                    updateStartGameButton(players, isRoomOwner);
                }
                
                // 更新房间状态显示
                document.getElementById('roomStatus').textContent = 
                    `房间状态: ${roomData.status === 'waiting' ? '等待中' : '游戏中'}`;
                
                // 根据房间状态更新界面
                switch (roomData.status) {
                    case 'waiting':
                        // 等待玩家加入
                        document.getElementById('voteArea').classList.add('hidden');
                        document.getElementById('resultArea').classList.add('hidden');
                        clearInterval(timerInterval);
                        document.getElementById('timer').textContent = '等待游戏开始';
                        break;
                        
                    case 'playing':
                        // 游戏进行中
                        if (roomData.phase === 'chat') {
                            // 聊天阶段
                            document.getElementById('voteArea').classList.add('hidden');
                            document.getElementById('resultArea').classList.add('hidden');
                            initChat(roomId);
                            
                            // 如果刚开始游戏，启动计时器
                            if (roomData.phaseStartTime && !timerInterval) {
                                startTimer(CHAT_PHASE_TIME);
                            }
                            
                            // 如果是管理员或超级管理员，显示进入投票阶段按钮
                            if (isRoomOwner || isUserSuperAdmin) {
                                const actionArea = document.createElement('div');
                                actionArea.className = 'admin-actions';
                                actionArea.innerHTML = `
                                    <button id="moveToVoteBtn" class="admin-btn">进入投票阶段</button>
                                `;
                                if (!document.getElementById('moveToVoteBtn')) {
                                    document.querySelector('.room-header').appendChild(actionArea);
                                    document.getElementById('moveToVoteBtn').onclick = () => {
                                        moveToVotePhase(roomId);
                                    };
                                }
                            }
                            
                        } else if (roomData.phase === 'vote') {
                            // 投票阶段
                            document.getElementById('voteArea').classList.remove('hidden');
                            // 异步初始化投票区域
                            (async function() {
                                await initVote(roomId, roomData.players || []);
                            })();
                            
                            // 如果刚进入投票阶段，启动投票计时器
                            if (roomData.phaseStartTime && (!timerInterval || roomData.phase !== room.phase)) {
                                startTimer(VOTE_PHASE_TIME);
                            }
                            
                            // 移除聊天阶段的管理员按钮
                            const moveToVoteBtn = document.getElementById('moveToVoteBtn');
                            if (moveToVoteBtn) {
                                moveToVoteBtn.parentElement.remove();
                            }
                            
                            // 如果是管理员或超级管理员，显示结束游戏按钮
                            if (isRoomOwner || isUserSuperAdmin) {
                                const actionArea = document.createElement('div');
                                actionArea.className = 'admin-actions';
                                actionArea.innerHTML = `
                                    <button id="endGameBtn" class="admin-btn">结束游戏</button>
                                `;
                                if (!document.getElementById('endGameBtn')) {
                                    document.querySelector('.room-header').appendChild(actionArea);
                                    document.getElementById('endGameBtn').onclick = () => {
                                        endCurrentGame(roomId);
                                    };
                                }
                            }
                        }
                        break;
                        
                    case 'ended':
                        // 游戏结束
                        clearInterval(timerInterval);
                        document.getElementById('timer').textContent = '游戏已结束';
                        document.getElementById('resultArea').classList.remove('hidden');
                        showResult(roomId, roomData.players || []);
                        
                        // 移除所有管理员按钮
                        const adminBtns = document.querySelectorAll('.admin-actions');
                        adminBtns.forEach(btn => btn.remove());
                        
                        // 如果是管理员或超级管理员，显示开始新游戏按钮
                        if (isRoomOwner || isUserSuperAdmin) {
                            const actionArea = document.createElement('div');
                            actionArea.className = 'admin-actions';
                            actionArea.innerHTML = `
                                <button id="newGameBtn" class="admin-btn">开始新游戏</button>
                            `;
                            if (!document.getElementById('newGameBtn')) {
                                document.querySelector('.room-header').appendChild(actionArea);
                                document.getElementById('newGameBtn').onclick = () => {
                                    resetGameState(roomId);
                                };
                            }
                        }
                        break;
                }
                
                // 保存当前房间状态以便后续比较
                room = roomData;
            }
        });
    };

    // 开始游戏按钮（仅房主或超级管理员可见）
    if ((isAdmin || isUserSuperAdmin) && room.status === 'waiting') {
        const startButton = document.createElement('button');
        startButton.textContent = '开始游戏';
        startButton.id = 'startGameBtn';
        startButton.className = 'admin-btn';
        startButton.onclick = async () => {
            try {
                await startGame(roomId);
                // 开始游戏后启动计时器
                startTimer(CHAT_PHASE_TIME);
                
                // 记录游戏阶段开始时间
                const roomRef = doc(db, "rooms", roomId);
                await updateDoc(roomRef, {
                    phaseStartTime: new Date().getTime()
                });
            } catch (error) {
                console.error('开始游戏失败:', error);
                alert('开始游戏失败，请重试');
            }
        };
        
        const actionArea = document.createElement('div');
        actionArea.className = 'admin-actions';
        actionArea.appendChild(startButton);
        document.querySelector('.room-header').appendChild(actionArea);
    }
};

// 管理员功能：踢出玩家
const kickPlayer = async (roomId, playerId, playerName) => {
    try {
        const playerRef = doc(db, "rooms", roomId, "players", playerId);
        await deleteDoc(playerRef);
        
        // 更新房间玩家数量
        const roomRef = doc(db, "rooms", roomId);
        await updateDoc(roomRef, {
            playerCount: Math.max(0, (await getRoom(roomId)).playerCount - 1)
        });
        
        console.log(`玩家 ${playerName} 已被踢出`);
    } catch (error) {
        console.error('踢出玩家失败:', error);
        alert('踢出玩家失败，请重试');
    }
};

// 管理员功能：进入投票阶段
const moveToVotePhase = async (roomId) => {
    try {
        const roomRef = doc(db, "rooms", roomId);
        await updateDoc(roomRef, {
            phase: 'vote',
            phaseStartTime: new Date().getTime()
        });
        console.log('已进入投票阶段');
    } catch (error) {
        console.error('切换到投票阶段失败:', error);
        alert('操作失败，请重试');
    }
};

// 管理员功能：结束当前游戏
const endCurrentGame = async (roomId) => {
    try {
        await endGame(roomId);
        console.log('游戏已结束');
    } catch (error) {
        console.error('结束游戏失败:', error);
        alert('操作失败，请重试');
    }
};

// 管理员功能：重置游戏状态，开始新游戏
const resetGameState = async (roomId) => {
    try {
        const roomRef = doc(db, "rooms", roomId);
        await updateDoc(roomRef, {
            status: 'waiting',
            phase: null,
            phaseStartTime: null,
            startTime: null,
            endTime: null
        });
        console.log('游戏状态已重置');
    } catch (error) {
        console.error('重置游戏状态失败:', error);
        alert('操作失败，请重试');
    }
};

// 返回大厅
export const backToLobby = () => {
    window.location.href = './lobby.html';
};

// 添加局外人能力使用界面
const createAbilityUI = (player) => {
    if (player.role !== 'outsider' || !player.abilities) return '';
    
    return `
        <div class="outsider-abilities">
            <h4>特殊能力</h4>
            <div class="ability-list">
                ${player.abilities.map(ability => {
                    const uses = player.abilityUses[ability] || 0;
                    return `
                        <div class="ability-item" data-ability="${ability}">
                            <span class="ability-name">${getAbilityName(ability)}</span>
                            <span class="ability-uses">剩余次数: ${uses}</span>
                            <button class="use-ability-btn" ${uses <= 0 ? 'disabled' : ''}>
                                使用
                            </button>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
};

// 获取能力名称
const getAbilityName = (ability) => {
    switch (ability) {
        case OUTSIDER_ABILITIES.CONFUSE:
            return '混淆';
        case OUTSIDER_ABILITIES.DECEIVE:
            return '欺骗';
        case OUTSIDER_ABILITIES.HIDE:
            return '隐藏';
        default:
            return '未知能力';
    }
};

// 处理能力使用
const handleAbilityUse = async (ability, playerId) => {
    try {
        switch (ability) {
            case OUTSIDER_ABILITIES.CONFUSE:
                // 显示玩家列表供选择
                const targetPlayer = await showPlayerSelector('选择要混淆的玩家');
                if (targetPlayer) {
                    await useOutsiderAbility(roomId, playerId, ability, { targetPlayer });
                }
                break;
                
            case OUTSIDER_ABILITIES.DECEIVE:
                // 显示消息输入框
                const message = await showMessageInput('输入要发送的匿名消息');
                if (message) {
                    await useOutsiderAbility(roomId, playerId, ability, { message });
                }
                break;
                
            case OUTSIDER_ABILITIES.HIDE:
                // 直接使用隐藏能力
                await useOutsiderAbility(roomId, playerId, ability, {});
                break;
        }
    } catch (error) {
        console.error('使用能力失败:', error);
        alert('使用能力失败: ' + error.message);
    }
};

// 显示玩家选择器
const showPlayerSelector = (title) => {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h3>${title}</h3>
                <div class="player-list"></div>
                <button class="cancel-btn">取消</button>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // 添加玩家列表
        const playerList = modal.querySelector('.player-list');
        const players = Array.from(document.querySelectorAll('.player-item'))
            .filter(item => !item.classList.contains('current-player'));
            
        players.forEach(player => {
            const button = document.createElement('button');
            button.textContent = player.querySelector('.player-name').textContent;
            button.onclick = () => {
                resolve(player.dataset.playerId);
                modal.remove();
            };
            playerList.appendChild(button);
        });
        
        // 取消按钮
        modal.querySelector('.cancel-btn').onclick = () => {
            resolve(null);
            modal.remove();
        };
    });
};

// 显示消息输入框
const showMessageInput = (title) => {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h3>${title}</h3>
                <textarea placeholder="输入消息..."></textarea>
                <div class="modal-buttons">
                    <button class="submit-btn">发送</button>
                    <button class="cancel-btn">取消</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const textarea = modal.querySelector('textarea');
        const submitBtn = modal.querySelector('.submit-btn');
        const cancelBtn = modal.querySelector('.cancel-btn');
        
        submitBtn.onclick = () => {
            const message = textarea.value.trim();
            if (message) {
                resolve(message);
                modal.remove();
            }
        };
        
        cancelBtn.onclick = () => {
            resolve(null);
            modal.remove();
        };
    });
};

// 更新玩家列表显示
const updatePlayerList = (players, currentPlayerId, isRoomOwner) => {
    const playerList = document.getElementById('playerList');
    playerList.innerHTML = '';
    
    players.forEach(player => {
        const li = document.createElement('li');
        li.className = `player-item ${player.uid === currentPlayerId ? 'current-player' : ''}`;
        
        // 添加玩家状态标记
        let statusBadge = '';
        if (player.isSuperAdmin) {
            statusBadge = '<span class="badge super-admin">⭐</span>';
        }
        if (player.isReady) {
            statusBadge += '<span class="badge ready">✓</span>';
        }
        
        li.innerHTML = `
            <span class="player-name">${player.name}</span>
            ${statusBadge}
            ${isRoomOwner && player.uid !== currentPlayerId ? 
                `<button onclick="kickPlayer('${player.uid}')" class="kick-btn">踢出</button>` : 
                ''}
        `;
        playerList.appendChild(li);
    });
};

// 更新开始游戏按钮状态
const updateStartGameButton = (players, isRoomOwner) => {
    const startGameBtn = document.getElementById('startGameBtn');
    if (!startGameBtn) return;
    
    if (isRoomOwner) {
        // 检查是否所有玩家都已准备
        const allReady = players.every(player => player.isReady);
        const enoughPlayers = players.length >= 3;
        
        startGameBtn.textContent = '开始游戏';
        startGameBtn.disabled = !(allReady && enoughPlayers);
        startGameBtn.onclick = () => startGame();
    } else {
        // 非房主显示准备/取消准备按钮
        const currentPlayer = players.find(p => p.uid === auth.currentUser.uid);
        const isReady = currentPlayer ? currentPlayer.isReady : false;
        
        startGameBtn.textContent = isReady ? '取消准备' : '准备';
        startGameBtn.disabled = false;
        startGameBtn.onclick = () => toggleReady();
    }
};

// 切换准备状态
const toggleReady = async () => {
    try {
        const currentPlayer = players.find(p => p.uid === auth.currentUser.uid);
        if (!currentPlayer) return;
        
        const newReadyState = !currentPlayer.isReady;
        await updatePlayerReady(roomId, currentPlayer.id, newReadyState);
    } catch (error) {
        console.error('更新准备状态失败:', error);
        alert('更新准备状态失败，请重试');
    }
}; 