import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, doc, getDoc, setDoc, updateDoc, onSnapshot, query, where, orderBy, serverTimestamp, increment, getDocs, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Firebase配置
const firebaseConfig = {
    apiKey: "AIzaSyAooR_BmRTRokIJ1CgAMLDqrynLY43DVeM",
    authDomain: "outsider-2b0a6.firebaseapp.com",
    databaseURL: "https://outsider-2b0a6-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "outsider-2b0a6",
    storageBucket: "outsider-2b0a6.firebasestorage.app",
    messagingSenderId: "357811029559",
    appId: "1:357811029559:web:bed0123bf20fcedad6e1b2",
    measurementId: "G-57PG82FLDF"
};

// 初始化Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// 超级管理员邮箱列表
const SUPER_ADMIN_EMAILS = ['zxbz1112@gmail.com']; // 替换为实际的超级管理员邮箱

// 检查是否是超级管理员
export const isSuperAdmin = (user) => {
    return user && SUPER_ADMIN_EMAILS.includes(user.email);
};

// 邮箱注册
export const registerWithEmail = async (email, password, displayName) => {
    try {
        console.log("开始注册，用户名:", displayName);
        
        // 先创建用户
        const result = await createUserWithEmailAndPassword(auth, email, password);
        
        // 确保displayName不为空
        if (!displayName) {
            displayName = email.split('@')[0]; // 使用邮箱前缀作为默认昵称
        }
        
        console.log("创建用户成功，开始设置用户名:", displayName);
        
        // 更新用户显示名称
        await updateProfile(result.user, {
            displayName: displayName
        });
        
        // 重新获取用户信息，确保displayName已经更新
        await result.user.reload();
        const updatedUser = auth.currentUser;
        
        // 记录日志，方便调试
        console.log("注册流程完成，更新后的用户信息:", updatedUser);
        console.log("用户名是否设置成功:", updatedUser.displayName === displayName);
        
        // 将用户名保存到localStorage, 确保应用中使用一致的名称
        localStorage.setItem('playerName', displayName);
        console.log("已将用户名保存到localStorage:", displayName);
        
        return updatedUser;
    } catch (error) {
        console.error("注册失败:", error);
        throw error;
    }
};

// 邮箱登录
export const loginWithEmail = async (email, password) => {
    try {
        const result = await signInWithEmailAndPassword(auth, email, password);
        
        // 重新获取用户信息，确保获取最新的profile数据
        await result.user.reload();
        const currentUser = auth.currentUser;
        
        // 记录日志，方便调试
        console.log("登录成功，用户名:", currentUser.displayName);
        
        return currentUser;
    } catch (error) {
        console.error("登录失败:", error);
        throw error;
    }
};

// 退出登录
export const logout = async () => {
    try {
        await signOut(auth);
    } catch (error) {
        console.error("退出登录失败:", error);
        throw error;
    }
};

// 监听认证状态
export const onAuthStateChange = (callback) => {
    return onAuthStateChanged(auth, callback);
};

// 房间相关操作
export const createRoom = async (roomData) => {
    const roomRef = doc(collection(db, "rooms"));
    await setDoc(roomRef, {
        ...roomData,
        createdAt: serverTimestamp(),
        status: "waiting",
        playerCount: 0,
        maxPlayers: 10,
        theme: "默认主题"
    });
    return roomRef.id;
};

export const joinRoom = async (roomId, playerData) => {
    try {
        const roomRef = doc(db, "rooms", roomId);
        
        // 先检查房间是否存在
        const roomDoc = await getDoc(roomRef);
        if (!roomDoc.exists()) {
            throw new Error("房间不存在");
        }
        
        // 检查玩家是否已经在房间中
        const playersRef = collection(roomRef, "players");
        const playerQuery = query(playersRef, where("uid", "==", playerData.uid));
        const playerSnapshot = await getDocs(playerQuery);
        
        // 如果玩家已经存在，直接返回
        if (!playerSnapshot.empty) {
            console.log("玩家已经在房间中，不重复加入", playerData.name);
            return playerSnapshot.docs[0].id;
        }
        
        // 确保玩家名称存在
        const playerName = playerData.name || auth.currentUser.displayName || localStorage.getItem('playerName') || '未知玩家';
        console.log("玩家加入房间，使用名称:", playerName);
        
        // 如果玩家不存在，添加新玩家
        const playerRef = doc(collection(roomRef, "players"));
        await setDoc(playerRef, {
            ...playerData,
            name: playerName, // 确保设置name字段
            joinedAt: serverTimestamp(),
            role: "member", // 初始角色，游戏开始时可能改变
            isReady: false, // 初始未准备状态
            isSuperAdmin: isSuperAdmin(auth.currentUser) // 添加超级管理员标记
        });
        
        // 更新房间玩家数量
        await updateDoc(roomRef, {
            playerCount: increment(1)
        });
        
        console.log("成功加入房间", playerName);
        return playerRef.id;
    } catch (error) {
        console.error("加入房间失败:", error);
        throw error;
    }
};

export const getRoom = async (roomId) => {
    const roomRef = doc(db, "rooms", roomId);
    const roomDoc = await getDoc(roomRef);
    return roomDoc.exists() ? roomDoc.data() : null;
};

export const listenToRoom = (roomId, callback) => {
    const roomRef = doc(db, "rooms", roomId);
    return onSnapshot(roomRef, (doc) => {
        if (doc.exists()) {
            callback(doc.data());
        }
    });
};

// 假名列表
const FAKE_NAMES = [
    '白神经', '观察者', '思考者', '探索者', '守护者',
    '预言家', '诗人', '画家', '音乐家', '作家',
    '科学家', '哲学家', '历史学家', '考古学家', '天文学家'
];

// 生成随机假名
const generateFakeName = () => {
    return FAKE_NAMES[Math.floor(Math.random() * FAKE_NAMES.length)];
};

// 发言冷却时间（毫秒）
const MESSAGE_COOLDOWN = 2000;

// 消息相关操作
export const sendMessage = async (roomId, messageData) => {
    const messageRef = doc(collection(db, "rooms", roomId, "messages"));
    
    // 获取房间信息
    const roomRef = doc(db, "rooms", roomId);
    const roomDoc = await getDoc(roomRef);
    const roomData = roomDoc.data();
    
    // 检查是否是局外人的消息
    const playerRef = doc(db, "rooms", roomId, "players", messageData.senderId);
    const playerDoc = await getDoc(playerRef);
    const playerData = playerDoc.data();
    
    if (!playerData) {
        throw new Error('无法获取玩家信息');
    }
    
    // 检查发言冷却
    const lastMessageTime = playerData.lastMessageTime || 0;
    const now = Date.now();
    if (now - lastMessageTime < MESSAGE_COOLDOWN) {
        throw new Error('发言太频繁，请稍后再试');
    }
    
    // 根据游戏状态决定使用真实名字还是假名
    let displayName;
    if (roomData.status === "playing") {
        // 游戏开始后使用假名
        if (!playerData.fakeName) {
            throw new Error('玩家未获得假名，请等待游戏开始');
        }
        displayName = playerData.fakeName;
    } else {
        // 游戏未开始时优先用messageData.displayName
        displayName = messageData.displayName || '未知玩家';
        console.log("游戏未开始，使用传入的玩家名称:", displayName);
    }
    
    if (playerData.role === 'outsider' && roomData.status === "playing") {
        // 检查局外人的发言次数
        if (!playerData.remainingMessages || playerData.remainingMessages <= 0) {
            throw new Error('局外人的发言次数已用完');
        }
        
        // 减少局外人的剩余发言次数
        await updateDoc(playerRef, {
            remainingMessages: increment(-1),
            lastMessageTime: now
        });
        
        // 为局外人的消息生成特殊标记
        messageData.isOutsider = true;
    }
    
    // 更新最后发言时间
    await updateDoc(playerRef, {
        lastMessageTime: now
    });
    
    // 移除真实发送者信息
    delete messageData.sender;
    
    // 确保所有必要字段都存在
    const messageToSave = {
        content: messageData.content,
        senderId: messageData.senderId,
        displayName: displayName,
        isOutsider: messageData.isOutsider || false,
        timestamp: serverTimestamp()
    };
    
    await setDoc(messageRef, messageToSave);
};

export const listenToMessages = (roomId, callback) => {
    const messagesRef = collection(db, "rooms", roomId, "messages");
    const q = query(messagesRef, orderBy("timestamp", "asc"));
    return onSnapshot(q, (snapshot) => {
        const messages = [];
        snapshot.forEach((doc) => {
            messages.push({ id: doc.id, ...doc.data() });
        });
        callback(messages);
    });
};

// 投票相关操作
export const submitVote = async (roomId, voteData) => {
    const voteRef = doc(collection(db, "rooms", roomId, "votes"));
    await setDoc(voteRef, {
        ...voteData,
        timestamp: serverTimestamp()
    });
};

export const getVotes = async (roomId) => {
    const votesRef = collection(db, "rooms", roomId, "votes");
    const q = query(votesRef);
    const snapshot = await getDocs(q);
    const votes = [];
    snapshot.forEach((doc) => {
        votes.push({ id: doc.id, ...doc.data() });
    });
    return votes;
};

// 局外人特殊能力
export const OUTSIDER_ABILITIES = {
    CONFUSE: 'confuse',    // 混淆：可以改变一名玩家的投票
    DECEIVE: 'deceive',    // 欺骗：可以发送一条匿名消息
    HIDE: 'hide'          // 隐藏：可以隐藏自己的身份一段时间
};

// 使用局外人能力
export const useOutsiderAbility = async (roomId, playerId, abilityType, targetData) => {
    const roomRef = doc(db, "rooms", roomId);
    const playerRef = doc(roomRef, "players", playerId);
    
    try {
        const playerDoc = await getDoc(playerRef);
        if (!playerDoc.exists() || playerDoc.data().role !== 'outsider') {
            throw new Error('只有局外人才能使用特殊能力');
        }

        const abilityRef = doc(collection(roomRef, "abilities"));
        await setDoc(abilityRef, {
            type: abilityType,
            usedBy: playerId,
            targetData: targetData,
            timestamp: serverTimestamp(),
            used: false
        });

        return true;
    } catch (error) {
        console.error('使用能力失败:', error);
        throw error;
    }
};

// 获取局外人能力使用记录
export const getOutsiderAbilities = async (roomId) => {
    const abilitiesRef = collection(db, "rooms", roomId, "abilities");
    const q = query(abilitiesRef, orderBy("timestamp", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// 更新玩家准备状态
export const updatePlayerReady = async (roomId, playerId, isReady) => {
    const playerRef = doc(db, "rooms", roomId, "players", playerId);
    await updateDoc(playerRef, {
        isReady: isReady
    });
};

// 检查是否所有玩家都已准备
export const checkAllPlayersReady = async (roomId) => {
    const playersRef = collection(db, "rooms", roomId, "players");
    const playersSnapshot = await getDocs(playersRef);
    
    let allReady = true;
    let playerCount = 0;
    
    playersSnapshot.forEach((doc) => {
        const playerData = doc.data();
        if (!playerData.isReady) {
            allReady = false;
        }
        playerCount++;
    });
    
    return allReady && playerCount >= 3; // 至少需要3名玩家
};

// 游戏状态管理
export const startGame = async (roomId) => {
    const roomRef = doc(db, "rooms", roomId);
    const playersRef = collection(roomRef, "players");
    const playersSnapshot = await getDocs(playersRef);
    
    // 检查是否所有玩家都已准备
    const allReady = await checkAllPlayersReady(roomId);
    if (!allReady) {
        throw new Error('不是所有玩家都已准备就绪');
    }
    
    // 随机选择一名局外人
    const players = [];
    playersSnapshot.forEach((doc) => {
        players.push({ id: doc.id, ...doc.data() });
    });
    
    const outsiderIndex = Math.floor(Math.random() * players.length);
    
    // 更新所有玩家角色和分配能力
    const batch = writeBatch(db);
    players.forEach((player, index) => {
        const playerRef = doc(playersRef, player.id);
        if (index === outsiderIndex) {
            // 为局外人设置5次发言机会和固定假名
            batch.update(playerRef, {
                role: "outsider",
                isReady: true,
                remainingMessages: 5,
                fakeName: `神秘人${Math.floor(Math.random() * 1000)}` // 局外人使用特殊假名
            });
        } else {
            // 为普通玩家分配固定假名
            batch.update(playerRef, {
                role: "member",
                isReady: true,
                fakeName: generateFakeName() // 分配随机假名
            });
        }
    });
    
    // 更新房间状态
    batch.update(roomRef, {
        status: "playing",
        phase: "chat",
        startTime: serverTimestamp(),
        phaseStartTime: new Date().getTime()
    });
    
    await batch.commit();
};

export const endGame = async (roomId) => {
    const roomRef = doc(db, "rooms", roomId);
    await updateDoc(roomRef, {
        status: "ended",
        endTime: serverTimestamp()
    });
};

// 导出Firebase实例
export { db, auth }; 