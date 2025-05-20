export const showTutorial = () => {
    const tutorialHTML = `
        <div class="tutorial-modal">
            <div class="tutorial-content">
                <h2>局外人游戏教程</h2>
                
                <div class="tutorial-steps">
                    <div class="tutorial-step">
                        <h3>游戏概述</h3>
                        <p>局外人是一个充满推理和策略的社交游戏。在游戏中，所有玩家都会获得一个随机假名，而其中一名玩家会被选为"局外人"。</p>
                    </div>

                    <div class="tutorial-step">
                        <h3>游戏流程</h3>
                        <ol>
                            <li>创建或加入房间</li>
                            <li>等待房主开始游戏</li>
                            <li>系统随机选择一名局外人</li>
                            <li>进入聊天阶段，玩家们开始讨论</li>
                            <li>进入投票阶段，选出可疑的局外人</li>
                            <li>公布游戏结果</li>
                        </ol>
                    </div>

                    <div class="tutorial-step">
                        <h3>特殊机制</h3>
                        <h4>匿名聊天系统</h4>
                        <ul>
                            <li>游戏开始后，每个玩家会获得一个固定的假名</li>
                            <li>局外人会获得特殊的"神秘人"假名</li>
                            <li>发言有2秒冷却时间</li>
                            <li>通过发言内容和风格来识别其他玩家</li>
                        </ul>

                        <h4>局外人特殊规则</h4>
                        <ul>
                            <li>局外人只有5次发言机会</li>
                            <li>发言时显示为"神秘人+随机数字"</li>
                            <li>发言次数用完后无法继续发言</li>
                            <li>需要谨慎使用有限的发言机会</li>
                        </ul>
                    </div>

                    <div class="tutorial-step">
                        <h3>游戏目标</h3>
                        <p><strong>好人阵营：</strong>通过讨论找出局外人，并在投票阶段将其投出。</p>
                        <p><strong>局外人：</strong>隐藏身份，误导其他玩家，避免被投出。</p>
                    </div>

                    <div class="tutorial-step">
                        <h3>游戏技巧</h3>
                        <ul>
                            <li>注意观察每个假名的发言风格和内容</li>
                            <li>局外人要合理分配发言次数</li>
                            <li>好人要仔细分析每个发言的可疑之处</li>
                            <li>通过发言频率和时机来推测身份</li>
                            <li>注意发言冷却时间，避免暴露身份</li>
                        </ul>
                    </div>

                    <div class="tutorial-step">
                        <h3>注意事项</h3>
                        <ul>
                            <li>请遵守游戏规则，不要透露自己的真实身份</li>
                            <li>发言时注意文明用语</li>
                            <li>不要使用外挂或作弊工具</li>
                            <li>保持游戏环境的友好氛围</li>
                        </ul>
                    </div>
                </div>

                <div class="tutorial-buttons">
                    <button class="tutorial-btn" onclick="this.closest('.tutorial-modal').remove()">开始游戏</button>
                    <button class="tutorial-btn secondary" onclick="this.closest('.tutorial-modal').remove(); localStorage.setItem('skipTutorial', 'true')">不再显示</button>
                </div>
            </div>
        </div>
    `;

    // 检查是否跳过教程
    if (!localStorage.getItem('skipTutorial')) {
        document.body.insertAdjacentHTML('beforeend', tutorialHTML);
    }
};

// 检查是否需要显示教程
export const checkTutorial = () => {
    const tutorialShown = localStorage.getItem('tutorialShown');
    if (!tutorialShown) {
        showTutorial();
    }
}; 