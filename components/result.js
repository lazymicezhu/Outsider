import { getVotes } from '../firebase/firebase.js';
import { getFirestore, collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const db = getFirestore();

export const showResult = async (roomId, players) => {
    const resultArea = document.getElementById('resultArea');
    const resultContent = document.getElementById('resultContent');
    
    // 显示结果区域
    resultArea.classList.remove('hidden');
    
    try {
        // 获取投票结果
        const votes = await getVotes(roomId);
        
        // 获取完整的玩家列表
        let roomPlayers = players;
        if (!roomPlayers || roomPlayers.length === 0) {
            const playersRef = collection(db, "rooms", roomId, "players");
            const playersQuery = query(playersRef, orderBy("joinedAt", "asc"));
            const snapshot = await getDocs(playersQuery);
            
            roomPlayers = [];
            snapshot.forEach((doc) => {
                const playerData = doc.data();
                roomPlayers.push({
                    id: doc.id,
                    name: playerData.name,
                    role: playerData.role,
                    uid: playerData.uid
                });
            });
        }
        
        // 统计投票
        const voteCount = {};
        votes.forEach(vote => {
            voteCount[vote.votedFor] = (voteCount[vote.votedFor] || 0) + 1;
        });
        
        // 找出得票最多的玩家
        let maxVotes = 0;
        let votedOut = null;
        for (const [player, count] of Object.entries(voteCount)) {
            if (count > maxVotes) {
                maxVotes = count;
                votedOut = player;
            }
        }
        
        // 显示结果
        const outsider = roomPlayers.find(p => p.role === 'outsider');
        if (!outsider) {
            throw new Error('无法找到局外人信息');
        }
        
        const isOutsiderVotedOut = votedOut === outsider.name;
        
        resultContent.innerHTML = `
            <h4>投票结果</h4>
            <p>被投票出局的玩家：${votedOut || '无'}</p>
            <p>局外人：${outsider.name}</p>
            <p>游戏结果：${isOutsiderVotedOut ? '好人胜利！' : '局外人胜利！'}</p>
            <div class="vote-details">
                <h5>详细投票情况：</h5>
                <ul>
                    ${Object.entries(voteCount).map(([player, count]) => 
                        `<li>${player}: ${count}票</li>`
                    ).join('')}
                </ul>
            </div>
        `;
    } catch (error) {
        console.error('获取结果失败:', error);
        resultContent.innerHTML = '<p>获取结果失败，请刷新页面重试</p>';
    }
}; 