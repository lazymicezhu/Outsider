import { submitVote, getVotes } from '../firebase/firebase.js';
import { getFirestore, collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const db = getFirestore();

export const initVote = async (roomId, players) => {
    const voteArea = document.getElementById('voteArea');
    const voteOptions = document.getElementById('voteOptions');
    const submitButton = document.getElementById('submitVoteBtn');

    // 显示投票区域
    voteArea.classList.remove('hidden');

    // 如果没有传入玩家列表，从Firebase获取当前房间的玩家
    let roomPlayers = players;
    if (!roomPlayers || roomPlayers.length === 0) {
        try {
            const playersRef = collection(db, "rooms", roomId, "players");
            const playersQuery = query(playersRef, orderBy("joinedAt", "asc"));
            const snapshot = await getDocs(playersQuery);
            
            roomPlayers = [];
            snapshot.forEach((doc) => {
                const playerData = doc.data();
                roomPlayers.push({
                    id: doc.id,
                    name: playerData.name,
                    uid: playerData.uid
                });
            });
            console.log("已从Firebase获取玩家列表:", roomPlayers);
        } catch (error) {
            console.error("获取玩家列表失败:", error);
            alert("无法获取玩家列表，请刷新页面重试");
            return;
        }
    }

    // 生成投票选项
    voteOptions.innerHTML = '';
    if (roomPlayers && roomPlayers.length > 0) {
        roomPlayers.forEach(player => {
            const li = document.createElement('li');
            li.textContent = player.name || '未知玩家';
            li.dataset.uid = player.uid; // 存储玩家ID，以便后续处理
            li.onclick = () => {
                // 移除其他选项的选中状态
                voteOptions.querySelectorAll('li').forEach(option => {
                    option.classList.remove('selected');
                });
                // 添加选中状态
                li.classList.add('selected');
            };
            voteOptions.appendChild(li);
        });
    } else {
        // 如果仍然无法获取玩家数据，显示错误消息
        const li = document.createElement('li');
        li.textContent = '无法获取玩家列表，请刷新页面';
        li.className = 'error-message';
        voteOptions.appendChild(li);
    }

    // 提交投票
    const handleSubmitVote = async (votedFor, voterName = '我') => {
        if (!votedFor) {
            alert('请选择一名玩家');
            return false;
        }

        try {
            await submitVote(roomId, {
                voter: voterName,
                votedFor: votedFor,
                timestamp: new Date()
            });
            alert('投票已提交');
            if (submitButton) submitButton.disabled = true;
            return true;
        } catch (error) {
            console.error('提交投票失败:', error);
            alert('提交投票失败，请重试');
            return false;
        }
    };

    // 绑定按钮事件
    if (submitButton) {
        submitButton.onclick = () => {
            const selectedOption = voteOptions.querySelector('li.selected');
            if (selectedOption) {
                handleSubmitVote(selectedOption.textContent);
            } else {
                alert('请选择一名玩家');
            }
        };
    }
    
    // 返回API以便外部调用
    return {
        submitVote: handleSubmitVote
    };
}; 