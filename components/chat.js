import { sendMessage, listenToMessages } from '../firebase/firebase.js';
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db } from '../firebase/firebase.js';

export const initChat = (roomId) => {
    const chatMessages = document.getElementById('chatMessages');
    const chatInput = document.getElementById('chatInput');
    const sendMessageBtn = document.getElementById('sendMessageBtn');
    let remainingMessagesBadge = null;
    
    // 创建局外人发言次数提示
    const createRemainingMessagesBadge = (count) => {
        if (remainingMessagesBadge) {
            remainingMessagesBadge.remove();
        }
        const badge = document.createElement('div');
        badge.className = 'remaining-messages';
        badge.innerHTML = `剩余发言次数: ${count}`;
        document.body.appendChild(badge);
        remainingMessagesBadge = badge;
        return badge;
    };
    
    // 监听当前玩家状态
    const currentPlayerId = document.querySelector('.current-player').dataset.playerId;
    const playerRef = doc(db, "rooms", roomId, "players", currentPlayerId);
    onSnapshot(playerRef, (doc) => {
        const playerData = doc.data();
        if (playerData && playerData.role === 'outsider') {
            createRemainingMessagesBadge(playerData.remainingMessages || 0);
        } else if (remainingMessagesBadge) {
            remainingMessagesBadge.remove();
            remainingMessagesBadge = null;
        }
    });
    
    // 添加系统消息
    const addSystemMessage = (content) => {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message system';
        messageDiv.innerHTML = `
            <span class="message-time">${formatTime(new Date())}</span>
            <div class="message-content">${content}</div>
        `;
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    };
    
    // 监听消息
    listenToMessages(roomId, (messages) => {
        chatMessages.innerHTML = messages.map(msg => {
            const messageClass = msg.isOutsider ? 'message outsider' : 'message';
            // 优先显示displayName，没有则用fakeName
            const senderName = msg.displayName || msg.fakeName || '未知';
            
            return `
                <div class="${messageClass}">
                    <span class="message-sender">${senderName}</span>
                    <span class="message-time">${formatTime(msg.timestamp)}</span>
                    <div class="message-content">${msg.content}</div>
                </div>
            `;
        }).join('');
        
        // 自动滚动到底部
        chatMessages.scrollTop = chatMessages.scrollHeight;
    });
    
    // 发送消息
    const handleSendMessage = async (content) => {
        if (!content.trim()) return;
        
        try {
            // 禁用输入和按钮
            chatInput.disabled = true;
            sendMessageBtn.disabled = true;
            
            // 发送消息时带上displayName
            const playerName = localStorage.getItem('playerName') || '未知玩家';
            await sendMessage(roomId, {
                content: content.trim(),
                senderId: currentPlayerId,
                displayName: playerName
            });
            
            chatInput.value = '';
            
            // 2秒后恢复输入
            setTimeout(() => {
                chatInput.disabled = false;
                sendMessageBtn.disabled = false;
                chatInput.focus();
            }, 2000);
            
        } catch (error) {
            console.error('发送消息失败:', error);
            chatInput.disabled = false;
            sendMessageBtn.disabled = false;
            
            if (error.message === '局外人的发言次数已用完') {
                addSystemMessage('您的发言次数已用完');
            } else if (error.message === '发言太频繁，请稍后再试') {
                addSystemMessage('发言太频繁，请稍后再试');
            } else {
                addSystemMessage('发送消息失败，请重试');
            }
        }
    };
    
    // 绑定发送按钮事件
    if (sendMessageBtn) {
        sendMessageBtn.onclick = () => {
            const content = chatInput.value.trim();
            if (content) {
                handleSendMessage(content);
            }
        };
    }
    
    // 绑定回车键发送
    if (chatInput) {
        chatInput.onkeypress = (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const content = chatInput.value.trim();
                if (content) {
                    handleSendMessage(content);
                }
            }
        };
    }
    
    // 格式化时间
    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    };
    
    // 返回API以便外部调用
    return {
        sendMessage: handleSendMessage
    };
}; 