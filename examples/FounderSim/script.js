// 游戏主对象，管理所有游戏状态和逻辑
const Game = {
    // 游戏数据
    data: null,
    
    // 玩家状态
    player: {
        name: '',
        gender: '',
        age: 22,
        money: 10000,
        education: '',
        school: '',
        schoolLevel: 0,
        degreeLevel: 0,
        career: '待业',
        graduateStartTurn: 0, // 开始读研究生的回合数
        attributes: {
            energy: 0,
            intelligence: 0,
            communication: 0,
            luck: 0,
            ideal: 0
        },
        workYears: 0, // 工作年限
        currentJob: null, // 当前工作信息
        jobLevel: 1, // 职级（1=初级，2=中级，3=高级，4=资深）
        workActionUsed: false, // 本回合是否已使用工作行动
        graduateActionUsed: false, // 本回合是否已使用研究生行动
        currentMajor: null, // 当前专业信息
        startup: null, // 创业公司信息
        // 研究生系统
        graduate: null, // 研究生信息（null表示未在读）
        // 生活标准
        housingStandard: 'simple', // 租房标准：simple/normal/luxury
        foodStandard: 'simple', // 饮食标准：simple/normal/luxury
        socialStandard: 'simple', // 社交标准：simple/normal/luxury
        // 工作系统扩展
        skills: {
            technical: 0,      // 技术技能（0-100）
            management: 0,     // 管理技能（0-100）
            sales: 0,         // 销售技能（0-100）
            communication: 0  // 沟通技能（0-100）
        },
        skillPoints: 0,        // 技能点（通过工作积累）
        // 多维度工作表现系统
        workPerformance: {
            quality: 50,        // 工作质量（0-100）
            efficiency: 50,     // 工作效率（0-100）
            teamwork: 50,      // 团队协作（0-100）
            initiative: 50,    // 主动性（0-100）
            overall: 50        // 综合评分（加权平均）
        },
        workMonths: 0,        // 当前工作月数
        totalWorkMonths: 0,   // 总工作月数
        networkValue: 0,      // 人脉值
        achievements: [],      // 工作成就列表
        sideJob: null,        // 副业信息
        // 工作历史（用于计算稳定性）
        workHistory: {
            recentPerformance: [], // 最近6个月的工作表现记录
            lastPromotionMonth: 0,  // 上次晋升的月份
            lastJobChangeMonth: 0,  // 上次跳槽的月份
            lastSalaryIncreaseMonth: 0, // 上次薪资增长的月份
            lastQuarterlyBonusMonth: 0  // 上次季度奖金的月份
        }
    },
    
    // 游戏状态
    currentTurn: 1,
    gameState: 'character-creation', // character-creation, playing, event
    isNextTurnExecuting: false, // 防止重复执行nextTurn
    nextTurnDelegationBound: false, // 防止事件委托被多次绑定
    
    // 招聘系统状态
    currentRecruitmentChannel: 'job_board', // 当前选择的招聘渠道
    currentCandidates: [], // 当前候选人列表
    interviewingCandidate: null, // 正在面试的候选人
    
    // 虚拟货币系统
    currency: {
        diamonds: 0,
        loadFromStorage() {
            const stored = localStorage.getItem('founderSim_diamonds');
            this.diamonds = stored ? parseInt(stored, 10) : 0;
            return this.diamonds;
        },
        saveToStorage() {
            localStorage.setItem('founderSim_diamonds', this.diamonds.toString());
        },
        add(amount) {
            this.diamonds += amount;
            this.saveToStorage();
            Game.updateCurrencyDisplay();
        },
        deduct(amount) {
            if (this.diamonds >= amount) {
                this.diamonds -= amount;
                this.saveToStorage();
                Game.updateCurrencyDisplay();
                return true;
            }
            return false;
        }
    },
    
    // 解锁状态系统
    unlocks: {
        degrees: [1],      // 默认解锁学士
        schools: [1, 2],    // 默认解锁普通本科和211
        rerollCount: 3,     // 免费重roll次数
        unlimitedReroll: false, // 是否购买无限重roll
        purchasedExtraPoints: 0, // 本次创建购买的额外点数
        initialMoneyBonus: 0,   // 购买的初始资金加成
        loadFromStorage() {
            const storedDegrees = localStorage.getItem('founderSim_unlocked_degrees');
            const storedSchools = localStorage.getItem('founderSim_unlocked_schools');
            if (storedDegrees) {
                this.degrees = JSON.parse(storedDegrees);
            }
            if (storedSchools) {
                this.schools = JSON.parse(storedSchools);
            }
        },
        saveToStorage() {
            localStorage.setItem('founderSim_unlocked_degrees', JSON.stringify(this.degrees));
            localStorage.setItem('founderSim_unlocked_schools', JSON.stringify(this.schools));
        },
        unlockDegree(level) {
            if (!this.degrees.includes(level)) {
                this.degrees.push(level);
                this.degrees.sort((a, b) => a - b);
                this.saveToStorage();
            }
        },
        unlockSchool(level) {
            if (!this.schools.includes(level)) {
                this.schools.push(level);
                this.schools.sort((a, b) => a - b);
                this.saveToStorage();
            }
        },
        isDegreeUnlocked(level) {
            return this.degrees.includes(level);
        },
        isSchoolUnlocked(level) {
            return this.schools.includes(level);
        },
        resetSession() {
            // 重置本次创建相关的临时状态
            this.rerollCount = 3;
            this.unlimitedReroll = false;
            this.purchasedExtraPoints = 0;
            this.initialMoneyBonus = 0;
        }
    },
    
    /**
     * 初始化游戏
     */
    async init() {
        // 加载游戏数据
        await this.loadData();
        
        // 绑定事件监听器
        this.bindEvents();
        
        // 初始化角色创建界面（需要在数据加载后）
        this.initCharacterCreation();
        
        // 初始化候选人详情模态框
        this.initCandidateDetailModal();
    },
    
    /**
     * 从JSON文件加载游戏数据
     */
    async loadData() {
        try {
            const response = await fetch('data.json');
            this.data = await response.json();
            console.log('游戏数据加载成功');
        } catch (error) {
            console.error('加载游戏数据失败:', error);
            alert('加载游戏数据失败，请刷新页面重试');
        }
    },
    
    /**
     * 绑定所有事件监听器
     */
    bindEvents() {
        // 角色创建表单提交
        document.getElementById('character-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createCharacter();
        });
        
        // 选择按钮（找工作/读研究生/创业）
        document.querySelectorAll('[data-choice]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const choice = e.target.dataset.choice;
                this.handleChoice(choice);
            });
        });
        
        // 开销标准选择变化
        document.getElementById('housing-standard').addEventListener('change', () => {
            this.updateHousingStandard();
        });
        document.getElementById('food-standard').addEventListener('change', () => {
            this.updateFoodStandard();
        });
        document.getElementById('social-standard').addEventListener('change', () => {
            this.updateSocialStandard();
        });
        
        // 返回按钮
        document.getElementById('back-from-work').addEventListener('click', () => {
            this.showChoicePanel(['work', 'graduate', 'startup']);
        });
        document.getElementById('back-from-graduate').addEventListener('click', () => {
            this.showChoicePanel(['work', 'graduate', 'startup']);
        });
        document.getElementById('back-from-industry').addEventListener('click', () => {
            this.showChoicePanel(['work', 'graduate', 'startup']);
        });
        document.getElementById('back-from-funding').addEventListener('click', () => {
            this.showPanel('startup-panel');
        });
        document.getElementById('back-from-hire').addEventListener('click', () => {
            this.showPanel('startup-management');
        });
        
        // 筛选按钮
        const applyFilterBtn = document.getElementById('apply-filter-btn');
        if (applyFilterBtn) {
            applyFilterBtn.addEventListener('click', () => {
                this.updateCandidateList();
            });
        }
        
        // 筛选条件变化时自动更新（可选，也可以手动点击应用筛选）
        const filterInputs = ['filter-position', 'filter-ability-min', 'filter-ability-max', 
                              'filter-salary-min', 'filter-salary-max', 'filter-experience', 'filter-degree'];
        filterInputs.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('change', () => {
                    // 延迟更新，避免频繁触发
                    clearTimeout(this.filterUpdateTimeout);
                    this.filterUpdateTimeout = setTimeout(() => {
                        this.updateCandidateList();
                    }, 300);
                });
            }
        });
        
        // 刷新候选人按钮
        const refreshCandidatesBtn = document.getElementById('refresh-candidates-btn');
        if (refreshCandidatesBtn) {
            refreshCandidatesBtn.addEventListener('click', () => {
                this.refreshCandidates();
            });
        }
        document.getElementById('back-from-project-create').addEventListener('click', () => {
            this.showPanel('startup-management');
        });
        
        // 融资选择
        document.querySelectorAll('[data-funding]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const fundingType = e.target.dataset.funding;
                this.handleFundingChoice(fundingType);
            });
        });
        
        // 存款确认
        document.getElementById('confirm-deposit').addEventListener('click', () => {
            this.confirmDeposit();
        });
        
        // 工作管理按钮
        // 工作行动按钮 - 使用多种方式确保事件绑定成功
        // 方法1: 直接绑定（如果元素存在）
        const bindWorkButtons = () => {
            const workHardBtn = document.getElementById('work-hard-btn');
            const workSlackBtn = document.getElementById('work-slack-btn');
            const workLearnBtn = document.getElementById('work-learn-btn');
            const workQuitBtn = document.getElementById('work-quit-btn');
            
            if (workHardBtn) {
                workHardBtn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.workHard();
                };
            }
            if (workSlackBtn) {
                workSlackBtn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.workSlack();
                };
            }
            if (workLearnBtn) {
                workLearnBtn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.workLearn();
                };
            }
            if (workQuitBtn) {
                workQuitBtn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.workQuit();
                };
            }
        };
        
        // 立即尝试绑定
        bindWorkButtons();
        
        // 研究生管理按钮
        const bindGraduateButtons = () => {
            const studyBtn = document.getElementById('graduate-study-btn');
            const researchBtn = document.getElementById('graduate-research-btn');
            const paperBtn = document.getElementById('graduate-paper-btn');
            const experimentBtn = document.getElementById('graduate-experiment-btn');
            const conferenceBtn = document.getElementById('graduate-conference-btn');
            const competitionBtn = document.getElementById('graduate-competition-btn');
            const internshipBtn = document.getElementById('graduate-internship-btn');
            const socializeBtn = document.getElementById('graduate-socialize-btn');
            const scholarshipBtn = document.getElementById('graduate-scholarship-btn');
            const earlyBtn = document.getElementById('graduate-early-btn');
            
            if (studyBtn) studyBtn.onclick = () => this.studyHard();
            if (researchBtn) researchBtn.onclick = () => this.doResearch();
            if (paperBtn) paperBtn.onclick = () => this.writePaper();
            if (experimentBtn) experimentBtn.onclick = () => this.doExperiment();
            if (conferenceBtn) conferenceBtn.onclick = () => this.attendConference();
            if (competitionBtn) competitionBtn.onclick = () => this.joinCompetition();
            if (internshipBtn) internshipBtn.onclick = () => this.findInternship();
            if (socializeBtn) socializeBtn.onclick = () => this.socialize();
            if (scholarshipBtn) scholarshipBtn.onclick = () => this.applyScholarship();
            if (earlyBtn) earlyBtn.onclick = () => this.graduateEarly();
        };
        
        bindGraduateButtons();
        
        // 方法2: 使用事件委托作为备用
        document.addEventListener('click', (e) => {
            const target = e.target;
            
            // 处理工作管理面板内的按钮
            if (target.closest('#work-management')) {
                // 检查是否是按钮且未被禁用
                if (target.tagName !== 'BUTTON' || target.disabled) {
                    return;
                }
                
                if (target.id === 'work-hard-btn') {
                    e.preventDefault();
                e.stopPropagation();
                this.workHard();
                } else if (target.id === 'work-slack-btn') {
                    e.preventDefault();
                    e.stopPropagation();
                    this.workSlack();
                } else if (target.id === 'work-learn-btn') {
                    e.preventDefault();
                e.stopPropagation();
                this.workLearn();
                } else if (target.id === 'work-quit-btn') {
                    e.preventDefault();
                    e.stopPropagation();
                    this.workQuit();
                }
                return;
            }
            
            // 处理研究生管理面板内的按钮
            if (target.closest('#graduate-management')) {
                // 检查是否是按钮且未被禁用
                if (target.tagName !== 'BUTTON' || target.disabled) {
                    return;
                }
                
                if (target.id === 'graduate-study-btn') {
                    e.preventDefault();
                    e.stopPropagation();
                    this.studyHard();
                } else if (target.id === 'graduate-research-btn') {
                    e.preventDefault();
                    e.stopPropagation();
                    this.doResearch();
                } else if (target.id === 'graduate-paper-btn') {
                    e.preventDefault();
                    e.stopPropagation();
                    this.writePaper();
                } else if (target.id === 'graduate-experiment-btn') {
                    e.preventDefault();
                    e.stopPropagation();
                    this.doExperiment();
                } else if (target.id === 'graduate-conference-btn') {
                    e.preventDefault();
                    e.stopPropagation();
                    this.attendConference();
                } else if (target.id === 'graduate-competition-btn') {
                    e.preventDefault();
                    e.stopPropagation();
                    this.joinCompetition();
                } else if (target.id === 'graduate-internship-btn') {
                    e.preventDefault();
                    e.stopPropagation();
                    this.findInternship();
                } else if (target.id === 'graduate-socialize-btn') {
                    e.preventDefault();
                    e.stopPropagation();
                    this.socialize();
                } else if (target.id === 'graduate-scholarship-btn') {
                    e.preventDefault();
                    e.stopPropagation();
                    this.applyScholarship();
                } else if (target.id === 'graduate-early-btn') {
                    e.preventDefault();
                    e.stopPropagation();
                    this.graduateEarly();
                }
            }
        });
        
        // 保存原始的updateWorkPanel方法
        const originalUpdateWorkPanel = this.updateWorkPanel.bind(this);
        
        // 重写updateWorkPanel，在更新后重新绑定按钮
        this.updateWorkPanel = function() {
            originalUpdateWorkPanel();
            setTimeout(bindWorkButtons, 50);
        };
        
        // 创业管理按钮
        document.getElementById('hire-employee-btn').addEventListener('click', () => {
            this.showHirePanel();
        });
        document.getElementById('create-project-btn').addEventListener('click', () => {
            this.showProjectCreatePanel();
        });
        
        // 申请贷款按钮
        document.getElementById('apply-loan-btn').addEventListener('click', () => {
            this.showLoanPanel();
        });
        
        // 继续融资按钮
        document.getElementById('apply-funding-btn').addEventListener('click', () => {
            this.showFundingPanel();
        });
        
        // 贷款申请相关按钮
        document.getElementById('confirm-loan-btn').addEventListener('click', () => {
            this.applyForLoan();
        });
        
        document.getElementById('cancel-loan-btn').addEventListener('click', () => {
            this.showPanel('startup-management');
        });
        
        // 贷款金额输入变化时更新预览
        document.getElementById('loan-amount-input').addEventListener('input', () => {
            this.updateLoanPreview();
        });
        
        document.getElementById('loan-months-select').addEventListener('change', () => {
            this.updateLoanPreview();
        });
        
        // 融资申请相关按钮
        document.getElementById('confirm-funding-btn').addEventListener('click', () => {
            this.applyForFunding();
        });
        
        document.getElementById('cancel-funding-btn').addEventListener('click', () => {
            this.showPanel('startup-management');
        });
        
        // 创业管理按钮（检查元素是否存在）
        const developProductBtn = document.getElementById('develop-product-btn');
        if (developProductBtn) {
            developProductBtn.addEventListener('click', () => {
                this.developProduct();
            });
        }
        const promoteSalesBtn = document.getElementById('promote-sales-btn');
        if (promoteSalesBtn) {
            promoteSalesBtn.addEventListener('click', () => {
                this.promoteSales();
            });
        }
        document.getElementById('learn-summary-btn').addEventListener('click', () => {
            this.learnSummary();
        });
        
        // 事件弹窗关闭
        document.getElementById('event-close').addEventListener('click', () => {
            this.closeEventModal();
        });
        
        // 下一回合按钮 - 使用多种方式确保绑定成功
        const bindNextTurnBtn = () => {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/d420deeb-fad3-4d2f-a745-655aa7abb486',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'script.js:243',message:'bindNextTurnBtn called',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
            // #endregion
            const nextTurnBtn = document.getElementById('next-turn-btn');
            if (nextTurnBtn) {
                // 移除旧的事件监听器（如果存在）
                const newBtn = nextTurnBtn.cloneNode(true);
                nextTurnBtn.parentNode.replaceChild(newBtn, nextTurnBtn);
                
                // 方法1: addEventListener（只绑定一次）
                if (!newBtn.hasAttribute('data-listener-bound')) {
                    newBtn.setAttribute('data-listener-bound', 'true');
                    newBtn.addEventListener('click', (e) => {
                        // #region agent log
                        fetch('http://127.0.0.1:7242/ingest/d420deeb-fad3-4d2f-a745-655aa7abb486',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'script.js:252',message:'addEventListener triggered',data:{eventPhase:e.eventPhase},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
                        // #endregion
                        e.preventDefault();
                        e.stopImmediatePropagation(); // 使用stopImmediatePropagation阻止同一元素上的其他监听器
                        console.log('nextTurn called via addEventListener');
                        try {
                            this.nextTurn();
                        } catch (error) {
                            console.error('Error in nextTurn:', error);
                            alert('发生错误：' + error.message);
                        }
                    });
                }
                
                // 移除onclick属性绑定，避免与addEventListener重复触发
                // onclick属性已从HTML中移除，只使用addEventListener
            } else {
                console.error('next-turn-btn not found!');
            }
        };
        
        // 立即绑定
        bindNextTurnBtn();
        
        // 方法3: 使用事件委托作为备用（仅在addEventListener失败时使用）
        // 注意：由于addEventListener已经处理了点击事件并调用了stopPropagation，
        // 事件委托通常不会触发。但为了安全，我们检查事件是否已经被处理
        if (!this.nextTurnDelegationBound) {
            this.nextTurnDelegationBound = true;
            document.addEventListener('click', (e) => {
                if (e.target && e.target.id === 'next-turn-btn' && !e.defaultPrevented) {
                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/d420deeb-fad3-4d2f-a745-655aa7abb486',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'script.js:284',message:'delegation triggered',data:{defaultPrevented:e.defaultPrevented},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
                    // #endregion
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('nextTurn called via delegation (fallback)');
                    try {
                        this.nextTurn();
                    } catch (error) {
                        console.error('Error in nextTurn:', error);
                        alert('发生错误：' + error.message);
                    }
                }
            });
        }
    },
    
    // 角色创建系统状态
    characterCreation: {
        baseAttributes: {
            energy: 0,
            intelligence: 0,
            communication: 0,
            luck: 0,
            ideal: 0
        },
        allocatedPoints: {
            energy: 0,
            intelligence: 0,
            communication: 0,
            luck: 0,
            ideal: 0
        },
        extraPoints: 20, // 基础额外点数
        remainingPoints: 20
    },
    
    /**
     * 初始化角色创建界面
     */
    initCharacterCreation() {
        // 填充学校和学历下拉框
        const schoolSelect = document.getElementById('char-school');
        const degreeSelect = document.getElementById('char-degree');
        
        if (schoolSelect && this.data) {
            schoolSelect.innerHTML = '<option value="">请选择</option>';
            this.data.universities.forEach(uni => {
                const option = document.createElement('option');
                option.value = uni.level;
                option.textContent = uni.name;
                schoolSelect.appendChild(option);
            });
        }
        
        if (degreeSelect && this.data) {
            degreeSelect.innerHTML = '<option value="">请选择</option>';
            // 初始只能选择学士
            const bachelor = this.data.degrees[0];
            const option = document.createElement('option');
            option.value = bachelor.level;
            option.textContent = bachelor.name;
            degreeSelect.appendChild(option);
        }
        
        // 绑定学校选择变化事件（更新额外点数）
        if (schoolSelect) {
            schoolSelect.addEventListener('change', () => {
                this.updateExtraPointsFromSchool();
                this.updateAttributeDisplay();
            });
        }
        
        // 绑定重roll按钮
        const rerollBtn = document.getElementById('reroll-attributes-btn');
        if (rerollBtn) {
            rerollBtn.addEventListener('click', () => {
                this.rollBaseAttributes();
            });
        }
        
        // 初始化属性显示
        this.rollBaseAttributes();
        this.renderAttributeCards();
        
        // 初始化货币系统
        this.initCurrencySystem();
        
        // 初始化解锁按钮
        this.updateUnlockButtons();
        
        // 更新学校和学历选项
        this.updateSchoolOptions();
        this.updateDegreeOptions();
        
        // 绑定付费功能按钮
        this.bindPremiumButtons();
        
        // 重置本次创建的状态
        this.unlocks.resetSession();
        this.updateRerollDisplay();
    },
    
    /**
     * 初始化货币系统
     */
    initCurrencySystem() {
        this.currency.loadFromStorage();
        this.unlocks.loadFromStorage();
        this.updateCurrencyDisplay();
        
        // 绑定充值按钮
        const rechargeBtn = document.getElementById('recharge-btn');
        if (rechargeBtn) {
            rechargeBtn.addEventListener('click', () => {
                this.showRechargeModal();
            });
        }
        
        // 绑定关闭充值弹窗
        const closeModal = document.getElementById('close-recharge-modal');
        if (closeModal) {
            closeModal.addEventListener('click', () => {
                document.getElementById('recharge-modal').classList.add('hidden');
            });
        }
        
        // 点击弹窗外部关闭
        const modal = document.getElementById('recharge-modal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.add('hidden');
                }
            });
        }
    },
    
    /**
     * 更新钻石余额显示
     */
    updateCurrencyDisplay() {
        const balanceEl = document.getElementById('diamonds-balance');
        if (balanceEl) {
            balanceEl.textContent = this.currency.diamonds;
        }
    },
    
    /**
     * 显示充值弹窗
     */
    showRechargeModal() {
        const modal = document.getElementById('recharge-modal');
        const packagesContainer = document.getElementById('recharge-packages');
        
        if (!modal || !packagesContainer) return;
        
        // 充值套餐配置
        const packages = [
            { diamonds: 10, price: 1, bonus: 0 },
            { diamonds: 100, price: 8, bonus: 20 },
            { diamonds: 500, price: 35, bonus: 150 },
            { diamonds: 1000, price: 60, bonus: 400 }
        ];
        
        packagesContainer.innerHTML = '';
        
        packages.forEach(pkg => {
            const card = document.createElement('div');
            card.className = 'recharge-package-card';
            card.style.cssText = 'border: 2px solid #667eea; border-radius: 10px; padding: 15px; text-align: center; cursor: pointer; transition: all 0.3s;';
            card.innerHTML = `
                <div style="font-size: 24px; font-weight: bold; color: #667eea; margin-bottom: 10px;">
                    💎 ${pkg.diamonds}${pkg.bonus > 0 ? ` + ${pkg.bonus}` : ''}
                </div>
                <div style="font-size: 18px; color: #333; margin-bottom: 5px;">
                    积分${pkg.price}
                </div>
                ${pkg.bonus > 0 ? `<div style="font-size: 12px; color: #28a745;">赠送 ${pkg.bonus} 钻石</div>` : ''}
            `;
            
            card.addEventListener('click', () => {
                // 模拟充值（实际应对接支付接口）
                this.currency.add(pkg.diamonds + pkg.bonus);
                alert(`充值成功！获得 ${pkg.diamonds + pkg.bonus} 钻石`);
                modal.classList.add('hidden');
            });
            
            card.addEventListener('mouseenter', () => {
                card.style.background = '#f0f0f0';
                card.style.transform = 'translateY(-2px)';
            });
            
            card.addEventListener('mouseleave', () => {
                card.style.background = '';
                card.style.transform = '';
            });
            
            packagesContainer.appendChild(card);
        });
        
        modal.classList.remove('hidden');
    },
    
    /**
     * 更新解锁按钮
     */
    updateUnlockButtons() {
        // 学校解锁按钮
        const schoolButtonsContainer = document.getElementById('school-unlock-buttons');
        if (schoolButtonsContainer) {
            schoolButtonsContainer.innerHTML = '';
            
            // 985大学解锁按钮
            if (!this.unlocks.isSchoolUnlocked(3)) {
                const btn985 = document.createElement('button');
                btn985.type = 'button';
                btn985.className = 'btn btn-small unlock-btn locked';
                btn985.textContent = '解锁985 (80💎)';
                btn985.addEventListener('click', () => {
                    this.purchaseUnlock('school', 3, 80);
                });
                schoolButtonsContainer.appendChild(btn985);
            }
            
            // 藤校解锁按钮
            if (!this.unlocks.isSchoolUnlocked(4)) {
                const btnIvy = document.createElement('button');
                btnIvy.type = 'button';
                btnIvy.className = 'btn btn-small unlock-btn locked';
                btnIvy.textContent = '解锁藤校 (150💎)';
                btnIvy.addEventListener('click', () => {
                    if (this.unlocks.isSchoolUnlocked(3)) {
                        this.purchaseUnlock('school', 4, 150);
                    } else {
                        alert('请先解锁985大学');
                    }
                });
                schoolButtonsContainer.appendChild(btnIvy);
            }
        }
        
        // 学历解锁按钮
        const degreeButtonsContainer = document.getElementById('degree-unlock-buttons');
        if (degreeButtonsContainer) {
            degreeButtonsContainer.innerHTML = '';
            
            // 硕士解锁按钮
            if (!this.unlocks.isDegreeUnlocked(2)) {
                const btnMaster = document.createElement('button');
                btnMaster.type = 'button';
                btnMaster.className = 'btn btn-small unlock-btn locked';
                btnMaster.textContent = '解锁硕士 (50💎)';
                btnMaster.addEventListener('click', () => {
                    this.purchaseUnlock('degree', 2, 50);
                });
                degreeButtonsContainer.appendChild(btnMaster);
            }
            
            // 博士解锁按钮
            if (!this.unlocks.isDegreeUnlocked(3)) {
                const btnPhd = document.createElement('button');
                btnPhd.type = 'button';
                btnPhd.className = 'btn btn-small unlock-btn locked';
                btnPhd.textContent = '解锁博士 (100💎)';
                btnPhd.addEventListener('click', () => {
                    if (this.unlocks.isDegreeUnlocked(2)) {
                        this.purchaseUnlock('degree', 3, 100);
                    } else {
                        alert('请先解锁硕士');
                    }
                });
                degreeButtonsContainer.appendChild(btnPhd);
            }
        }
    },
    
    /**
     * 购买解锁
     */
    purchaseUnlock(type, level, cost) {
        if (this.currency.diamonds < cost) {
            alert(`钻石不足！需要 ${cost} 钻石，当前余额 ${this.currency.diamonds} 钻石`);
            this.showRechargeModal();
            return;
        }
        
        const confirmMsg = type === 'school' 
            ? `确定要花费 ${cost} 钻石解锁${level === 3 ? '985大学' : '藤校'}吗？`
            : `确定要花费 ${cost} 钻石解锁${level === 2 ? '硕士' : '博士'}学历吗？`;
        
        if (!confirm(confirmMsg)) {
            return;
        }
        
        if (this.currency.deduct(cost)) {
            if (type === 'school') {
                this.unlocks.unlockSchool(level);
            } else {
                this.unlocks.unlockDegree(level);
            }
            
            alert('解锁成功！');
            this.updateUnlockButtons();
            this.updateSchoolOptions();
            this.updateDegreeOptions();
        }
    },
    
    /**
     * 更新学校选项
     */
    updateSchoolOptions() {
        const schoolSelect = document.getElementById('char-school');
        if (!schoolSelect || !this.data) return;
        
        schoolSelect.innerHTML = '<option value="">请选择</option>';
        
        this.data.universities.forEach(uni => {
            if (this.unlocks.isSchoolUnlocked(uni.level)) {
                const option = document.createElement('option');
                option.value = uni.level;
                option.textContent = uni.name;
                schoolSelect.appendChild(option);
            }
        });
    },
    
    /**
     * 更新学历选项
     */
    updateDegreeOptions() {
        const degreeSelect = document.getElementById('char-degree');
        if (!degreeSelect || !this.data) return;
        
        degreeSelect.innerHTML = '<option value="">请选择</option>';
        
        this.data.degrees.forEach(degree => {
            if (this.unlocks.isDegreeUnlocked(degree.level)) {
                const option = document.createElement('option');
                option.value = degree.level;
                option.textContent = degree.name;
                degreeSelect.appendChild(option);
            }
        });
    },
    
    /**
     * 绑定付费功能按钮
     */
    bindPremiumButtons() {
        // 购买无限重roll
        const unlimitedRerollBtn = document.getElementById('purchase-unlimited-reroll-btn');
        if (unlimitedRerollBtn) {
            unlimitedRerollBtn.addEventListener('click', () => {
                this.purchaseUnlimitedReroll(50);
            });
        }
        
        // 购买额外点数
        const extraPointsBtn = document.getElementById('purchase-extra-points-btn');
        if (extraPointsBtn) {
            extraPointsBtn.addEventListener('click', () => {
                this.showExtraPointsModal();
            });
        }
        
        // 属性预设模板
        document.querySelectorAll('.template-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const template = e.target.dataset.template;
                this.applyAttributeTemplate(template, 20);
            });
        });
        
        // 初始资金加成
        document.getElementById('purchase-money-5000')?.addEventListener('click', () => {
            this.purchaseInitialMoney(5000, 30);
        });
        document.getElementById('purchase-money-10000')?.addEventListener('click', () => {
            this.purchaseInitialMoney(10000, 50);
        });
        document.getElementById('purchase-money-20000')?.addEventListener('click', () => {
            this.purchaseInitialMoney(20000, 80);
        });
    },
    
    /**
     * 购买无限重roll
     */
    purchaseUnlimitedReroll(cost) {
        if (this.currency.diamonds < cost) {
            alert(`钻石不足！需要 ${cost} 钻石`);
            this.showRechargeModal();
            return;
        }
        
        if (!confirm(`确定要花费 ${cost} 钻石购买无限重roll吗？（本次创建有效）`)) {
            return;
        }
        
        if (this.currency.deduct(cost)) {
            this.unlocks.unlimitedReroll = true;
            this.updateRerollDisplay();
            alert('购买成功！现在可以无限次重roll了');
        }
    },
    
    /**
     * 显示额外点数购买弹窗
     */
    showExtraPointsModal() {
        const packages = [
            { points: 10, cost: 30 },
            { points: 20, cost: 50 },
            { points: 50, cost: 100 }
        ];
        
        let options = '请选择要购买的额外点数：\n';
        packages.forEach((pkg, index) => {
            options += `${index + 1}. ${pkg.points}点 - ${pkg.cost}💎\n`;
        });
        options += '0. 取消';
        
        const choice = prompt(options);
        const selected = parseInt(choice);
        
        if (selected >= 1 && selected <= packages.length) {
            const pkg = packages[selected - 1];
            this.purchaseExtraPoints(pkg.points, pkg.cost);
        }
    },
    
    /**
     * 购买额外属性点
     */
    purchaseExtraPoints(amount, cost) {
        if (this.currency.diamonds < cost) {
            alert(`钻石不足！需要 ${cost} 钻石`);
            this.showRechargeModal();
            return;
        }
        
        if (!confirm(`确定要花费 ${cost} 钻石购买 ${amount} 点额外属性点吗？`)) {
            return;
        }
        
        if (this.currency.deduct(cost)) {
            this.unlocks.purchasedExtraPoints += amount;
            this.characterCreation.extraPoints += amount;
            this.characterCreation.remainingPoints += amount;
            this.updateAttributeDisplay();
            alert(`购买成功！获得 ${amount} 点额外属性点`);
        }
    },
    
    /**
     * 应用属性预设模板
     */
    applyAttributeTemplate(templateName, cost) {
        if (this.currency.diamonds < cost) {
            alert(`钻石不足！需要 ${cost} 钻石`);
            this.showRechargeModal();
            return;
        }
        
        if (!confirm(`确定要花费 ${cost} 钻石应用"${templateName}"属性模板吗？`)) {
            return;
        }
        
        if (!this.currency.deduct(cost)) {
            return;
        }
        
        // 定义模板
        const templates = {
            tech: { intelligence: 40, energy: 30, communication: 10, luck: 10, ideal: 10 },
            social: { communication: 40, ideal: 30, intelligence: 10, energy: 10, luck: 10 },
            lucky: { luck: 40, communication: 30, intelligence: 10, energy: 10, ideal: 10 },
            balanced: { intelligence: 20, energy: 20, communication: 20, luck: 20, ideal: 20 }
        };
        
        const template = templates[templateName];
        if (!template) return;
        
        // 应用模板到基础属性
        Object.keys(template).forEach(attr => {
            this.characterCreation.baseAttributes[attr] = this.randomInt(30, 100) + template[attr];
            this.characterCreation.baseAttributes[attr] = Math.min(150, this.characterCreation.baseAttributes[attr]);
        });
        
        // 重置分配点数
        this.characterCreation.allocatedPoints = {
            energy: 0,
            intelligence: 0,
            communication: 0,
            luck: 0,
            ideal: 0
        };
        
        this.updateAttributeDisplay();
        alert('属性模板应用成功！');
    },
    
    /**
     * 购买初始资金加成
     */
    purchaseInitialMoney(amount, cost) {
        if (this.currency.diamonds < cost) {
            alert(`钻石不足！需要 ${cost} 钻石`);
            this.showRechargeModal();
            return;
        }
        
        if (!confirm(`确定要花费 ${cost} 钻石购买 +${amount.toLocaleString()}元 初始资金加成吗？`)) {
            return;
        }
        
        if (this.currency.deduct(cost)) {
            this.unlocks.initialMoneyBonus = amount;
            const display = document.getElementById('money-bonus-display');
            if (display) {
                display.textContent = `已购买：+${amount.toLocaleString()}元 初始资金`;
            }
            alert('购买成功！');
        }
    },
    
    /**
     * 更新重roll显示
     */
    updateRerollDisplay() {
        const rerollBtn = document.getElementById('reroll-attributes-btn');
        const countDisplay = document.getElementById('reroll-count-display');
        
        if (this.unlocks.unlimitedReroll) {
            if (countDisplay) countDisplay.textContent = '(无限)';
            if (rerollBtn) rerollBtn.style.background = 'linear-gradient(135deg, #ffd700 0%, #ffed4e 100%)';
        } else {
            if (countDisplay) countDisplay.textContent = `(剩余${this.unlocks.rerollCount}次)`;
            if (rerollBtn) rerollBtn.style.background = '';
        }
    },
    
    /**
     * 根据学校更新额外点数
     */
    updateExtraPointsFromSchool() {
        const schoolLevel = parseInt(document.getElementById('char-school').value) || 0;
        let schoolBonus = 0;
        
        if (schoolLevel >= 3) {
            schoolBonus = 5; // 985/藤校 +5点
        } else if (schoolLevel >= 2) {
            schoolBonus = 3; // 211 +3点
        }
        
        this.characterCreation.extraPoints = 20 + schoolBonus + this.unlocks.purchasedExtraPoints;
        this.characterCreation.remainingPoints = this.characterCreation.extraPoints - 
            Object.values(this.characterCreation.allocatedPoints).reduce((sum, val) => sum + val, 0);
        
        const remainingEl = document.getElementById('extra-points-remaining');
        if (remainingEl) {
            remainingEl.textContent = this.characterCreation.remainingPoints;
        }
    },
    
    /**
     * 随机生成基础属性
     */
    rollBaseAttributes() {
        // 检查重roll次数
        if (!this.unlocks.unlimitedReroll && this.unlocks.rerollCount <= 0) {
            alert('重roll次数已用完！可以花费50钻石购买无限重roll');
            return;
        }
        
        this.characterCreation.baseAttributes = {
            energy: this.randomInt(30, 100),
            intelligence: this.randomInt(30, 100),
            communication: this.randomInt(30, 100),
            luck: this.randomInt(30, 100),
            ideal: this.randomInt(30, 100)
        };
        
        // 重置已分配点数
        this.characterCreation.allocatedPoints = {
            energy: 0,
            intelligence: 0,
            communication: 0,
            luck: 0,
            ideal: 0
        };
        
        // 更新额外点数
        this.updateExtraPointsFromSchool();
        
        // 减少重roll次数（如果不是无限）
        if (!this.unlocks.unlimitedReroll) {
            this.unlocks.rerollCount--;
            this.updateRerollDisplay();
        }
        
        // 更新显示
        this.updateAttributeDisplay();
    },
    
    /**
     * 渲染属性卡片
     */
    renderAttributeCards() {
        const container = document.getElementById('attributes-container');
        if (!container) return;
        
        const attrNames = {
            energy: '精力',
            intelligence: '智商',
            communication: '沟通',
            luck: '气运',
            ideal: '理想'
        };
        
        container.innerHTML = '';
        
        Object.keys(attrNames).forEach(attrKey => {
            const card = document.createElement('div');
            card.className = 'attr-card';
            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <strong style="color: #667eea;">${attrNames[attrKey]}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 14px; margin-bottom: 8px;">
                    <span>基础值：<span class="attr-base-value" data-attr="${attrKey}">0</span></span>
                    <span>分配：<span class="attr-allocated-value" data-attr="${attrKey}">0</span></span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px;">
                    <button type="button" class="btn btn-small btn-attr-decrease" data-attr="${attrKey}" style="flex: 1;">-</button>
                    <span class="attr-final-value" data-attr="${attrKey}" style="font-weight: bold; color: #764ba2; flex: 1; text-align: center;">0</span>
                    <button type="button" class="btn btn-small btn-attr-increase" data-attr="${attrKey}" style="flex: 1;">+</button>
                </div>
            `;
            container.appendChild(card);
        });
        
        // 绑定增减按钮事件
        container.querySelectorAll('.btn-attr-increase').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const attr = e.target.dataset.attr;
                this.allocateAttributePoint(attr, 1);
            });
        });
        
        container.querySelectorAll('.btn-attr-decrease').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const attr = e.target.dataset.attr;
                this.allocateAttributePoint(attr, -1);
            });
        });
        
        // 更新显示
        this.updateAttributeDisplay();
    },
    
    /**
     * 分配属性点
     */
    allocateAttributePoint(attrName, delta) {
        if (delta > 0) {
            // 增加点数
            if (this.characterCreation.remainingPoints <= 0) {
                alert('额外点数已用完！');
                return;
            }
            this.characterCreation.allocatedPoints[attrName] += delta;
            this.characterCreation.remainingPoints -= delta;
        } else {
            // 减少点数
            if (this.characterCreation.allocatedPoints[attrName] <= 0) {
                return;
            }
            this.characterCreation.allocatedPoints[attrName] += delta;
            this.characterCreation.remainingPoints -= delta;
        }
        
        this.updateAttributeDisplay();
    },
    
    /**
     * 更新属性显示
     */
    updateAttributeDisplay() {
        const attrKeys = ['energy', 'intelligence', 'communication', 'luck', 'ideal'];
        
        attrKeys.forEach(attrKey => {
            const baseValue = this.characterCreation.baseAttributes[attrKey];
            const allocatedValue = this.characterCreation.allocatedPoints[attrKey];
            const finalValue = baseValue + allocatedValue;
            
            // 更新基础值
            const baseEl = document.querySelector(`.attr-base-value[data-attr="${attrKey}"]`);
            if (baseEl) baseEl.textContent = baseValue;
            
            // 更新分配值
            const allocatedEl = document.querySelector(`.attr-allocated-value[data-attr="${attrKey}"]`);
            if (allocatedEl) {
                allocatedEl.textContent = allocatedValue > 0 ? `+${allocatedValue}` : allocatedValue;
                allocatedEl.style.color = allocatedValue > 0 ? '#28a745' : allocatedValue < 0 ? '#dc3545' : '#666';
            }
            
            // 更新最终值
            const finalEl = document.querySelector(`.attr-final-value[data-attr="${attrKey}"]`);
            if (finalEl) finalEl.textContent = finalValue;
        });
        
        // 更新剩余点数
        const remainingEl = document.getElementById('extra-points-remaining');
        if (remainingEl) {
            remainingEl.textContent = this.characterCreation.remainingPoints;
            remainingEl.style.color = this.characterCreation.remainingPoints < 0 ? '#dc3545' : '#333';
        }
        
        // 更新最终属性预览
        this.updateFinalAttributesPreview();
    },
    
    /**
     * 更新最终属性预览
     */
    updateFinalAttributesPreview() {
        const preview = document.getElementById('final-attributes-preview');
        if (!preview) return;
        
        const attrNames = {
            energy: '精力',
            intelligence: '智商',
            communication: '沟通',
            luck: '气运',
            ideal: '理想'
        };
        
        preview.innerHTML = '';
        
        Object.keys(attrNames).forEach(attrKey => {
            const baseValue = this.characterCreation.baseAttributes[attrKey];
            const allocatedValue = this.characterCreation.allocatedPoints[attrKey];
            const finalValue = baseValue + allocatedValue;
            
            const item = document.createElement('div');
            item.style.cssText = 'text-align: center; padding: 8px; background: white; border-radius: 5px;';
            item.innerHTML = `
                <div style="font-size: 12px; color: #666; margin-bottom: 4px;">${attrNames[attrKey]}</div>
                <div style="font-size: 18px; font-weight: bold; color: #667eea;">${finalValue}</div>
            `;
            preview.appendChild(item);
        });
    },
    
    /**
     * 获取最终属性
     */
    getFinalAttributes() {
        return {
            energy: this.characterCreation.baseAttributes.energy + this.characterCreation.allocatedPoints.energy,
            intelligence: this.characterCreation.baseAttributes.intelligence + this.characterCreation.allocatedPoints.intelligence,
            communication: this.characterCreation.baseAttributes.communication + this.characterCreation.allocatedPoints.communication,
            luck: this.characterCreation.baseAttributes.luck + this.characterCreation.allocatedPoints.luck,
            ideal: this.characterCreation.baseAttributes.ideal + this.characterCreation.allocatedPoints.ideal
        };
    },
    
    /**
     * 创建角色（改进版）
     */
    createCharacter() {
        const name = document.getElementById('char-name').value.trim();
        const gender = document.getElementById('char-gender').value;
        const schoolLevel = parseInt(document.getElementById('char-school').value);
        const degreeLevel = parseInt(document.getElementById('char-degree').value);
        
        // 验证输入
        if (!name || !gender) {
            alert('请填写完整信息');
            return;
        }
        
        if (!schoolLevel || !degreeLevel) {
            alert('请选择学校和学历');
            return;
        }
        
        // 检查是否还有未分配的额外点数
        if (this.characterCreation.remainingPoints > 0) {
            if (!confirm(`您还有 ${this.characterCreation.remainingPoints} 点额外点数未分配，确定要继续创建角色吗？`)) {
                return;
            }
        }
        
        // 设置玩家基本信息
        this.player.name = name;
        this.player.gender = gender;
        
        // 应用初始资金加成
        this.player.money = 10000 + this.unlocks.initialMoneyBonus;
        
        // 获取最终属性（基础+分配）
        const finalAttributes = this.getFinalAttributes();
        this.player.attributes.energy = finalAttributes.energy;
        this.player.attributes.intelligence = finalAttributes.intelligence;
        this.player.attributes.communication = finalAttributes.communication;
        this.player.attributes.luck = finalAttributes.luck;
        this.player.attributes.ideal = finalAttributes.ideal;
        
        // 设置学校和学历
        const university = this.data.universities.find(u => u.level === schoolLevel);
        const degree = this.data.degrees.find(d => d.level === degreeLevel);
        
        if (!university || !degree) {
            alert('选择的学校或学历无效');
            return;
        }
        
        this.player.school = university.name;
        this.player.schoolLevel = university.level;
        this.player.education = `${degree.name} - ${university.name}`;
        this.player.degreeLevel = degree.level;
        
        // 初始化工作系统扩展属性
        this.player.skills = {
            technical: 0,
            management: 0,
            sales: 0,
            communication: 0
        };
        this.player.skillPoints = 0;
        // 初始化多维度工作表现
        this.player.workPerformance = {
            quality: 50,
            efficiency: 50,
            teamwork: 50,
            initiative: 50,
            overall: 50
        };
        this.player.workMonths = 0;
        this.player.totalWorkMonths = 0;
        this.player.networkValue = 0;
        this.player.sideJob = null;
        // 初始化工作历史
        this.player.workHistory = {
            recentPerformance: [],
            lastPromotionMonth: 0,
            lastJobChangeMonth: 0,
            lastSalaryIncreaseMonth: 0,
            lastQuarterlyBonusMonth: 0
        };
        
        // 更新UI
        this.updatePlayerPanel();
        this.updateExpensesPanel();
        
        // 切换到主游戏界面
        document.getElementById('character-creation').classList.add('hidden');
        document.getElementById('main-game').classList.remove('hidden');
        
        this.gameState = 'playing';
        
        // 显示选择面板
        this.showChoicePanel(['work', 'graduate', 'startup']);
        
        // 重置解锁系统的临时状态（为下次创建做准备）
        this.unlocks.resetSession();
    },
    
    /**
     * 更新玩家信息面板
     */
    updatePlayerPanel() {
        document.getElementById('player-name').textContent = this.player.name;
        document.getElementById('player-gender').textContent = this.player.gender;
        document.getElementById('player-age').textContent = this.player.age;
        document.getElementById('player-money').textContent = this.player.money.toLocaleString();
        document.getElementById('player-education').textContent = this.player.education;
        document.getElementById('player-school').textContent = this.player.school;
        document.getElementById('player-career').textContent = this.player.career;
        
        document.getElementById('attr-energy').textContent = this.player.attributes.energy;
        document.getElementById('attr-intelligence').textContent = this.player.attributes.intelligence;
        document.getElementById('attr-communication').textContent = this.player.attributes.communication;
        document.getElementById('attr-luck').textContent = this.player.attributes.luck;
        document.getElementById('attr-ideal').textContent = this.player.attributes.ideal;
        
        // 更新开销面板
        this.updateExpensesPanel();
    },
    
    /**
     * 计算每月开销
     */
    calculateMonthlyExpenses() {
        let total = 0;
        
        // 租房开销
        const housingCosts = {
            simple: 2000,
            normal: 4000,
            luxury: 8000
        };
        total += housingCosts[this.player.housingStandard] || 2000;
        
        // 饮食开销
        const foodCosts = {
            simple: 1000,
            normal: 2000,
            luxury: 4000
        };
        total += foodCosts[this.player.foodStandard] || 1000;
        
        // 社交开销
        const socialCosts = {
            simple: 500,
            normal: 1500,
            luxury: 3000
        };
        total += socialCosts[this.player.socialStandard] || 500;
        
        return total;
    },
    
    /**
     * 更新开销面板
     */
    updateExpensesPanel() {
        const total = this.calculateMonthlyExpenses();
        document.getElementById('expenses-total').textContent = total.toLocaleString();
        
        // 更新选择框的值
        const housingSelect = document.getElementById('housing-standard');
        const foodSelect = document.getElementById('food-standard');
        const socialSelect = document.getElementById('social-standard');
        
        if (housingSelect) housingSelect.value = this.player.housingStandard;
        if (foodSelect) foodSelect.value = this.player.foodStandard;
        if (socialSelect) socialSelect.value = this.player.socialStandard;
    },
    
    /**
     * 更新租房标准
     */
    updateHousingStandard() {
        this.player.housingStandard = document.getElementById('housing-standard').value;
        this.updateExpensesPanel();
    },
    
    /**
     * 更新饮食标准
     */
    updateFoodStandard() {
        this.player.foodStandard = document.getElementById('food-standard').value;
        this.updateExpensesPanel();
    },
    
    /**
     * 更新社交标准
     */
    updateSocialStandard() {
        this.player.socialStandard = document.getElementById('social-standard').value;
        this.updateExpensesPanel();
    },
    
    /**
     * 应用生活标准的属性提升
     */
    applyLivingStandardBenefits() {
        // 高租房标准：每月增加0-1点精力
        if (this.player.housingStandard === 'luxury') {
            const energyGain = this.randomInt(0, 1);
            if (energyGain > 0) {
                this.player.attributes.energy = Math.min(100, this.player.attributes.energy + energyGain);
            }
        }
        
        // 高饮食标准：每月增加0-1点智力
        if (this.player.foodStandard === 'luxury') {
            const intelligenceGain = this.randomInt(0, 1);
            if (intelligenceGain > 0) {
                this.player.attributes.intelligence = Math.min(100, this.player.attributes.intelligence + intelligenceGain);
            }
        }
        
        // 高社交标准：每月增加0-1点沟通
        if (this.player.socialStandard === 'luxury') {
            const communicationGain = this.randomInt(0, 1);
            if (communicationGain > 0) {
                this.player.attributes.communication = Math.min(100, this.player.attributes.communication + communicationGain);
            }
        }
    },
    
    /**
     * 处理玩家选择（找工作/读研究生/创业）
     */
    handleChoice(choice) {
        if (this.gameState !== 'playing') return;
        
        switch(choice) {
            case 'work':
                this.showWorkPanel();
                break;
            case 'graduate':
                this.showGraduatePanel();
                break;
            case 'startup':
                this.showStartupPanel();
                break;
        }
    },
    
    /**
     * 显示工作选择面板
     */
    showWorkPanel() {
        if (!this.data || !this.data.jobs) {
            alert('游戏数据未加载，请刷新页面');
            return;
        }
        
        this.showPanel('work-panel');
        const workList = document.getElementById('work-list');
        workList.innerHTML = '';
        
        // 筛选符合学校要求的工作
        const availableJobs = this.data.jobs.filter(job => {
            return this.player.schoolLevel >= job.schoolRequirement;
        });
        
        if (availableJobs.length === 0) {
            workList.innerHTML = '<p>没有符合你学历要求的工作</p>';
            return;
        }
        
        availableJobs.forEach(job => {
            const item = document.createElement('div');
            item.className = 'list-item';
            item.innerHTML = `
                <h4>${job.name}</h4>
                <p>薪资：${job.salary.toLocaleString()} 元/月</p>
                <p>${job.description}</p>
            `;
            item.addEventListener('click', () => {
                this.selectJob(job);
            });
            workList.appendChild(item);
        });
    },
    
    /**
     * 选择工作
     */
    selectJob(job) {
        this.player.career = job.name;
        this.player.currentJob = job;
        this.player.workYears = 0;
        this.player.jobLevel = 1; // 初始职级为初级
        this.player.workActionUsed = false;
        this.player.workMonths = 0; // 重置工作月数
        // 初始化多维度工作表现
        this.player.workPerformance = {
            quality: 50,
            efficiency: 50,
            teamwork: 50,
            initiative: 50,
            overall: 50
        };
        // 重置工作历史
        if (!this.player.workHistory) {
            this.player.workHistory = {
                recentPerformance: [],
                lastPromotionMonth: 0,
                lastJobChangeMonth: 0,
                lastSalaryIncreaseMonth: 0,
                lastQuarterlyBonusMonth: 0
            };
        }
        this.player.workHistory.lastJobChangeMonth = this.currentTurn;
        this.updatePlayerPanel();
        this.updateWorkPanel();
        this.showPanel('work-management');
        
        alert(`你成功找到了工作：${job.name}，月薪 ${job.salary.toLocaleString()} 元`);
    },
    
    /**
     * 更新工作管理面板
     */
    updateWorkPanel() {
        if (!this.player.currentJob) return;
        
        document.getElementById('job-name').textContent = this.player.currentJob.name;
        
        // 根据职级显示名称
        const levelNames = ['初级', '中级', '高级', '资深'];
        const levelName = levelNames[this.player.jobLevel - 1] || '初级';
        document.getElementById('job-level').textContent = levelName;
        
        // 更新薪资显示（使用新的计算方式，显示各项加成）
        const finalSalary = this.calculateFinalSalary();
        document.getElementById('job-salary').textContent = finalSalary.toLocaleString();
        
        // 显示薪资明细
        const baseSalary = this.player.currentJob.baseSalary || this.player.currentJob.salary || 0;
        const levelMultiplier = this.getLevelMultiplier();
        const skillBonus = this.getSkillBonus();
        const performanceBonus = this.getPerformanceSalaryBonus();
        const salaryBreakdown = document.getElementById('salary-breakdown');
        if (salaryBreakdown) {
            salaryBreakdown.innerHTML = `(基础${baseSalary.toLocaleString()}×${levelMultiplier.toFixed(1)}倍`;
            if (skillBonus > 0) salaryBreakdown.innerHTML += `，技能+${skillBonus.toFixed(1)}%`;
            if (performanceBonus > 0) salaryBreakdown.innerHTML += `，绩效+${performanceBonus}%`;
            salaryBreakdown.innerHTML += ')';
        }
        
        // 更新工作月数、人脉值
        document.getElementById('work-months').textContent = this.player.workMonths || 0;
        document.getElementById('network-value').textContent = this.player.networkValue || 0;
        
        // 更新多维度工作表现显示
        this.updateWorkPerformanceOverall();
        if (this.player.workPerformance) {
            document.getElementById('work-performance-overall').textContent = this.player.workPerformance.overall || 50;
            document.getElementById('work-performance-quality').textContent = this.player.workPerformance.quality || 50;
            document.getElementById('work-performance-efficiency').textContent = this.player.workPerformance.efficiency || 50;
            document.getElementById('work-performance-teamwork').textContent = this.player.workPerformance.teamwork || 50;
            document.getElementById('work-performance-initiative').textContent = this.player.workPerformance.initiative || 50;
        } else {
            // 兼容旧数据
            const oldPerf = typeof this.player.workPerformance === 'number' ? this.player.workPerformance : 50;
            document.getElementById('work-performance-overall').textContent = oldPerf;
            document.getElementById('work-performance-quality').textContent = oldPerf;
            document.getElementById('work-performance-efficiency').textContent = oldPerf;
            document.getElementById('work-performance-teamwork').textContent = oldPerf;
            document.getElementById('work-performance-initiative').textContent = oldPerf;
        }
        
        // 更新技能显示
        this.updateSkills();
        
        // 更新按钮状态
        const workHardBtn = document.getElementById('work-hard-btn');
        const workSlackBtn = document.getElementById('work-slack-btn');
        const workLearnBtn = document.getElementById('work-learn-btn');
        const workOvertimeBtn = document.getElementById('work-overtime-btn');
        const workSocialBtn = document.getElementById('work-social-btn');
        const workTrainingBtn = document.getElementById('work-training-btn');
        const workSideJobBtn = document.getElementById('work-sidejob-btn');
        const workJobHuntBtn = document.getElementById('work-jobhunt-btn');
        const workQuitBtn = document.getElementById('work-quit-btn');
        const hint = document.getElementById('work-action-hint');
        
        if (this.player.workActionUsed) {
            workHardBtn.disabled = true;
            workSlackBtn.disabled = true;
            workLearnBtn.disabled = true;
            workOvertimeBtn.disabled = true;
            workSocialBtn.disabled = true;
            workTrainingBtn.disabled = false; // 培训不受限制（但需要金钱）
            workSideJobBtn.disabled = true;
            workJobHuntBtn.disabled = false; // 跳槽不受限制（但需要满足条件）
            workQuitBtn.disabled = false;
            hint.textContent = '本回合已使用行动，请进入下个月';
            hint.style.color = '#dc3545';
        } else {
            workHardBtn.disabled = false;
            workSlackBtn.disabled = false;
            workLearnBtn.disabled = false;
            workOvertimeBtn.disabled = false;
            workSocialBtn.disabled = false;
            workTrainingBtn.disabled = false;
            workSideJobBtn.disabled = false;
            workJobHuntBtn.disabled = false;
            workQuitBtn.disabled = false;
            hint.textContent = '每回合只能执行一次行动（培训和跳槽不受限制）';
            hint.style.color = '#666';
        }
        
        // 检查是否可以晋升
        if (this.checkPromotion()) {
            // 延迟提示，避免在更新时立即弹出
            setTimeout(() => {
                if (confirm('恭喜！你已达到晋升条件，是否立即晋升？\n晋升后将获得：\n- 职级提升\n- 薪资提升30%\n- 技能点+10')) {
                    this.promote();
                }
            }, 100);
        }
    },
    
    /**
     * 努力板砖：触发精力检定，通过获得奖金
     */
    workHard() {
        if (!this.player.currentJob) {
            alert('你还没有工作！');
            return;
        }
        
        if (this.player.workActionUsed) {
            alert('本回合已使用行动，请进入下个月');
            return;
        }
        
        this.player.workActionUsed = true;
        
        // 精力检定：难度30-70
        const checkValue = this.randomInt(30, 70);
        const playerEnergy = this.player.attributes.energy;
        const passed = playerEnergy >= checkValue;
        
        if (passed) {
            // 检定通过：获得奖金（基础薪资×0.15-0.25）
            const baseSalary = this.player.currentJob.baseSalary || this.player.currentJob.salary || 5000;
            const bonusRate = 0.15 + Math.random() * 0.1; // 0.15-0.25
            const bonus = Math.floor(baseSalary * bonusRate);
            this.player.money += bonus;
            
            // 技能点奖励（技术或管理，根据当前技能等级调整）
            const skillType = Math.random() < 0.5 ? 'technical' : 'management';
            const baseSkillPoints = this.randomInt(2, 4);
            const actualPoints = this.addSkillPoints(skillType, baseSkillPoints);
            
            // 多维度工作表现提升：质量+2-4，效率+1-2
            if (!this.player.workPerformance) {
                this.player.workPerformance = { quality: 50, efficiency: 50, teamwork: 50, initiative: 50, overall: 50 };
            }
            this.player.workPerformance.quality = Math.min(100, this.player.workPerformance.quality + this.randomInt(2, 4));
            this.player.workPerformance.efficiency = Math.min(100, this.player.workPerformance.efficiency + this.randomInt(1, 2));
            this.updateWorkPerformanceOverall();
            
            alert(`努力板砖！精力检定通过！获得奖金${bonus.toLocaleString()}元，${this.getSkillName(skillType)}+${actualPoints}，工作质量+${this.randomInt(2, 4)}，工作效率+${this.randomInt(1, 2)}`);
        } else {
            // 检定失败：无奖励
            alert(`努力板砖！精力检定失败（需要${checkValue}，你的精力${playerEnergy}），没有获得奖励`);
        }
        
        this.updatePlayerPanel();
        this.updateWorkPanel();
    },
    
    /**
     * 偷偷摸鱼：触发气运检定，通过获得气运+1
     */
    workSlack() {
        if (!this.player.currentJob) {
            alert('你还没有工作！');
            return;
        }
        
        if (this.player.workActionUsed) {
            alert('本回合已使用行动，请进入下个月');
            return;
        }
        
        this.player.workActionUsed = true;
        
        // 气运检定：难度30-70
        const checkValue = this.randomInt(30, 70);
        const playerLuck = this.player.attributes.luck;
        const passed = playerLuck >= checkValue;
        
        if (passed) {
            // 检定通过：气运+1
            this.player.attributes.luck = Math.min(100, this.player.attributes.luck + 1);
            
            // 技能点奖励（沟通）
            const baseSkillPoints = this.randomInt(1, 2);
            const actualPoints = this.addSkillPoints('communication', baseSkillPoints);
            
            // 多维度工作表现：团队协作+1-2
            if (!this.player.workPerformance) {
                this.player.workPerformance = { quality: 50, efficiency: 50, teamwork: 50, initiative: 50, overall: 50 };
            }
            this.player.workPerformance.teamwork = Math.min(100, this.player.workPerformance.teamwork + this.randomInt(1, 2));
            
            // 风险：30%概率工作质量-2，工作效率-1
            if (Math.random() < 0.3) {
                this.player.workPerformance.quality = Math.max(0, this.player.workPerformance.quality - 2);
                this.player.workPerformance.efficiency = Math.max(0, this.player.workPerformance.efficiency - 1);
                this.updateWorkPerformanceOverall();
                alert(`偷偷摸鱼！气运检定通过！气运+1，沟通技能+${actualPoints}，团队协作+${this.randomInt(1, 2)}，但工作质量-2，工作效率-1`);
            } else {
                this.updateWorkPerformanceOverall();
                alert(`偷偷摸鱼！气运检定通过！气运+1，沟通技能+${actualPoints}，团队协作+${this.randomInt(1, 2)}`);
            }
        } else {
            // 检定失败：无奖励
            alert(`偷偷摸鱼！气运检定失败（需要${checkValue}，你的气运${playerLuck}），没有获得奖励`);
        }
        
        this.updatePlayerPanel();
        this.updateWorkPanel();
    },
    
    /**
     * 自主学习：随机获得一项属性（仅智商、沟通、理想）+1
     */
    workLearn() {
        if (!this.player.currentJob) {
            alert('你还没有工作！');
            return;
        }
        
        if (this.player.workActionUsed) {
            alert('本回合已使用行动，请进入下个月');
            return;
        }
        
        this.player.workActionUsed = true;
        
        // 随机提升一个属性（仅智商、沟通、理想）
        const attrNames = ['智商', '沟通', '理想'];
        const randomAttr = attrNames[this.randomInt(0, attrNames.length - 1)];
        const attrKey = this.getAttributeKey(randomAttr);
        this.player.attributes[attrKey] = Math.min(100, this.player.attributes[attrKey] + 1);
        
        // 根据属性类型获得技能点
        let skillType = 'technical';
        if (attrKey === 'communication') skillType = 'communication';
        else if (attrKey === 'ideal') skillType = 'management';
        
        const baseSkillPoints = this.randomInt(2, 4);
        const actualPoints = this.addSkillPoints(skillType, baseSkillPoints);
        
        // 多维度工作表现：工作质量+1-3，主动性+2-3
        if (!this.player.workPerformance) {
            this.player.workPerformance = { quality: 50, efficiency: 50, teamwork: 50, initiative: 50, overall: 50 };
        }
        const qualityGain = this.randomInt(1, 3);
        const initiativeGain = this.randomInt(2, 3);
        this.player.workPerformance.quality = Math.min(100, this.player.workPerformance.quality + qualityGain);
        this.player.workPerformance.initiative = Math.min(100, this.player.workPerformance.initiative + initiativeGain);
        this.updateWorkPerformanceOverall();
        
        alert(`自主学习！${randomAttr}+1，${this.getSkillName(skillType)}+${actualPoints}，工作质量+${qualityGain}，主动性+${initiativeGain}`);
        
        this.updatePlayerPanel();
        this.updateWorkPanel();
    },
    
    /**
     * 更新工作表现综合评分（兼容旧数据格式）
     */
    updateWorkPerformanceOverall() {
        // 兼容旧数据：如果workPerformance是数字，转换为新格式
        if (typeof this.player.workPerformance === 'number') {
            const oldValue = this.player.workPerformance;
            this.player.workPerformance = {
                quality: oldValue,
                efficiency: oldValue,
                teamwork: oldValue,
                initiative: oldValue,
                overall: oldValue
            };
        }
        
        if (!this.player.workPerformance || typeof this.player.workPerformance !== 'object') {
            this.player.workPerformance = {
                quality: 50,
                efficiency: 50,
                teamwork: 50,
                initiative: 50,
                overall: 50
            };
        }
        
        // 确保所有维度都存在
        if (typeof this.player.workPerformance.quality !== 'number') this.player.workPerformance.quality = 50;
        if (typeof this.player.workPerformance.efficiency !== 'number') this.player.workPerformance.efficiency = 50;
        if (typeof this.player.workPerformance.teamwork !== 'number') this.player.workPerformance.teamwork = 50;
        if (typeof this.player.workPerformance.initiative !== 'number') this.player.workPerformance.initiative = 50;
        
        // 综合评分 = (质量×0.3 + 效率×0.25 + 团队协作×0.2 + 主动性×0.25)
        const perf = this.player.workPerformance;
        perf.overall = Math.floor(
            perf.quality * 0.3 +
            perf.efficiency * 0.25 +
            perf.teamwork * 0.2 +
            perf.initiative * 0.25
        );
        
        // 确保所有值在0-100范围内
        perf.quality = Math.max(0, Math.min(100, perf.quality));
        perf.efficiency = Math.max(0, Math.min(100, perf.efficiency));
        perf.teamwork = Math.max(0, Math.min(100, perf.teamwork));
        perf.initiative = Math.max(0, Math.min(100, perf.initiative));
        perf.overall = Math.max(0, Math.min(100, perf.overall));
    },
    
    /**
     * 增加技能点（非线性成长曲线系统）
     */
    addSkillPoints(skillType, basePoints) {
        if (!this.player.skills) {
            this.player.skills = {
                technical: 0,
                management: 0,
                sales: 0,
                communication: 0
            };
        }
        
        if (!this.player.skills[skillType]) {
            this.player.skills[skillType] = 0;
        }
        
        const currentSkill = this.player.skills[skillType];
        let actualPoints = basePoints;
        
        // 根据技能等级调整实际获得的点数（非线性成长曲线）
        if (currentSkill < 20) {
            // 新手期（0-20）：快速提升，保持原值
            actualPoints = basePoints;
        } else if (currentSkill < 50) {
            // 中级期（20-50）：正常提升，减少25%
            actualPoints = Math.floor(basePoints * 0.75);
        } else if (currentSkill < 80) {
            // 高级期（50-80）：缓慢提升，减少50%
            actualPoints = Math.floor(basePoints * 0.5);
        } else {
            // 专家期（80-100）：瓶颈期，减少75%，且可能失败
            actualPoints = Math.floor(basePoints * 0.25);
            if (Math.random() < 0.3) {
                actualPoints = 0; // 30%概率无法提升
            }
        }
        
        this.player.skillPoints = (this.player.skillPoints || 0) + actualPoints;
        this.player.skills[skillType] = Math.min(100, this.player.skills[skillType] + actualPoints);
        
        // 更新技能显示
        this.updateSkills();
        
        return actualPoints;
    },
    
    /**
     * 获取技能名称
     */
    getSkillName(skillType) {
        const names = {
            technical: '技术技能',
            management: '管理技能',
            sales: '销售技能',
            communication: '沟通技能'
        };
        return names[skillType] || skillType;
    },
    
    /**
     * 获取总技能点数
     */
    getTotalSkill() {
        if (!this.player.skills) return 0;
        
        return (this.player.skills.technical || 0) +
               (this.player.skills.management || 0) +
               (this.player.skills.sales || 0) +
               (this.player.skills.communication || 0);
    },
    
    /**
     * 获取技能加成（非线性加成，高技能收益递减）
     */
    getSkillBonus() {
        const totalSkill = this.getTotalSkill();
        
        // 分段计算加成
        let bonus = 0;
        if (totalSkill >= 0) bonus += Math.min(20, totalSkill) * 0.15;      // 0-20点：每点0.15%
        if (totalSkill >= 20) bonus += Math.min(30, totalSkill - 20) * 0.1; // 20-50点：每点0.1%
        if (totalSkill >= 50) bonus += Math.min(30, totalSkill - 50) * 0.05; // 50-80点：每点0.05%
        if (totalSkill >= 80) bonus += (totalSkill - 80) * 0.02;            // 80-100点：每点0.02%
        
        return Math.min(15, bonus); // 最高15%加成
    },
    
    /**
     * 获取技能等级名称
     */
    getSkillLevelName(skillValue) {
        if (skillValue < 20) return '新手';
        if (skillValue < 50) return '中级';
        if (skillValue < 80) return '高级';
        return '专家';
    },
    
    /**
     * 更新技能显示
     */
    updateSkills() {
        if (!this.player.skills) {
            this.player.skills = {
                technical: 0,
                management: 0,
                sales: 0,
                communication: 0
            };
        }
        
        // 在工作面板中更新技能显示（如果存在）
        const skillsList = document.getElementById('skills-list');
        if (skillsList) {
            skillsList.innerHTML = '';
            
            Object.keys(this.player.skills).forEach(skillType => {
                const skillValue = this.player.skills[skillType];
                const skillLevel = this.getSkillLevelName(skillValue);
                const item = document.createElement('div');
                item.style.cssText = 'display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #eee;';
                item.innerHTML = `
                    <span>${this.getSkillName(skillType)}：</span>
                    <span style="font-weight: bold; color: #667eea;">${skillValue}</span>
                    <span style="font-size: 12px; color: #999; margin-left: 8px;">(${skillLevel})</span>
                `;
                skillsList.appendChild(item);
            });
        }
        
        // 更新技能点显示
        const skillPointsEl = document.getElementById('skill-points');
        if (skillPointsEl) {
            skillPointsEl.textContent = this.player.skillPoints || 0;
        }
    },
    
    /**
     * 辞职：失去工作并打开选项找工作或者创业
     */
    workQuit() {
        if (!confirm('确定要辞职吗？辞职后将失去当前工作。')) {
            return;
        }
        
        // 清除工作状态
        this.player.currentJob = null;
        this.player.jobLevel = 1;
        this.player.workActionUsed = false;
        this.player.workMonths = 0; // 重置工作月数
        this.player.sideJob = null; // 清除副业
        
        // 显示选择面板（只显示找工作和创业）
        this.showChoicePanel(['work', 'startup']);
        
        this.updatePlayerPanel();
    },
    
    /**
     * 加班：消耗精力，获得额外奖金
     */
    workOvertime() {
        if (!this.player.currentJob) {
            alert('你还没有工作！');
            return;
        }
        
        if (this.player.workActionUsed) {
            alert('本回合已使用行动，请进入下个月');
            return;
        }
        
        // 检查精力是否足够
        if (this.player.attributes.energy < 30) {
            alert('精力不足，无法加班！');
            return;
        }
        
        this.player.workActionUsed = true;
        
        // 消耗精力
        const energyCost = this.randomInt(5, 10);
        this.player.attributes.energy = Math.max(0, this.player.attributes.energy - energyCost);
        
        // 精力检定：难度40-80
        const checkValue = this.randomInt(40, 80);
        const playerEnergy = this.player.attributes.energy;
        const passed = playerEnergy >= checkValue;
        
        if (passed) {
            // 检定通过：获得奖金（基础薪资×0.2-0.3，加班费）
            const baseSalary = this.player.currentJob.baseSalary || this.player.currentJob.salary || 5000;
            const bonusRate = 0.2 + Math.random() * 0.1; // 0.2-0.3
            const bonus = Math.floor(baseSalary * bonusRate);
            this.player.money += bonus;
            
            // 技能点奖励（技术）
            const baseSkillPoints = this.randomInt(2, 4);
            const actualPoints = this.addSkillPoints('technical', baseSkillPoints);
            
            // 多维度工作表现：工作效率+3-5
            if (!this.player.workPerformance) {
                this.player.workPerformance = { quality: 50, efficiency: 50, teamwork: 50, initiative: 50, overall: 50 };
            }
            const efficiencyGain = this.randomInt(3, 5);
            this.player.workPerformance.efficiency = Math.min(100, this.player.workPerformance.efficiency + efficiencyGain);
            
            // 风险：如果精力<30，工作质量-2（过度劳累）
            if (playerEnergy < 30) {
                this.player.workPerformance.quality = Math.max(0, this.player.workPerformance.quality - 2);
                this.updateWorkPerformanceOverall();
                alert(`加班成功！精力检定通过！获得奖金${bonus.toLocaleString()}元，技术技能+${actualPoints}，工作效率+${efficiencyGain}，但过度劳累导致工作质量-2`);
            } else {
                this.updateWorkPerformanceOverall();
                alert(`加班成功！精力检定通过！获得奖金${bonus.toLocaleString()}元，技术技能+${actualPoints}，工作效率+${efficiencyGain}`);
            }
        } else {
            // 检定失败：只获得少量奖金
            const bonus = this.randomInt(500, 1000);
            this.player.money += bonus;
            alert(`加班失败！精力不足（需要${checkValue}，你的精力${playerEnergy}），只获得少量奖金${bonus.toLocaleString()}元`);
        }
        
        this.updatePlayerPanel();
        this.updateWorkPanel();
    },
    
    /**
     * 社交：消耗沟通，获得人脉值
     */
    workSocial() {
        if (!this.player.currentJob) {
            alert('你还没有工作！');
            return;
        }
        
        if (this.player.workActionUsed) {
            alert('本回合已使用行动，请进入下个月');
            return;
        }
        
        // 检查沟通是否足够
        if (this.player.attributes.communication < 30) {
            alert('沟通能力不足，无法进行社交！');
            return;
        }
        
        this.player.workActionUsed = true;
        
        // 消耗沟通
        const commCost = this.randomInt(3, 5);
        this.player.attributes.communication = Math.max(0, this.player.attributes.communication - commCost);
        
        // 沟通检定：难度30-70
        const checkValue = this.randomInt(30, 70);
        const playerComm = this.player.attributes.communication;
        const passed = playerComm >= checkValue;
        
        if (passed) {
            // 检定通过：获得人脉值
            const networkGain = this.randomInt(5, 15);
            this.player.networkValue = (this.player.networkValue || 0) + networkGain;
            
            // 技能点奖励（沟通或销售）
            const skillType = Math.random() < 0.5 ? 'communication' : 'sales';
            const baseSkillPoints = this.randomInt(2, 3);
            const actualPoints = this.addSkillPoints(skillType, baseSkillPoints);
            
            // 多维度工作表现：团队协作+2-4，主动性+1-2
            if (!this.player.workPerformance) {
                this.player.workPerformance = { quality: 50, efficiency: 50, teamwork: 50, initiative: 50, overall: 50 };
            }
            const teamworkGain = this.randomInt(2, 4);
            const initiativeGain = this.randomInt(1, 2);
            this.player.workPerformance.teamwork = Math.min(100, this.player.workPerformance.teamwork + teamworkGain);
            this.player.workPerformance.initiative = Math.min(100, this.player.workPerformance.initiative + initiativeGain);
            this.updateWorkPerformanceOverall();
            
            // 10%概率触发机会事件（额外奖金5000-15000元）
            if (Math.random() < 0.1) {
                const opportunityBonus = this.randomInt(5000, 15000);
                this.player.money += opportunityBonus;
                alert(`社交成功！沟通检定通过！人脉值+${networkGain}，${this.getSkillName(skillType)}+${actualPoints}，团队协作+${teamworkGain}，主动性+${initiativeGain}，触发机会事件获得${opportunityBonus.toLocaleString()}元！`);
            } else {
                alert(`社交成功！沟通检定通过！人脉值+${networkGain}，${this.getSkillName(skillType)}+${actualPoints}，团队协作+${teamworkGain}，主动性+${initiativeGain}`);
            }
        } else {
            // 检定失败：只获得少量人脉值
            const networkGain = this.randomInt(1, 3);
            this.player.networkValue = (this.player.networkValue || 0) + networkGain;
            alert(`社交失败！沟通能力不足（需要${checkValue}，你的沟通${playerComm}），只获得少量人脉值+${networkGain}`);
        }
        
        this.updatePlayerPanel();
        this.updateWorkPanel();
    },
    
    /**
     * 培训：打开培训面板
     */
    workTraining() {
        if (!this.player.currentJob) {
            alert('你还没有工作！');
            return;
        }
        
        // 显示培训面板
        this.showTrainingPanel();
    },
    
    /**
     * 副业：消耗精力，获得额外收入
     */
    workSideJob() {
        if (!this.player.currentJob) {
            alert('你还没有工作！');
            return;
        }
        
        if (this.player.workActionUsed) {
            alert('本回合已使用行动，请进入下个月');
            return;
        }
        
        // 检查精力是否足够
        if (this.player.attributes.energy < 20) {
            alert('精力不足，无法开展副业！');
            return;
        }
        
        this.player.workActionUsed = true;
        
        // 消耗精力
        const energyCost = this.randomInt(5, 10);
        this.player.attributes.energy = Math.max(0, this.player.attributes.energy - energyCost);
        
        // 如果还没有副业，创建一个
        if (!this.player.sideJob) {
            const sideJobTypes = ['兼职翻译', '线上教学', '自由撰稿', '设计接单', '咨询顾问'];
            const sideJobType = sideJobTypes[this.randomInt(0, sideJobTypes.length - 1)];
            // 副业收入基于基础薪资
            const baseSalary = this.player.currentJob.baseSalary || this.player.currentJob.salary || 5000;
            const incomeRate = 0.2 + Math.random() * 0.2; // 0.2-0.4
            this.player.sideJob = {
                type: sideJobType,
                income: Math.floor(baseSalary * incomeRate)
            };
            alert(`开始副业：${sideJobType}！每月可获得${this.player.sideJob.income.toLocaleString()}元收入`);
        } else {
            // 已有副业，获得收入（基础薪资×0.2-0.4）
            const baseSalary = this.player.currentJob.baseSalary || this.player.currentJob.salary || 5000;
            const incomeRate = 0.2 + Math.random() * 0.2; // 0.2-0.4
            const income = Math.floor(baseSalary * incomeRate);
            this.player.money += income;
            
            // 技能点奖励（根据副业类型）
            const skillType = this.player.sideJob.type.includes('翻译') || this.player.sideJob.type.includes('教学') 
                ? 'communication' 
                : 'technical';
            const baseSkillPoints = this.randomInt(1, 3);
            const actualPoints = this.addSkillPoints(skillType, baseSkillPoints);
            
            // 风险：如果精力<20，主工作表现-2（影响主业）
            if (this.player.attributes.energy < 20) {
                if (!this.player.workPerformance) {
                    this.player.workPerformance = { quality: 50, efficiency: 50, teamwork: 50, initiative: 50, overall: 50 };
                }
                this.player.workPerformance.overall = Math.max(0, this.player.workPerformance.overall - 2);
                this.updateWorkPerformanceOverall();
                alert(`副业收入：${this.player.sideJob.type}获得${income.toLocaleString()}元，${this.getSkillName(skillType)}+${actualPoints}，但精力不足影响主业，工作表现-2`);
            } else {
                alert(`副业收入：${this.player.sideJob.type}获得${income.toLocaleString()}元，${this.getSkillName(skillType)}+${actualPoints}`);
            }
        }
        
        this.updatePlayerPanel();
        this.updateWorkPanel();
    },
    
    /**
     * 跳槽：打开跳槽面板
     */
    workJobHunt() {
        if (!this.player.currentJob) {
            alert('你还没有工作！');
            return;
        }
        
        // 检查是否可以跳槽（需要工作至少6个月）
        if ((this.player.workMonths || 0) < 6) {
            alert('工作未满6个月，无法跳槽！');
            return;
        }
        
        // 检查跳槽冷却期（如果上次跳槽失败，3个月内无法再次跳槽）
        if (this.player.workHistory && this.player.workHistory.lastJobHuntFailMonth) {
            const monthsSinceFail = (this.player.workMonths || 0) - this.player.workHistory.lastJobHuntFailMonth;
            if (monthsSinceFail < 3) {
                alert(`跳槽失败后需要等待3个月才能再次尝试，还需等待${3 - monthsSinceFail}个月。`);
                return;
            }
        }
        
        // 显示跳槽面板
        this.showJobHuntPanel();
    },
    
    /**
     * 获取职级倍数
     */
    getLevelMultiplier() {
        const multipliers = {
            1: 1.0,  // 初级
            2: 1.2,  // 中级
            3: 1.5,  // 高级
            4: 2.0   // 资深
        };
        return multipliers[this.player.jobLevel] || 1.0;
    },
    
    /**
     * 获取绩效薪资加成（基于工作表现综合评分）
     */
    getPerformanceSalaryBonus() {
        if (!this.player.workPerformance) return 0;
        
        this.updateWorkPerformanceOverall();
        const performance = this.player.workPerformance.overall;
        
        // 90-100分：+10%薪资
        if (performance >= 90) return 10;
        // 80-89分：+7%薪资
        if (performance >= 80) return 7;
        // 70-79分：+5%薪资
        if (performance >= 70) return 5;
        // 60-69分：+2%薪资
        if (performance >= 60) return 2;
        // <60分：无加成
        return 0;
    },
    
    /**
     * 计算最终薪资（多因素计算）
     */
    calculateFinalSalary() {
        if (!this.player.currentJob) return 0;
        
        const base = this.player.currentJob.baseSalary || this.player.currentJob.salary || 0;
        const skillBonus = this.getSkillBonus(); // 0-15%
        const performanceBonus = this.getPerformanceSalaryBonus(); // 0-10%
        const levelMultiplier = this.getLevelMultiplier(); // 1.0-2.0
        
        // 最终薪资 = (基础薪资 × 职级倍数) × (1 + 技能加成 + 绩效加成)
        const final = Math.floor(base * levelMultiplier * (1 + skillBonus/100 + performanceBonus/100));
        return final;
    },
    
    /**
     * 计算绩效奖金（分段计算，基于工作表现综合评分）
     */
    calculatePerformanceBonus() {
        if (!this.player.currentJob) return 0;
        
        const baseSalary = this.player.currentJob.baseSalary || this.player.currentJob.salary || 0;
        this.updateWorkPerformanceOverall();
        const performance = this.player.workPerformance.overall;
        
        // 基础绩效奖金 = 基础薪资 × 绩效系数
        // 绩效系数：60分以下0%，60-69分5%，70-79分10%，80-89分15%，90-100分20%
        let bonusRate = 0;
        if (performance >= 90) bonusRate = 0.20;
        else if (performance >= 80) bonusRate = 0.15;
        else if (performance >= 70) bonusRate = 0.10;
        else if (performance >= 60) bonusRate = 0.05;
        
        const bonus = Math.floor(baseSalary * bonusRate);
        
        // 季度奖金：每3个月额外发放一次（基于最近3个月平均表现）
        const quarterlyBonus = this.calculateQuarterlyBonus();
        
        return bonus + quarterlyBonus;
    },
    
    /**
     * 计算季度奖金
     */
    calculateQuarterlyBonus() {
        if (!this.player.currentJob || !this.player.workHistory) return 0;
        
        const baseSalary = this.player.currentJob.baseSalary || this.player.currentJob.salary || 0;
        const workMonths = this.player.workMonths || 0;
        
        // 每3个月计算一次
        if (workMonths % 3 !== 0 || workMonths === 0) return 0;
        
        // 检查是否已经发放过（避免重复计算）
        const lastQuarterlyMonth = this.player.workHistory.lastQuarterlyBonusMonth || 0;
        if (workMonths === lastQuarterlyMonth) return 0;
        
        // 基于最近3个月的平均工作表现
        const recentPerf = this.player.workHistory.recentPerformance || [];
        if (recentPerf.length < 3) {
            // 如果记录不足，使用当前表现
            this.updateWorkPerformanceOverall();
            const currentPerf = this.player.workPerformance.overall;
            if (currentPerf > 85) {
                this.player.workHistory.lastQuarterlyBonusMonth = workMonths;
                return Math.floor(baseSalary * 0.10);
            }
            return 0;
        }
        
        // 计算最近3个月的平均表现
        const last3Months = recentPerf.slice(-3);
        const avgPerformance = last3Months.reduce((sum, p) => sum + (p.overall || p), 0) / last3Months.length;
        
        // 平均表现>85分时，额外获得基础薪资×10%
        if (avgPerformance > 85) {
            this.player.workHistory.lastQuarterlyBonusMonth = workMonths;
            return Math.floor(baseSalary * 0.10);
        }
        
        return 0;
    },
    
    /**
     * 计算年终奖（基于绩效的倍数计算，考虑工作月数比例）
     */
    calculateYearEndBonus() {
        if (!this.player.currentJob) return 0;
        
        const workMonths = this.player.workMonths || 0;
        
        // 检查是否工作满12个月
        if (workMonths < 12 || workMonths % 12 !== 0) {
            return 0;
        }
        
        const baseSalary = this.player.currentJob.baseSalary || this.player.currentJob.salary || 0;
        this.updateWorkPerformanceOverall();
        const performance = this.player.workPerformance.overall;
        
        // 基础年终奖 = 基础薪资 × 月数/12 × 绩效系数
        // 绩效系数：60分以下0.5倍，60-69分1倍，70-79分1.5倍，80-89分2倍，90-100分2.5倍
        let multiplier = 0.5;
        if (performance >= 90) multiplier = 2.5;
        else if (performance >= 80) multiplier = 2.0;
        else if (performance >= 70) multiplier = 1.5;
        else if (performance >= 60) multiplier = 1.0;
        
        // 如果工作不满12个月，按比例计算（虽然这里已经检查了12个月，但保留逻辑以防万一）
        const monthsRatio = Math.min(1, workMonths / 12);
        const bonus = Math.floor(baseSalary * multiplier * monthsRatio);
        
        return bonus;
    },
    
    /**
     * 计算副业收入（如果存在副业）
     */
    calculateSideJobIncome() {
        if (!this.player.sideJob) return 0;
        return this.player.sideJob.income || 0;
    },
    
    /**
     * 获取下一级所需技能要求
     */
    getRequiredSkillForNextLevel() {
        const nextLevel = this.player.jobLevel + 1;
        const requirements = {
            2: { primary: 30, secondary: 0 },      // 初级→中级：任一技能>=30
            3: { primary: 50, secondary: 30 },    // 中级→高级：主要技能>=50，次要技能>=30
            4: { primary: 70, secondary: 50 }    // 高级→资深：主要技能>=70，次要技能>=50
        };
        return requirements[nextLevel] || { primary: 0, secondary: 0 };
    },
    
    /**
     * 检查是否满足技能要求
     */
    hasRequiredSkill(requirements) {
        if (!this.player.skills) return false;
        
        const skills = this.player.skills;
        const skillValues = Object.values(skills);
        
        // 检查主要技能要求（任一技能达到要求）
        const hasPrimary = skillValues.some(skill => skill >= requirements.primary);
        
        // 检查次要技能要求（至少一个技能达到要求）
        const hasSecondary = requirements.secondary === 0 || skillValues.some(skill => skill >= requirements.secondary);
        
        return hasPrimary && hasSecondary;
    },
    
    /**
     * 检查工作稳定性（最近6个月工作表现不能有大幅下降）
     */
    checkWorkStability() {
        if (!this.player.workHistory || !this.player.workHistory.recentPerformance) {
            return true; // 如果没有历史记录，认为稳定
        }
        
        const recentPerf = this.player.workHistory.recentPerformance;
        if (recentPerf.length < 6) {
            return true; // 记录不足6个月，认为稳定
        }
        
        // 检查最近6个月的表现是否有大幅下降（下降超过20分）
        const last6Months = recentPerf.slice(-6);
        const firstPerf = last6Months[0].overall || last6Months[0];
        const lastPerf = last6Months[last6Months.length - 1].overall || last6Months[last6Months.length - 1];
        
        // 如果最后的表现比最初的表现低超过20分，认为不稳定
        if (lastPerf < firstPerf - 20) {
            return false;
        }
        
        return true;
    },
    
    /**
     * 检查是否可以晋升（多维度条件检查）
     */
    checkPromotion() {
        if (!this.player.currentJob) return false;
        
        // 1. 工作年限：至少12个月（当前工作）
        if ((this.player.workMonths || 0) < 12) return false;
        
        // 2. 工作表现：综合评分>=75
        this.updateWorkPerformanceOverall();
        if (this.player.workPerformance.overall < 75) return false;
        
        // 3. 技能要求：根据职级不同，要求不同
        const requiredSkill = this.getRequiredSkillForNextLevel();
        if (!this.hasRequiredSkill(requiredSkill)) return false;
        
        // 4. 职级限制：最高4级
        if (this.player.jobLevel >= 4) return false;
        
        // 5. 工作稳定性：最近6个月工作表现不能有大幅下降
        if (!this.checkWorkStability()) return false;
        
        return true;
    },
    
    /**
     * 执行晋升（优化晋升奖励）
     */
    promote() {
        if (!this.checkPromotion()) return false;
        
        const oldLevel = this.player.jobLevel;
        this.player.jobLevel++;
        
        // 保存基础薪资（如果还没有）
        if (!this.player.currentJob.baseSalary) {
            this.player.currentJob.baseSalary = this.player.currentJob.salary || 0;
        }
        
        const oldSalary = this.calculateFinalSalary();
        
        // 薪资增长：20-30%（根据工作表现）
        this.updateWorkPerformanceOverall();
        const performance = this.player.workPerformance.overall;
        const salaryIncreaseRate = 0.20 + (performance - 75) / 25 * 0.10; // 75分20%，100分30%
        this.player.currentJob.baseSalary = Math.floor(this.player.currentJob.baseSalary * (1 + salaryIncreaseRate));
        
        const newSalary = this.calculateFinalSalary();
        
        // 技能点奖励：10-20点（根据职级）
        const skillPoints = 10 + (this.player.jobLevel - 1) * 5; // 中级+10，高级+15，资深+20
        this.player.skillPoints = (this.player.skillPoints || 0) + skillPoints;
        
        // 随机提升一个技能
        const skillTypes = Object.keys(this.player.skills);
        const randomSkill = skillTypes[this.randomInt(0, skillTypes.length - 1)];
        const actualPoints = this.addSkillPoints(randomSkill, skillPoints);
        
        // 工作表现重置：各维度+5（新起点）
        if (this.player.workPerformance) {
            this.player.workPerformance.quality = Math.min(100, this.player.workPerformance.quality + 5);
            this.player.workPerformance.efficiency = Math.min(100, this.player.workPerformance.efficiency + 5);
            this.player.workPerformance.teamwork = Math.min(100, this.player.workPerformance.teamwork + 5);
            this.player.workPerformance.initiative = Math.min(100, this.player.workPerformance.initiative + 5);
            this.updateWorkPerformanceOverall();
        }
        
        // 记录晋升月份
        if (this.player.workHistory) {
            this.player.workHistory.lastPromotionMonth = this.player.workMonths || 0;
        }
        
        const levelNames = ['初级', '中级', '高级', '资深'];
        alert(`恭喜晋升！从${levelNames[oldLevel - 1]}提升到${levelNames[this.player.jobLevel - 1]}，薪资从${oldSalary.toLocaleString()}元提升到${newSalary.toLocaleString()}元，${this.getSkillName(randomSkill)}+${actualPoints}`);
        
        this.updatePlayerPanel();
        this.updateWorkPanel();
        return true;
    },
    
    /**
     * 显示跳槽面板
     */
    showJobHuntPanel() {
        if (!this.data || !this.data.jobs) return;
        
        this.showPanel('jobhunt-panel');
        const availableJobs = document.getElementById('available-jobs');
        if (!availableJobs) return;
        
        availableJobs.innerHTML = '';
        
        // 筛选符合条件的工作（薪资高于当前工作或技能要求）
        const currentSalary = this.player.currentJob.salary;
        const suitableJobs = this.data.jobs.filter(job => {
            // 必须符合学历要求
            if (this.player.schoolLevel < job.schoolRequirement) return false;
            
            // 薪资必须高于当前工作至少10%
            if (job.salary <= currentSalary * 1.1) return false;
            
            return true;
        });
        
        if (suitableJobs.length === 0) {
            availableJobs.innerHTML = '<p>目前没有适合跳槽的工作机会</p>';
            return;
        }
        
        suitableJobs.forEach(job => {
            const item = document.createElement('div');
            item.className = 'list-item';
            item.innerHTML = `
                <h4>${job.name}</h4>
                <p>薪资：${job.salary.toLocaleString()} 元/月</p>
                <p>要求：${this.getSchoolRequirementName(job.schoolRequirement)}</p>
                <p>薪资提升：${((job.salary / currentSalary - 1) * 100).toFixed(0)}%</p>
                <button class="btn btn-primary" data-job-name="${job.name}">跳槽</button>
            `;
            
            const jumpBtn = item.querySelector('button');
            jumpBtn.addEventListener('click', () => {
                this.jobHunt(job);
            });
            
            availableJobs.appendChild(item);
        });
    },
    
    /**
     * 计算技能匹配度（根据工作类型判断所需技能）
     */
    calculateSkillMatch(newJob) {
        if (!this.player.skills) return 0;
        
        const jobName = newJob.name.toLowerCase();
        let requiredSkill = 'technical';
        let matchValue = 0;
        
        // 根据工作名称判断所需技能
        if (jobName.includes('技术') || jobName.includes('程序') || jobName.includes('工程师') || jobName.includes('开发')) {
            requiredSkill = 'technical';
        } else if (jobName.includes('管理') || jobName.includes('经理') || jobName.includes('总监') || jobName.includes('产品')) {
            requiredSkill = 'management';
        } else if (jobName.includes('销售') || jobName.includes('市场')) {
            requiredSkill = 'sales';
        } else {
            requiredSkill = 'communication';
        }
        
        // 计算匹配度（0-1）
        const skillValue = this.player.skills[requiredSkill] || 0;
        matchValue = Math.min(1, skillValue / 100);
        
        return matchValue;
    },
    
    /**
     * 计算跳槽成功率（复杂计算，考虑多个因素）
     */
    calculateJobHuntSuccessRate(newJob) {
        if (!this.player.currentJob) return 0;
        
        const currentSalary = this.player.currentJob.baseSalary || this.player.currentJob.salary || 0;
        const newSalary = newJob.salary || 0;
        const salaryIncrease = (newSalary - currentSalary) / currentSalary;
        
        // 基础成功率：60%
        let successRate = 60;
        
        // 技能匹配度：+0-20%
        const skillMatch = this.calculateSkillMatch(newJob);
        successRate += skillMatch * 20;
        
        // 工作表现：+0-15%
        this.updateWorkPerformanceOverall();
        const performance = this.player.workPerformance.overall;
        const performanceBonus = (performance - 50) / 50 * 15;
        successRate += performanceBonus;
        
        // 工作稳定性：+0-10%（工作月数越多，稳定性越高）
        const workMonths = this.player.workMonths || 0;
        const stabilityBonus = Math.min(10, workMonths / 12 * 10);
        successRate += stabilityBonus;
        
        // 薪资增长惩罚：薪资增长越多，成功率越低
        if (salaryIncrease > 0.3) {
            successRate -= (salaryIncrease - 0.3) * 50; // 超过30%增长，每10%降低5%成功率
        }
        
        // 工作年限惩罚：在当前工作少于6个月，成功率-20%
        if (workMonths < 6) {
            successRate -= 20;
        }
        
        return Math.max(10, Math.min(95, successRate));
    },
    
    /**
     * 执行跳槽（添加跳槽风险机制）
     */
    jobHunt(newJob) {
        if (!this.player.currentJob) return;
        
        const successRate = this.calculateJobHuntSuccessRate(newJob);
        const passed = Math.random() * 100 < successRate;
        
        if (passed) {
            const oldSalary = this.calculateFinalSalary();
            const oldBaseSalary = this.player.currentJob.baseSalary || this.player.currentJob.salary || 0;
            
            // 保存新工作的基础薪资
            this.player.currentJob = {
                name: newJob.name,
                salary: newJob.salary,
                baseSalary: newJob.salary, // 保存基础薪资
                schoolRequirement: newJob.schoolRequirement
            };
            
            // 重置工作月数和工作表现
            this.player.workMonths = 0;
            this.player.workPerformance = {
                quality: 50,
                efficiency: 50,
                teamwork: 50,
                initiative: 50,
                overall: 50
            };
            
            // 记录跳槽月份
            if (this.player.workHistory) {
                this.player.workHistory.lastJobChangeMonth = this.currentTurn || this.player.workMonths || 0;
            }
            
            const newSalary = this.calculateFinalSalary();
            const salaryIncrease = ((newSalary - oldSalary) / oldSalary) * 100;
            
            // 跳槽成功但薪资增长<20%：工作表现-3（可能是不好的选择）
            if (salaryIncrease < 20 && salaryIncrease > 0) {
                this.player.workPerformance.overall = Math.max(0, this.player.workPerformance.overall - 3);
                this.updateWorkPerformanceOverall();
                alert(`跳槽成功！从${oldSalary.toLocaleString()}元/月跳槽到${newSalary.toLocaleString()}元/月，薪资提升${salaryIncrease.toFixed(0)}%。但这次跳槽可能不是最佳选择，工作表现略有下降。`);
            } else {
                alert(`跳槽成功！从${oldSalary.toLocaleString()}元/月跳槽到${newSalary.toLocaleString()}元/月，薪资提升${salaryIncrease.toFixed(0)}%`);
            }
            
            this.updatePlayerPanel();
            this.updateWorkPanel();
            this.showPanel('work-management');
        } else {
            // 跳槽失败：当前工作表现-5，3个月内无法再次跳槽
            if (this.player.workPerformance) {
                this.player.workPerformance.overall = Math.max(0, (this.player.workPerformance.overall || 50) - 5);
                this.updateWorkPerformanceOverall();
            }
            
            // 设置跳槽冷却期（在workJobHunt中检查）
            if (this.player.workHistory) {
                this.player.workHistory.lastJobHuntFailMonth = this.player.workMonths || 0;
            }
            
            alert(`跳槽失败！成功率${successRate.toFixed(0)}%，工作表现-5。3个月内无法再次跳槽，继续努力提升技能和属性吧！`);
            this.showPanel('work-management');
        }
    },
    
    /**
     * 获取学校要求名称
     */
    getSchoolRequirementName(level) {
        const names = {
            1: '普通本科',
            2: '211大学',
            3: '985大学',
            4: '藤校'
        };
        return names[level] || '无要求';
    },
    
    /**
     * 显示培训面板
     */
    showTrainingPanel() {
        if (!this.data || !this.data.trainingCourses) {
            alert('培训数据未加载');
            return;
        }
        
        this.showPanel('training-panel');
        const coursesList = document.getElementById('training-courses');
        if (!coursesList) return;
        
        coursesList.innerHTML = '';
        
        this.data.trainingCourses.forEach(course => {
            const item = document.createElement('div');
            item.className = 'list-item';
            item.innerHTML = `
                <h4>${course.name}</h4>
                <p>费用：${course.cost.toLocaleString()} 元</p>
                <p>属性提升：${this.getAttributeName(course.attribute)}+${course.bonus}</p>
                <p>技能提升：${this.getSkillName(course.skill)}+${course.skillPoints}</p>
                <button class="btn btn-primary" data-course-id="${course.id || course.name}">参加培训</button>
            `;
            
            const enrollBtn = item.querySelector('button');
            enrollBtn.addEventListener('click', () => {
                this.enrollTraining(course);
            });
            
            coursesList.appendChild(item);
        });
    },
    
    /**
     * 参加培训
     */
    enrollTraining(course) {
        if (this.player.money < course.cost) {
            alert(`资金不足！需要${course.cost.toLocaleString()}元，当前只有${this.player.money.toLocaleString()}元`);
            return;
        }
        
        // 扣除费用
        this.player.money -= course.cost;
        
        // 提升属性
        const attrKey = this.getAttributeKey(this.getAttributeName(course.attribute));
        this.player.attributes[attrKey] = Math.min(100, this.player.attributes[attrKey] + course.bonus);
        
        // 提升技能
        this.addSkillPoints(course.skill, course.skillPoints);
        
        alert(`参加${course.name}成功！${this.getAttributeName(course.attribute)}+${course.bonus}，${this.getSkillName(course.skill)}+${course.skillPoints}`);
        
        this.updatePlayerPanel();
        this.updateWorkPanel();
        this.showPanel('work-management');
    },
    
    /**
     * 显示选择面板，可指定显示的选项
     */
    showChoicePanel(choices = ['work', 'graduate', 'startup']) {
        const choicePanel = document.getElementById('choice-panel');
        const choiceButtons = choicePanel.querySelectorAll('.btn-choice');
        
        // 隐藏所有按钮
        choiceButtons.forEach(btn => {
            btn.style.display = 'none';
        });
        
        // 显示指定的按钮
        choices.forEach(choice => {
            const btn = Array.from(choiceButtons).find(b => b.dataset.choice === choice);
            if (btn) {
                btn.style.display = 'inline-block';
            }
        });
        
        this.showPanel('choice-panel');
    },
    
    /**
     * 显示研究生选择面板
     */
    showGraduatePanel() {
        if (!this.data || !this.data.majors) {
            alert('游戏数据未加载，请刷新页面');
            return;
        }
        
        this.showPanel('graduate-panel');
        const majorList = document.getElementById('major-list');
        majorList.innerHTML = '';
        
        // 筛选符合学校要求的专业
        const availableMajors = this.data.majors.filter(major => {
            return this.player.schoolLevel >= major.schoolRequirement;
        });
        
        if (availableMajors.length === 0) {
            majorList.innerHTML = '<p>没有符合你学历要求的专业</p>';
            return;
        }
        
        availableMajors.forEach(major => {
            const item = document.createElement('div');
            item.className = 'list-item';
            
            // 获取学校要求名称
            const schoolReqNames = {
                1: '普通本科',
                2: '211大学',
                3: '985大学',
                4: '藤校'
            };
            const schoolReqName = schoolReqNames[major.schoolRequirement] || '未知';
            
            // 显示专业信息
            item.innerHTML = `
                <h4>${major.name}</h4>
                <p style="color: #666; margin: 5px 0;">${major.description}</p>
                <div style="display: flex; gap: 15px; margin-top: 8px; font-size: 12px; color: #888;">
                    <span>学位：<strong>${major.degreeType || '硕士'}</strong></span>
                    <span>要求：<strong>${schoolReqName}</strong></span>
                    <span>学制：<strong>${major.minMonths || 24}个月</strong></span>
                </div>
                ${major.researchFocus ? `<div style="margin-top: 5px; font-size: 11px; color: #999;">研究方向：${major.researchFocus.join('、')}</div>` : ''}
            `;
            item.addEventListener('click', () => {
                this.selectMajor(major);
            });
            majorList.appendChild(item);
        });
    },
    
    /**
     * 选择专业
     */
    selectMajor(major) {
        this.player.career = '学生';
        this.player.currentMajor = major;
        this.player.graduateStartTurn = this.currentTurn; // 记录开始读研究生的回合
        
        // 初始化研究生系统
        const degreeType = major.degreeType || '硕士';
        const minMonths = major.minMonths || (degreeType === '博士' ? 36 : 24);
        const minAcademicPoints = major.minAcademicPoints || (degreeType === '博士' ? 200 : 100);
        const minOverallAbility = degreeType === '博士' ? 75 : 60;
        
        this.player.graduate = {
            major: major,
            startTurn: this.currentTurn,
            studyMonths: 0,
            academicAbility: {
                research: 50,
                writing: 50,
                experiment: 50,
                overall: 50
            },
            academicPoints: 0,
            achievements: [],
            scholarship: null,
            internship: null,
            mentorRelationship: 50,
            graduationRequirement: {
                minMonths: minMonths,
                minAcademicPoints: minAcademicPoints,
                minOverallAbility: minOverallAbility
            }
        };
        
        // 初始化研究生行动使用状态
        this.player.graduateActionUsed = false;
        
        this.updatePlayerPanel();
        this.updateGraduatePanel();
        
        // 显示研究生管理面板
        this.showPanel('graduate-management');
        
        alert(`你选择了专业：${major.name}（${degreeType}），每月可获得 1000 元补助`);
    },
    
    /**
     * 更新学术能力综合评分
     */
    updateAcademicAbilityOverall() {
        if (!this.player.graduate) return;
        
        const ability = this.player.graduate.academicAbility;
        // 加权平均：研究40%，写作30%，实验30%
        ability.overall = Math.floor(
            ability.research * 0.4 + 
            ability.writing * 0.3 + 
            ability.experiment * 0.3
        );
        
        // 确保所有能力在0-100范围内
        ability.research = Math.max(0, Math.min(100, ability.research));
        ability.writing = Math.max(0, Math.min(100, ability.writing));
        ability.experiment = Math.max(0, Math.min(100, ability.experiment));
        ability.overall = Math.max(0, Math.min(100, ability.overall));
    },
    
    /**
     * 生成学术成果
     */
    generateAchievement(type, baseLevel = 'C') {
        if (!this.player.graduate) return null;
        
        const ability = this.player.graduate.academicAbility;
        const overall = ability.overall;
        
        // 根据综合能力决定成果级别
        let level = baseLevel;
        const rand = Math.random();
        if (overall >= 90 && rand < 0.1) level = 'SS';
        else if (overall >= 80 && rand < 0.2) level = 'S';
        else if (overall >= 70 && rand < 0.3) level = 'A';
        else if (overall >= 60 && rand < 0.4) level = 'B';
        else level = 'C';
        
        // 成果奖励配置
        const rewards = {
            paper: {
                C: { points: 10, writing: 2, money: 0 },
                B: { points: 20, writing: 3, money: 0 },
                A: { points: 40, writing: 5, money: 0 },
                S: { points: 80, writing: 8, money: 0 },
                SS: { points: 150, writing: 12, money: 0 }
            },
            project: {
                C: { points: 5, research: 1, money: 0 },
                B: { points: 15, research: 2, money: 0 },
                A: { points: 30, research: 4, money: 0 },
                S: { points: 60, research: 6, money: 0 },
                SS: { points: 120, research: 10, money: 0 }
            },
            competition: {
                C: { points: 5, research: 0, money: 1000 },
                B: { points: 15, research: 0, money: 3000 },
                A: { points: 30, research: 0, money: 5000 },
                S: { points: 60, research: 0, money: 10000 },
                SS: { points: 120, research: 0, money: 20000 }
            }
        };
        
        const reward = rewards[type]?.[level] || { points: 0, research: 0, writing: 0, experiment: 0, money: 0 };
        
        const achievement = {
            type: type,
            name: this.getAchievementName(type, level),
            level: level,
            academicPoints: reward.points,
            abilityBonus: {
                research: reward.research || 0,
                writing: reward.writing || 0,
                experiment: reward.experiment || 0
            },
            moneyReward: reward.money || 0,
            turn: this.currentTurn
        };
        
        return achievement;
    },
    
    /**
     * 获取成果名称
     */
    getAchievementName(type, level) {
        const names = {
            paper: {
                C: '普通期刊论文',
                B: '核心期刊论文',
                A: '顶级期刊论文',
                S: '国际顶级期刊论文',
                SS: 'Nature/Science级别论文'
            },
            project: {
                C: '小型研究项目',
                B: '中型研究项目',
                A: '大型研究项目',
                S: '重要研究项目',
                SS: '重大研究项目'
            },
            competition: {
                C: '竞赛参与奖',
                B: '竞赛三等奖',
                A: '竞赛二等奖',
                S: '竞赛一等奖',
                SS: '竞赛特等奖'
            }
        };
        return names[type]?.[level] || '未知成果';
    },
    
    /**
     * 添加学术成果
     */
    addAchievement(achievement) {
        if (!this.player.graduate || !achievement) return;
        
        this.player.graduate.achievements.push(achievement);
        this.player.graduate.academicPoints += achievement.academicPoints;
        
        // 应用能力提升
        const ability = this.player.graduate.academicAbility;
        ability.research += achievement.abilityBonus.research;
        ability.writing += achievement.abilityBonus.writing;
        ability.experiment += achievement.abilityBonus.experiment;
        this.updateAcademicAbilityOverall();
        
        // 金钱奖励
        if (achievement.moneyReward > 0) {
            this.player.money += achievement.moneyReward;
        }
        
        this.updateGraduatePanel();
    },
    
    /**
     * 努力学习
     */
    studyHard() {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/d420deeb-fad3-4d2f-a745-655aa7abb486',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'script.js:3175',message:'studyHard called',data:{graduateActionUsed:this.player.graduateActionUsed,hasGraduate:!!this.player.graduate,currentTurn:this.currentTurn},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        
        if (!this.player.graduate) {
            alert('你不在读研究生');
            return;
        }
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/d420deeb-fad3-4d2f-a745-655aa7abb486',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'script.js:3185',message:'Checking action used flag',data:{graduateActionUsed:this.player.graduateActionUsed},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        
        if (this.player.graduateActionUsed) {
            alert('本回合已经执行过行动了');
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/d420deeb-fad3-4d2f-a745-655aa7abb486',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'script.js:3190',message:'Action blocked - already used',data:{graduateActionUsed:this.player.graduateActionUsed},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'A'})}).catch(()=>{});
            // #endregion
            return;
        }
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/d420deeb-fad3-4d2f-a745-655aa7abb486',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'script.js:3195',message:'Setting action used flag',data:{before:this.player.graduateActionUsed},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        
        this.player.graduateActionUsed = true;
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/d420deeb-fad3-4d2f-a745-655aa7abb486',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'script.js:3200',message:'Action used flag set to true',data:{after:this.player.graduateActionUsed},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        
        // 随机提升学术能力
        const ability = this.player.graduate.academicAbility;
        const bonus = this.randomInt(1, 3);
        const abilityType = ['research', 'writing', 'experiment'][this.randomInt(0, 2)];
        ability[abilityType] += bonus;
        this.updateAcademicAbilityOverall();
        
        // 获得学术积分
        const points = this.randomInt(2, 5);
        this.player.graduate.academicPoints += points;
        
        this.updateGraduatePanel();
        this.updatePlayerPanel();
        alert(`努力学习完成！${abilityType === 'research' ? '研究' : abilityType === 'writing' ? '写作' : '实验'}能力+${bonus}，学术积分+${points}`);
    },
    
    /**
     * 进行研究
     */
    doResearch() {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/d420deeb-fad3-4d2f-a745-655aa7abb486',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'script.js:3207',message:'doResearch called',data:{graduateActionUsed:this.player.graduateActionUsed},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        
        if (!this.player.graduate) {
            alert('你不在读研究生');
            return;
        }
        
        if (this.player.graduateActionUsed) {
            alert('本回合已经执行过行动了');
            return;
        }
        
        this.player.graduateActionUsed = true;
        
        // 智商检定（难度60）
        const checkValue = this.randomInt(1, 100);
        const difficulty = 60;
        const success = checkValue + this.player.attributes.intelligence >= difficulty;
        
        if (success) {
            // 研究能力提升
            const ability = this.player.graduate.academicAbility;
            const bonus = this.randomInt(2, 5);
            ability.research += bonus;
            this.updateAcademicAbilityOverall();
            
            // 获得学术积分
            const points = this.randomInt(5, 10);
            this.player.graduate.academicPoints += points;
            
            // 可能获得项目成果
            if (Math.random() < 0.3) {
                const achievement = this.generateAchievement('project', 'C');
                this.addAchievement(achievement);
                alert(`研究成功！研究能力+${bonus}，学术积分+${points}，获得成果：${achievement.name}`);
            } else {
                alert(`研究成功！研究能力+${bonus}，学术积分+${points}`);
            }
        } else {
            alert('研究遇到困难，需要更多努力');
        }
        
        this.updateGraduatePanel();
        this.updatePlayerPanel();
    },
    
    /**
     * 写论文
     */
    writePaper() {
        if (!this.player.graduate) {
            alert('你不在读研究生');
            return;
        }
        
        if (this.player.graduateActionUsed) {
            alert('本回合已经执行过行动了');
            return;
        }
        
        this.player.graduateActionUsed = true;
        
        // 写作能力检定（难度70）
        const ability = this.player.graduate.academicAbility;
        const checkValue = this.randomInt(1, 100);
        const difficulty = 70;
        const success = checkValue + ability.writing >= difficulty;
        
        if (success) {
            // 写作能力提升
            const bonus = this.randomInt(3, 6);
            ability.writing += bonus;
            this.updateAcademicAbilityOverall();
            
            // 获得学术积分
            const points = this.randomInt(10, 30);
            this.player.graduate.academicPoints += points;
            
            // 可能发表论文
            if (Math.random() < 0.5) {
                const achievement = this.generateAchievement('paper', 'C');
                this.addAchievement(achievement);
                alert(`论文写作成功！写作能力+${bonus}，学术积分+${points}，发表论文：${achievement.name}`);
            } else {
                alert(`论文写作成功！写作能力+${bonus}，学术积分+${points}`);
            }
        } else {
            alert('论文写作遇到困难，需要提升写作能力');
        }
        
        this.updateGraduatePanel();
        this.updatePlayerPanel();
    },
    
    /**
     * 做实验
     */
    doExperiment() {
        if (!this.player.graduate) {
            alert('你不在读研究生');
            return;
        }
        
        if (this.player.graduateActionUsed) {
            alert('本回合已经执行过行动了');
            return;
        }
        
        this.player.graduateActionUsed = true;
        
        // 实验能力检定（难度65）
        const ability = this.player.graduate.academicAbility;
        const checkValue = this.randomInt(1, 100);
        const difficulty = 65;
        const success = checkValue + ability.experiment >= difficulty;
        
        if (success) {
            // 实验能力提升
            const bonus = this.randomInt(2, 5);
            ability.experiment += bonus;
            this.updateAcademicAbilityOverall();
            
            // 获得学术积分
            const points = this.randomInt(5, 15);
            this.player.graduate.academicPoints += points;
            
            alert(`实验成功！实验能力+${bonus}，学术积分+${points}`);
        } else {
            alert('实验遇到困难，需要提升实验能力');
        }
        
        this.updateGraduatePanel();
        this.updatePlayerPanel();
    },
    
    /**
     * 参加学术会议
     */
    attendConference() {
        if (!this.player.graduate) {
            alert('你不在读研究生');
            return;
        }
        
        if (this.player.graduateActionUsed) {
            alert('本回合已经执行过行动了');
            return;
        }
        
        if (this.player.money < 2000) {
            alert('资金不足，无法参加学术会议（需要2000元）');
            return;
        }
        
        this.player.graduateActionUsed = true;
        
        this.player.money -= 2000;
        
        // 学术能力提升
        const ability = this.player.graduate.academicAbility;
        const bonus = this.randomInt(1, 3);
        const abilityType = ['research', 'writing', 'experiment'][this.randomInt(0, 2)];
        ability[abilityType] += bonus;
        this.updateAcademicAbilityOverall();
        
        // 获得学术积分
        const points = this.randomInt(5, 10);
        this.player.graduate.academicPoints += points;
        
        // 可能获得合作机会
        if (Math.random() < 0.2) {
            this.player.graduate.mentorRelationship += this.randomInt(2, 5);
            alert(`参加学术会议成功！${abilityType === 'research' ? '研究' : abilityType === 'writing' ? '写作' : '实验'}能力+${bonus}，学术积分+${points}，获得合作机会，导师关系提升`);
        } else {
            alert(`参加学术会议成功！${abilityType === 'research' ? '研究' : abilityType === 'writing' ? '写作' : '实验'}能力+${bonus}，学术积分+${points}`);
        }
        
        this.updateGraduatePanel();
        this.updatePlayerPanel();
    },
    
    /**
     * 参加竞赛
     */
    joinCompetition() {
        if (!this.player.graduate) {
            alert('你不在读研究生');
            return;
        }
        
        if (this.player.graduateActionUsed) {
            alert('本回合已经执行过行动了');
            return;
        }
        
        this.player.graduateActionUsed = true;
        
        // 综合能力检定（难度75）
        const ability = this.player.graduate.academicAbility;
        const checkValue = this.randomInt(1, 100);
        const difficulty = 75;
        const success = checkValue + ability.overall >= difficulty;
        
        if (success) {
            // 获得成果
            const achievement = this.generateAchievement('competition', 'C');
            this.addAchievement(achievement);
            alert(`竞赛成功！获得：${achievement.name}，学术积分+${achievement.academicPoints}，奖金+${achievement.moneyReward}元`);
        } else {
            alert('竞赛未获奖，但获得了宝贵的经验');
            // 即使失败也获得少量积分
            this.player.graduate.academicPoints += 2;
        }
        
        this.updateGraduatePanel();
        this.updatePlayerPanel();
    },
    
    /**
     * 寻找实习
     */
    findInternship() {
        if (!this.player.graduate) {
            alert('你不在读研究生');
            return;
        }
        
        if (this.player.graduateActionUsed) {
            alert('本回合已经执行过行动了');
            return;
        }
        
        if (this.player.graduate.internship) {
            alert('你已经有一份实习了');
            return;
        }
        
        this.player.graduateActionUsed = true;
        
        // 沟通检定（难度60）
        const checkValue = this.randomInt(1, 100);
        const difficulty = 60;
        const success = checkValue + this.player.attributes.communication >= difficulty;
        
        if (success) {
            // 获得实习
            const monthlyIncome = this.randomInt(3000, 8000);
            this.player.graduate.internship = {
                monthlyIncome: monthlyIncome,
                startTurn: this.currentTurn
            };
            
            // 获得学术积分
            const points = this.randomInt(5, 10);
            this.player.graduate.academicPoints += points;
            
            alert(`找到实习！每月收入+${monthlyIncome}元，学术积分+${points}`);
        } else {
            alert('寻找实习失败，需要提升沟通能力');
        }
        
        this.updateGraduatePanel();
        this.updatePlayerPanel();
    },
    
    /**
     * 学术社交
     */
    socialize() {
        if (!this.player.graduate) {
            alert('你不在读研究生');
            return;
        }
        
        if (this.player.graduateActionUsed) {
            alert('本回合已经执行过行动了');
            return;
        }
        
        this.player.graduateActionUsed = true;
        
        // 沟通检定（难度50）
        const checkValue = this.randomInt(1, 100);
        const difficulty = 50;
        const success = checkValue + this.player.attributes.communication >= difficulty;
        
        if (success) {
            // 提升导师关系
            const mentorBonus = this.randomInt(2, 5);
            this.player.graduate.mentorRelationship = Math.min(100, 
                this.player.graduate.mentorRelationship + mentorBonus);
            
            // 提升人脉值
            const networkBonus = this.randomInt(1, 3);
            this.player.networkValue += networkBonus;
            
            alert(`学术社交成功！导师关系+${mentorBonus}，人脉值+${networkBonus}`);
        } else {
            alert('学术社交效果不佳');
        }
        
        this.updateGraduatePanel();
        this.updatePlayerPanel();
    },
    
    /**
     * 申请奖学金
     */
    applyScholarship() {
        if (!this.player.graduate) {
            alert('你不在读研究生');
            return;
        }
        
        // 申请奖学金不受行动限制（一次性操作）
        if (this.player.graduate.scholarship) {
            alert('你已经获得奖学金了');
            return;
        }
        
        // 综合能力检定（难度根据当前能力）
        const ability = this.player.graduate.academicAbility;
        const difficulty = 80 - Math.floor(ability.overall / 2); // 能力越高难度越低
        const checkValue = this.randomInt(1, 100);
        const success = checkValue + ability.overall >= difficulty;
        
        if (success) {
            // 根据能力决定奖学金等级
            let scholarshipLevel = '普通';
            let monthlyIncome = 1000;
            if (ability.overall >= 90) {
                scholarshipLevel = '特等';
                monthlyIncome = 5000;
            } else if (ability.overall >= 80) {
                scholarshipLevel = '优秀';
                monthlyIncome = 3000;
            } else if (ability.overall >= 70) {
                scholarshipLevel = '普通';
                monthlyIncome = 2000;
            }
            
            this.player.graduate.scholarship = {
                level: scholarshipLevel,
                monthlyIncome: monthlyIncome
            };
            
            alert(`申请奖学金成功！获得${scholarshipLevel}奖学金，每月额外收入+${monthlyIncome}元`);
        } else {
            alert('申请奖学金失败，需要提升学术能力');
        }
        
        this.updateGraduatePanel();
        this.updatePlayerPanel();
    },
    
    /**
     * 计算研究生事件触发概率
     */
    calculateGraduateEventProbability() {
        if (!this.player.graduate) return 0;
        
        const graduate = this.player.graduate;
        const ability = graduate.academicAbility.overall;
        
        // 基础概率30%
        let probability = 0.3;
        
        // 学术能力影响：能力越高，触发概率越高（最高50%）
        probability += (ability / 100) * 0.2;
        
        // 学习进度影响：学习越久，触发概率略增（最多+5%）
        const studyProgress = Math.min(1.0, graduate.studyMonths / graduate.graduationRequirement.minMonths);
        probability += studyProgress * 0.05;
        
        // 导师关系影响：关系越好，触发概率略增（最多+5%）
        const mentorBonus = (graduate.mentorRelationship / 100) * 0.05;
        probability += mentorBonus;
        
        return Math.min(0.5, Math.max(0.3, probability));
    },
    
    /**
     * 计算研究生事件难度
     */
    calculateGraduateEventDifficulty(event) {
        if (!this.player.graduate) {
            return event.baseDifficulty || 50;
        }
        
        const graduate = this.player.graduate;
        const ability = graduate.academicAbility.overall;
        const studyMonths = graduate.studyMonths;
        const mentorRelationship = graduate.mentorRelationship;
        
        // 基础难度
        let difficulty = event.baseDifficulty || 50;
        
        // 学术能力调整：能力越高，难度越低（最多降低30点）
        const abilityAdjustment = -Math.floor(ability / 3.3);
        
        // 学习进度调整：学习越久，经验越丰富，难度降低（最多降低10点）
        const studyProgress = Math.min(1.0, studyMonths / graduate.graduationRequirement.minMonths);
        const studyAdjustment = -Math.floor(studyProgress * 10);
        
        // 导师关系调整：关系越好，获得指导，难度降低（最多降低10点）
        const mentorAdjustment = -Math.floor(mentorRelationship / 10);
        
        // 根据事件类型调整
        let typeAdjustment = 0;
        if (event.type === 'opportunity') {
            // 机遇事件难度稍高
            typeAdjustment = 5;
        } else if (event.type === 'challenge') {
            // 挑战事件难度较高
            typeAdjustment = 10;
        } else if (event.type === 'life' && event.category === 'mentor') {
            // 导师相关事件，根据导师关系大幅调整
            typeAdjustment = -Math.floor(mentorRelationship / 5);
        }
        
        difficulty = difficulty + abilityAdjustment + studyAdjustment + mentorAdjustment + typeAdjustment;
        
        // 限制难度范围在20-90之间
        return Math.max(20, Math.min(90, difficulty));
    },
    
    /**
     * 筛选可用的研究生事件
     */
    filterAvailableGraduateEvents() {
        if (!this.data || !this.data.events || !this.data.events.graduate) {
            return [];
        }
        
        const graduate = this.player.graduate;
        if (!graduate) return [];
        
        const ability = graduate.academicAbility.overall;
        const studyMonths = graduate.studyMonths;
        const hasInternship = !!graduate.internship;
        const hasScholarship = !!graduate.scholarship;
        const mentorRelationship = graduate.mentorRelationship;
        
        // 筛选可用事件
        return this.data.events.graduate.filter(event => {
            // 检查特殊条件
            if (event.specialConditions) {
                const conditions = event.specialConditions;
                
                // 检查最低学术能力要求
                if (conditions.minAcademicAbility && ability < conditions.minAcademicAbility) {
                    return false;
                }
                
                // 检查是否需要实习
                if (conditions.requiresInternship && !hasInternship) {
                    return false;
                }
                
                // 检查是否需要奖学金
                if (conditions.requiresScholarship && !hasScholarship) {
                    return false;
                }
            }
            
            // 根据事件类型和当前状态调整可用性
            if (event.type === 'opportunity' && event.category === 'internship' && !hasInternship) {
                return false; // 没有实习时，实习转正机会不可用
            }
            
            return true;
        });
    },
    
    /**
     * 提前毕业
     */
    graduateEarly() {
        if (!this.player.graduate) {
            alert('你不在读研究生');
            return;
        }
        
        const graduate = this.player.graduate;
        const req = graduate.graduationRequirement;
        const studyMonths = this.currentTurn - graduate.startTurn;
        const minMonthsForEarly = Math.ceil(req.minMonths * 0.8);
        
        // 检查是否满足提前毕业条件
        if (studyMonths < minMonthsForEarly) {
            alert(`提前毕业需要至少学习${minMonthsForEarly}个月（当前${studyMonths}个月）`);
            return;
        }
        
        if (graduate.academicPoints < req.minAcademicPoints) {
            alert(`提前毕业需要至少${req.minAcademicPoints}学术积分（当前${graduate.academicPoints}分）`);
            return;
        }
        
        if (graduate.academicAbility.overall < req.minOverallAbility) {
            alert(`提前毕业需要至少${req.minOverallAbility}综合能力（当前${graduate.academicAbility.overall}分）`);
            return;
        }
        
        // 提前毕业奖励
        this.player.attributes.intelligence += 5;
        this.player.money += 10000;
        
        // 执行毕业
        this.graduate();
        
        alert(`提前毕业成功！获得额外属性+5，金钱+10000元`);
    },
    
    /**
     * 毕业
     */
    graduate() {
        if (!this.player.graduate) return;
        
        // 提升学历等级
        if (this.player.degreeLevel < 3) {
            this.player.degreeLevel++;
            const newDegree = this.data.degrees.find(d => d.level === this.player.degreeLevel);
            if (newDegree) {
                this.player.education = `${newDegree.name} - ${this.player.school}`;
            }
        }
        
        // 根据学术成果提升属性
        const achievements = this.player.graduate.achievements;
        const achievementBonus = Math.min(10, achievements.length * 2);
        this.player.attributes.intelligence += achievementBonus;
        
        // 清理研究生状态
        this.player.career = '待业';
        this.player.currentMajor = null;
        this.player.graduateStartTurn = 0;
        this.player.graduate = null;
        
        this.updatePlayerPanel();
        this.showChoicePanel(['work', 'graduate', 'startup']);
    },
    
    /**
     * 更新研究生管理面板
     */
    updateGraduatePanel() {
        if (!this.player.graduate) return;
        
        const graduate = this.player.graduate;
        const major = graduate.major;
        const ability = graduate.academicAbility;
        const req = graduate.graduationRequirement;
        const studyMonths = this.currentTurn - graduate.startTurn;
        
        // 更新专业信息
        const majorNameEl = document.getElementById('graduate-major-name');
        if (majorNameEl) majorNameEl.textContent = `${major.name}（${major.degreeType || '硕士'}）`;
        
        // 更新学习进度
        const studyProgressEl = document.getElementById('graduate-study-progress');
        if (studyProgressEl) {
            studyProgressEl.textContent = `${studyMonths}/${req.minMonths} 个月`;
        }
        
        // 更新学术能力
        const researchEl = document.getElementById('graduate-research-ability');
        if (researchEl) researchEl.textContent = ability.research;
        const writingEl = document.getElementById('graduate-writing-ability');
        if (writingEl) writingEl.textContent = ability.writing;
        const experimentEl = document.getElementById('graduate-experiment-ability');
        if (experimentEl) experimentEl.textContent = ability.experiment;
        const overallEl = document.getElementById('graduate-overall-ability');
        if (overallEl) overallEl.textContent = ability.overall;
        
        // 更新学术积分
        const pointsEl = document.getElementById('graduate-academic-points');
        if (pointsEl) {
            pointsEl.textContent = `${graduate.academicPoints}/${req.minAcademicPoints}`;
        }
        
        // 更新成果列表
        const achievementsListEl = document.getElementById('graduate-achievements-list');
        if (achievementsListEl) {
            achievementsListEl.innerHTML = '';
            if (graduate.achievements.length === 0) {
                achievementsListEl.innerHTML = '<p style="color: #666;">暂无学术成果</p>';
            } else {
                graduate.achievements.forEach(achievement => {
                    const item = document.createElement('div');
                    item.style.cssText = 'padding: 8px; margin-bottom: 5px; background: #f8f9fa; border-radius: 5px;';
                    item.innerHTML = `
                        <strong>${achievement.name}</strong>
                        <span style="color: #666; font-size: 12px; margin-left: 10px;">${achievement.level}级</span>
                        <span style="color: #28a745; font-size: 12px; margin-left: 10px;">+${achievement.academicPoints}分</span>
                    `;
                    achievementsListEl.appendChild(item);
                });
            }
        }
        
        // 更新奖学金状态
        const scholarshipEl = document.getElementById('graduate-scholarship');
        if (scholarshipEl) {
            if (graduate.scholarship) {
                scholarshipEl.textContent = `${graduate.scholarship.level}奖学金（+${graduate.scholarship.monthlyIncome}元/月）`;
            } else {
                scholarshipEl.textContent = '无';
            }
        }
        
        // 更新实习状态
        const internshipEl = document.getElementById('graduate-internship');
        if (internshipEl) {
            if (graduate.internship) {
                internshipEl.textContent = `实习中（+${graduate.internship.monthlyIncome}元/月）`;
            } else {
                internshipEl.textContent = '无';
            }
        }
        
        // 更新导师关系
        const mentorEl = document.getElementById('graduate-mentor-relationship');
        if (mentorEl) mentorEl.textContent = graduate.mentorRelationship;
        
        // 更新提前毕业按钮显示
        const earlyGraduateBtn = document.getElementById('graduate-early-btn');
        if (earlyGraduateBtn) {
            const canEarlyGraduate = studyMonths >= Math.ceil(req.minMonths * 0.8) &&
                                    graduate.academicPoints >= req.minAcademicPoints &&
                                    ability.overall >= req.minOverallAbility;
            earlyGraduateBtn.style.display = canEarlyGraduate ? 'block' : 'none';
        }
    },
    
    /**
     * 显示创业行业选择面板
     */
    showStartupPanel() {
        if (!this.data || !this.data.industries) {
            alert('游戏数据未加载，请刷新页面');
            return;
        }
        
        this.showPanel('startup-panel');
        const industryList = document.getElementById('industry-list');
        industryList.innerHTML = '';
        
        this.data.industries.forEach(industry => {
            const item = document.createElement('div');
            item.className = 'list-item';
            
            // 获取行业属性值（兼容旧数据）
            const competition = industry.competition || 50;
            const techThreshold = industry.techThreshold || 50;
            const capitalNeed = industry.capitalNeed || 50;
            const growthPotential = industry.growthPotential || 50;
            
            // 计算影响说明
            const revenueImpact = ((industry.revenueMultiplier || 1.0) - 1.0) * 100;
            const fundingImpact = industry.fundingDifficulty || 0;
            const valuationImpact = ((industry.valuationMultiplier || 1.0) - 1.0) * 100;
            
            item.innerHTML = `
                <h4>${industry.name}</h4>
                <p>${industry.description}</p>
                <div style="margin-top: 10px; padding: 10px; background: #f8f9fa; border-radius: 5px;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px;">
                        <div>
                            <span style="color: #666;">竞争度：</span>
                            <span style="font-weight: bold; color: ${competition > 70 ? '#dc3545' : competition > 40 ? '#ffc107' : '#28a745'};">${competition}</span>
                            <div style="width: 100%; height: 4px; background: #e9ecef; border-radius: 2px; margin-top: 2px;">
                                <div style="width: ${competition}%; height: 100%; background: ${competition > 70 ? '#dc3545' : competition > 40 ? '#ffc107' : '#28a745'}; border-radius: 2px;"></div>
                            </div>
                        </div>
                        <div>
                            <span style="color: #666;">技术门槛：</span>
                            <span style="font-weight: bold; color: ${techThreshold > 70 ? '#dc3545' : techThreshold > 40 ? '#ffc107' : '#28a745'};">${techThreshold}</span>
                            <div style="width: 100%; height: 4px; background: #e9ecef; border-radius: 2px; margin-top: 2px;">
                                <div style="width: ${techThreshold}%; height: 100%; background: ${techThreshold > 70 ? '#dc3545' : techThreshold > 40 ? '#ffc107' : '#28a745'}; border-radius: 2px;"></div>
                            </div>
                        </div>
                        <div>
                            <span style="color: #666;">资金需求：</span>
                            <span style="font-weight: bold; color: ${capitalNeed > 70 ? '#dc3545' : capitalNeed > 40 ? '#ffc107' : '#28a745'};">${capitalNeed}</span>
                            <div style="width: 100%; height: 4px; background: #e9ecef; border-radius: 2px; margin-top: 2px;">
                                <div style="width: ${capitalNeed}%; height: 100%; background: ${capitalNeed > 70 ? '#dc3545' : capitalNeed > 40 ? '#ffc107' : '#28a745'}; border-radius: 2px;"></div>
                            </div>
                        </div>
                        <div>
                            <span style="color: #666;">成长潜力：</span>
                            <span style="font-weight: bold; color: ${growthPotential > 70 ? '#28a745' : growthPotential > 40 ? '#ffc107' : '#dc3545'};">${growthPotential}</span>
                            <div style="width: 100%; height: 4px; background: #e9ecef; border-radius: 2px; margin-top: 2px;">
                                <div style="width: ${growthPotential}%; height: 100%; background: ${growthPotential > 70 ? '#28a745' : growthPotential > 40 ? '#ffc107' : '#dc3545'}; border-radius: 2px;"></div>
                            </div>
                        </div>
                    </div>
                    <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid #dee2e6; font-size: 11px; color: #666;">
                        <div>收益影响：<span style="color: ${revenueImpact >= 0 ? '#28a745' : '#dc3545'}">${revenueImpact >= 0 ? '+' : ''}${revenueImpact.toFixed(0)}%</span></div>
                        <div>融资难度：<span style="color: ${fundingImpact >= 0 ? '#28a745' : '#dc3545'}">${fundingImpact >= 0 ? '+' : ''}${fundingImpact}%</span></div>
                        <div>估值倍数：<span style="color: ${valuationImpact >= 0 ? '#28a745' : '#dc3545'}">${valuationImpact >= 0 ? '+' : ''}${valuationImpact.toFixed(0)}%</span></div>
                    </div>
                </div>
            `;
            item.addEventListener('click', () => {
                this.selectIndustry(industry);
            });
            industryList.appendChild(item);
        });
    },
    
    /**
     * 选择行业
     */
    selectIndustry(industry) {
        this.player.startup = {
            industry: industry,
            balance: 0,
            employees: [],
            projects: [],
            fundingRound: 0, // 0=种子轮, 1=天使轮, ...
            valuation: 0,
            loans: [], // 贷款列表
            fundingHistory: [], // 融资历史
            // 玩家作为默认员工
            playerEmployee: {
                name: this.player.name,
                position: '产品', // 默认岗位
                salary: 0, // 默认工资为0，玩家可以设置
                isPlayer: true // 标记为玩家
            }
        };
        this.showPanel('funding-panel');
    },
    
    /**
     * 处理融资选择
     */
    handleFundingChoice(fundingType) {
        switch(fundingType) {
            case 'deposit':
                document.getElementById('deposit-input').classList.remove('hidden');
                break;
            case 'loan':
                this.handleLoan();
                break;
            case 'investment':
                this.handleInvestment();
                break;
        }
    },
    
    /**
     * 处理无息贷款
     */
    handleLoan() {
        let loanAmount = 0;
        if (this.player.degreeLevel === 1) {
            loanAmount = 100000; // 学士10万
        } else if (this.player.degreeLevel === 2) {
            loanAmount = 300000; // 硕士30万
        } else if (this.player.degreeLevel === 3) {
            loanAmount = 500000; // 博士50万
        }
        
        this.player.startup.balance = loanAmount;
        
        // 添加无息贷款记录
        if (!this.player.startup.loans) {
            this.player.startup.loans = [];
        }
        this.player.startup.loans.push({
            id: Date.now(),
            type: 'interest_free',
            amount: loanAmount,
            remainingAmount: loanAmount,
            monthlyPayment: loanAmount / 24,
            remainingMonths: 24,
            totalMonths: 24,
            interestRate: 0,
            startTurn: this.currentTurn
        });
        
        this.player.money -= 0; // 无息贷款不影响个人存款
        this.startStartup();
        alert(`你获得了 ${loanAmount.toLocaleString()} 元无息贷款，需在24个月内还清`);
    },
    
    /**
     * 确认存款投入
     */
    confirmDeposit() {
        const amount = parseInt(document.getElementById('deposit-amount').value);
        if (!amount || amount <= 0) {
            alert('请输入有效金额');
            return;
        }
        if (amount > this.player.money) {
            alert('存款不足');
            return;
        }
        
        this.player.startup.balance = amount;
        this.player.money -= amount;
        this.updatePlayerPanel();
        this.startStartup();
        alert(`你投入了 ${amount.toLocaleString()} 元启动资金`);
    },
    
    /**
     * 处理融资
     */
    handleInvestment() {
        // 计算融资额：100 x (1 + 学校等级x0.5 + 学历等级x0.3 + 工作年限x0.2) 万元
        const schoolMultiplier = this.player.schoolLevel * 0.5;
        const degreeMultiplier = this.player.degreeLevel * 0.3;
        const workMultiplier = this.player.workYears * 0.2;
        const investmentAmount = 100 * (1 + schoolMultiplier + degreeMultiplier + workMultiplier);
        
        // 计算属性总和
        const totalAttributes = 
            this.player.attributes.energy +
            this.player.attributes.intelligence +
            this.player.attributes.communication +
            this.player.attributes.luck +
            this.player.attributes.ideal;
        
        // 如果属性总和小于400，融资失败
        if (totalAttributes < 400) {
            alert('融资失败！你的综合属性不足（需要400以上）');
            return;
        }
        
        this.player.startup.balance = investmentAmount * 10000; // 转换为元
        // 应用行业估值倍数影响
        let valuationMultiplier = 10.0; // 基础倍数
        if (this.player.startup.industry) {
            const industry = this.player.startup.industry;
            const baseValuationMultiplier = industry.valuationMultiplier || 1.0;
            const growthPotential = industry.growthPotential || 50;
            // 成长潜力影响估值倍数（最高+2.0倍）
            const growthValuationBonus = (growthPotential / 100) * 2.0;
            valuationMultiplier = 10.0 * baseValuationMultiplier * (1 + growthValuationBonus);
        }
        const finalValuation = investmentAmount * valuationMultiplier; // 公司估值为融资额×行业调整倍数
        this.player.startup.valuation = finalValuation;
        this.player.startup.fundingRound = 1; // 天使轮
        
        // 记录融资历史
        if (!this.player.startup.fundingHistory) {
            this.player.startup.fundingHistory = [];
        }
        this.player.startup.fundingHistory.push({
            round: this.data.fundingRounds[1], // 天使轮
            amount: investmentAmount * 10000,
            valuation: finalValuation * 10000,
            turn: this.currentTurn
        });
        
        this.startStartup();
        alert(`融资成功！获得 ${(investmentAmount).toLocaleString()} 万元，公司估值 ${finalValuation.toLocaleString()} 万元`);
    },
    
    /**
     * 开始创业
     */
    startStartup() {
        this.player.career = '创业者';
        
        // 确保玩家员工已初始化
        if (!this.player.startup.playerEmployee) {
            this.player.startup.playerEmployee = {
                name: this.player.name,
                position: '产品', // 默认岗位
                salary: 0, // 默认工资为0
                isPlayer: true
            };
        }
        
        this.updatePlayerPanel();
        this.updateStartupPanel();
        // 隐藏选择面板，显示创业管理面板
        const choicePanel = document.getElementById('choice-panel');
        if (choicePanel) {
            choicePanel.classList.add('hidden');
        }
        this.showPanel('startup-management');
    },
    
    /**
     * 计算可贷款额度
     */
    calculateLoanEligibility() {
        if (!this.player.startup) return 0;
        
        // 检查是否有逾期贷款
        const hasOverdue = this.player.startup.loans && 
            this.player.startup.loans.some(loan => loan.remainingAmount > 0 && this.player.startup.balance < loan.monthlyPayment);
        
        if (hasOverdue || this.player.startup.balance <= 0) {
            return 0; // 有逾期或账户余额为0，不能贷款
        }
        
        // 可贷款额度 = 公司估值 × 0.3（最高不超过500万）
        const maxLoan = Math.min(this.player.startup.valuation * 10000 * 0.3, 5000000);
        return Math.max(0, maxLoan);
    },
    
    /**
     * 显示贷款申请面板
     */
    showLoanPanel() {
        if (!this.player.startup) return;
        
        const maxLoan = this.calculateLoanEligibility();
        
        if (maxLoan <= 0) {
            alert('当前不符合贷款条件：\n1. 公司账户余额需大于0\n2. 无逾期贷款\n3. 公司估值需大于0');
            return;
        }
        
        document.getElementById('max-loan-amount').textContent = maxLoan.toLocaleString();
        
        // 计算年利率（根据公司状态：5%-10%）
        const baseRate = 5;
        const riskRate = this.player.startup.balance < 100000 ? 3 : 0; // 余额低增加风险
        const interestRate = baseRate + riskRate;
        document.getElementById('loan-interest-rate').textContent = interestRate;
        
        // 重置输入
        document.getElementById('loan-amount-input').value = '';
        document.getElementById('loan-months-select').value = '24';
        this.updateLoanPreview();
        
        this.showPanel('loan-panel');
    },
    
    /**
     * 更新贷款预览信息
     */
    updateLoanPreview() {
        const amount = parseInt(document.getElementById('loan-amount-input').value) || 0;
        const months = parseInt(document.getElementById('loan-months-select').value) || 24;
        const interestRate = parseFloat(document.getElementById('loan-interest-rate').textContent) || 5;
        
        if (amount <= 0) {
            document.getElementById('loan-monthly-payment').textContent = '0';
            document.getElementById('loan-total-interest').textContent = '0';
            return;
        }
        
        // 计算总利息（简单利息）
        const totalInterest = amount * (interestRate / 100) * (months / 12);
        const totalAmount = amount + totalInterest;
        const monthlyPayment = totalAmount / months;
        
        document.getElementById('loan-monthly-payment').textContent = monthlyPayment.toFixed(2);
        document.getElementById('loan-total-interest').textContent = totalInterest.toFixed(2);
    },
    
    /**
     * 申请贷款
     */
    applyForLoan() {
        if (!this.player.startup) return;
        
        const amount = parseInt(document.getElementById('loan-amount-input').value);
        const months = parseInt(document.getElementById('loan-months-select').value);
        const interestRate = parseFloat(document.getElementById('loan-interest-rate').textContent);
        
        if (!amount || amount <= 0) {
            alert('请输入有效的贷款金额');
            return;
        }
        
        const maxLoan = this.calculateLoanEligibility();
        if (amount > maxLoan) {
            alert(`贷款金额超过可贷款额度！最多可申请 ${maxLoan.toLocaleString()} 元`);
            return;
        }
        
        // 计算总利息和每月还款
        const totalInterest = amount * (interestRate / 100) * (months / 12);
        const totalAmount = amount + totalInterest;
        const monthlyPayment = totalAmount / months;
        
        // 添加贷款记录
        if (!this.player.startup.loans) {
            this.player.startup.loans = [];
        }
        
        this.player.startup.loans.push({
            id: Date.now(),
            type: 'bank_loan',
            amount: amount,
            remainingAmount: totalAmount,
            monthlyPayment: monthlyPayment,
            remainingMonths: months,
            totalMonths: months,
            interestRate: interestRate,
            startTurn: this.currentTurn
        });
        
        // 将贷款金额加入公司账户
        this.player.startup.balance += amount;
        
        alert(`贷款申请成功！\n贷款金额：${amount.toLocaleString()} 元\n年利率：${interestRate}%\n期限：${months} 个月\n每月还款：${monthlyPayment.toFixed(2)} 元`);
        
        this.updateStartupPanel();
        this.showPanel('startup-management');
    },
    
    /**
     * 计算可融资金额
     */
    calculateFundingAmount() {
        if (!this.player.startup) return 0;
        
        const currentRound = this.player.startup.fundingRound;
        const maxRound = this.data.fundingRounds.length - 1;
        
        if (currentRound >= maxRound) {
            return 0; // 已经上市，不能再融资
        }
        
        // 基础融资金额 = 当前估值 × (0.2 + 轮次系数)
        const roundMultipliers = [0.2, 0.3, 0.4, 0.5, 0.6, 0.7]; // 种子轮、天使轮、A轮、B轮、C轮、D轮
        const multiplier = roundMultipliers[currentRound] || 0.2;
        
        // 考虑项目数量和员工数量
        const projectBonus = Math.min(this.player.startup.projects.length * 0.1, 0.3);
        const employeeBonus = Math.min(this.player.startup.employees.length * 0.05, 0.2);
        
        // 新增：行业融资难度影响
        let industryFundingBonus = 0;
        let fundingMultiplier = 1.0;
        if (this.player.startup.industry) {
            const industry = this.player.startup.industry;
            
            // 行业融资难度调整（-15到+15）
            const fundingDifficulty = industry.fundingDifficulty || 0;
            fundingMultiplier = 1.0 + fundingDifficulty / 100; // -15%到+15%
            
            // 竞争度影响：高竞争度行业更容易融资（但估值可能较低）
            const competition = industry.competition || 50;
            const competitionBonus = (competition / 100) * 0.15; // 最高+15%
            
            // 成长潜力影响：高成长潜力行业更容易融资
            const growthPotential = industry.growthPotential || 50;
            const growthBonus = (growthPotential / 100) * 0.1; // 最高+10%
            
            industryFundingBonus = competitionBonus + growthBonus;
        }
        
        const finalMultiplier = multiplier + projectBonus + employeeBonus + industryFundingBonus;
        const fundingAmount = (this.player.startup.valuation * 10000) * finalMultiplier * fundingMultiplier;
        
        return Math.max(0, fundingAmount);
    },
    
    /**
     * 显示融资申请面板
     */
    showFundingPanel() {
        if (!this.player.startup) return;
        
        const currentRound = this.player.startup.fundingRound;
        const maxRound = this.data.fundingRounds.length - 1;
        
        if (currentRound >= maxRound) {
            alert('公司已上市，无法继续融资！');
            return;
        }
        
        const nextRound = currentRound + 1;
        const fundingAmount = this.calculateFundingAmount();
        const newValuation = (this.player.startup.valuation * 10000) + fundingAmount;
        
        document.getElementById('current-funding-round-display').textContent = 
            this.data.fundingRounds[currentRound];
        document.getElementById('next-funding-round-display').textContent = 
            this.data.fundingRounds[nextRound];
        document.getElementById('estimated-funding-amount').textContent = 
            (fundingAmount / 10000).toFixed(2);
        document.getElementById('estimated-valuation').textContent = 
            (newValuation / 10000).toFixed(2);
        
        // 显示融资条件
        const conditionsList = document.getElementById('funding-conditions-list');
        conditionsList.innerHTML = '';
        
        const conditions = [
            `当前估值：${(this.player.startup.valuation).toLocaleString()} 万元`,
            `项目数量：${this.player.startup.projects.length} 个`,
            `员工数量：${this.player.startup.employees.length} 人`,
            `公司账户余额：${this.player.startup.balance.toLocaleString()} 元`
        ];
        
        conditions.forEach(condition => {
            const li = document.createElement('li');
            li.textContent = condition;
            conditionsList.appendChild(li);
        });
        
        this.showPanel('funding-panel-management');
    },
    
    /**
     * 申请融资
     */
    applyForFunding() {
        if (!this.player.startup) return;
        
        const currentRound = this.player.startup.fundingRound;
        const maxRound = this.data.fundingRounds.length - 1;
        
        if (currentRound >= maxRound) {
            alert('公司已上市，无法继续融资！');
            return;
        }
        
        // 计算属性总和（融资需要属性检查）
        const totalAttributes = 
            this.player.attributes.energy +
            this.player.attributes.intelligence +
            this.player.attributes.communication +
            this.player.attributes.luck +
            this.player.attributes.ideal;
        
        // 后续融资需要更高的属性要求（每轮增加50）
        const requiredAttributes = 400 + (currentRound * 50);
        
        if (totalAttributes < requiredAttributes) {
            alert(`融资失败！你的综合属性不足（需要${requiredAttributes}以上，当前${totalAttributes}）`);
            return;
        }
        
        const fundingAmount = this.calculateFundingAmount();
        
        if (fundingAmount <= 0) {
            alert('当前不符合融资条件！');
            return;
        }
        
        // 更新公司状态
        const nextRound = currentRound + 1;
        this.player.startup.balance += fundingAmount;
        // 应用行业估值倍数影响（后续融资时，估值增长也受行业影响）
        let valuationGrowthMultiplier = 1.0;
        if (this.player.startup.industry) {
            const industry = this.player.startup.industry;
            const growthPotential = industry.growthPotential || 50;
            // 成长潜力影响估值增长（最高+20%）
            valuationGrowthMultiplier = 1.0 + (growthPotential / 100) * 0.2;
        }
        this.player.startup.valuation = (this.player.startup.valuation * 10000 + fundingAmount * valuationGrowthMultiplier) / 10000;
        this.player.startup.fundingRound = nextRound;
        
        // 记录融资历史
        if (!this.player.startup.fundingHistory) {
            this.player.startup.fundingHistory = [];
        }
        this.player.startup.fundingHistory.push({
            round: this.data.fundingRounds[nextRound],
            amount: fundingAmount,
            valuation: this.player.startup.valuation * 10000,
            turn: this.currentTurn
        });
        
        alert(`融资成功！\n轮次：${this.data.fundingRounds[nextRound]}\n融资金额：${(fundingAmount / 10000).toFixed(2)} 万元\n公司估值：${(this.player.startup.valuation).toLocaleString()} 万元`);
        
        this.updateStartupPanel();
        this.showPanel('startup-management');
    },
    
    /**
     * 更新创业管理面板
     */
    updateStartupPanel() {
        if (!this.player.startup) return;
        
        document.getElementById('company-balance').textContent = 
            this.player.startup.balance.toLocaleString();
        document.getElementById('funding-round').textContent = 
            this.data.fundingRounds[this.player.startup.fundingRound];
        document.getElementById('company-valuation').textContent = 
            this.player.startup.valuation.toLocaleString();
        
        // 更新行业信息显示
        const industryDetails = document.getElementById('industry-details');
        const industryInfoSection = document.getElementById('industry-info-section');
        if (this.player.startup.industry && industryDetails) {
            const industry = this.player.startup.industry;
            const competition = industry.competition || 50;
            const techThreshold = industry.techThreshold || 50;
            const capitalNeed = industry.capitalNeed || 50;
            const growthPotential = industry.growthPotential || 50;
            const revenueMultiplier = industry.revenueMultiplier || 1.0;
            const fundingDifficulty = industry.fundingDifficulty || 0;
            const valuationMultiplier = industry.valuationMultiplier || 1.0;
            
            // 计算影响说明
            const revenueImpact = ((revenueMultiplier - 1.0) * 100).toFixed(0);
            const costImpact = ((capitalNeed - 50) / 50 * 30).toFixed(0);
            const techImpact = ((techThreshold - 50) / 50 * 30).toFixed(0);
            
            industryDetails.innerHTML = `
                <div style="margin-bottom: 10px;">
                    <strong>${industry.name}</strong>
                    <span style="color: #666; font-size: 12px; margin-left: 8px;">${industry.description}</span>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 12px; margin-bottom: 10px;">
                    <div>
                        <span style="color: #666;">竞争度：</span>
                        <span style="font-weight: bold;">${competition}</span>
                        <div style="width: 100%; height: 4px; background: #e9ecef; border-radius: 2px; margin-top: 2px;">
                            <div style="width: ${competition}%; height: 100%; background: ${competition > 70 ? '#dc3545' : competition > 40 ? '#ffc107' : '#28a745'}; border-radius: 2px;"></div>
                        </div>
                    </div>
                    <div>
                        <span style="color: #666;">技术门槛：</span>
                        <span style="font-weight: bold;">${techThreshold}</span>
                        <div style="width: 100%; height: 4px; background: #e9ecef; border-radius: 2px; margin-top: 2px;">
                            <div style="width: ${techThreshold}%; height: 100%; background: ${techThreshold > 70 ? '#dc3545' : techThreshold > 40 ? '#ffc107' : '#28a745'}; border-radius: 2px;"></div>
                        </div>
                    </div>
                    <div>
                        <span style="color: #666;">资金需求：</span>
                        <span style="font-weight: bold;">${capitalNeed}</span>
                        <div style="width: 100%; height: 4px; background: #e9ecef; border-radius: 2px; margin-top: 2px;">
                            <div style="width: ${capitalNeed}%; height: 100%; background: ${capitalNeed > 70 ? '#dc3545' : capitalNeed > 40 ? '#ffc107' : '#28a745'}; border-radius: 2px;"></div>
                        </div>
                    </div>
                    <div>
                        <span style="color: #666;">成长潜力：</span>
                        <span style="font-weight: bold;">${growthPotential}</span>
                        <div style="width: 100%; height: 4px; background: #e9ecef; border-radius: 2px; margin-top: 2px;">
                            <div style="width: ${growthPotential}%; height: 100%; background: ${growthPotential > 70 ? '#28a745' : growthPotential > 40 ? '#ffc107' : '#dc3545'}; border-radius: 2px;"></div>
                        </div>
                    </div>
                </div>
                <div style="padding-top: 8px; border-top: 1px solid #dee2e6; font-size: 11px; color: #666;">
                    <div style="margin-bottom: 4px;">项目收益：<span style="color: ${revenueImpact >= 0 ? '#28a745' : '#dc3545'}">${revenueImpact >= 0 ? '+' : ''}${revenueImpact}%</span></div>
                    <div style="margin-bottom: 4px;">运营成本：<span style="color: ${costImpact >= 0 ? '#dc3545' : '#28a745'}">${costImpact >= 0 ? '+' : ''}${costImpact}%</span></div>
                    <div style="margin-bottom: 4px;">研发难度：<span style="color: ${techImpact >= 0 ? '#dc3545' : '#28a745'}">${techImpact >= 0 ? '+' : ''}${techImpact}%</span></div>
                    <div>融资难度：<span style="color: ${fundingDifficulty >= 0 ? '#28a745' : '#dc3545'}">${fundingDifficulty >= 0 ? '+' : ''}${fundingDifficulty}%</span></div>
                </div>
            `;
            industryInfoSection.style.display = 'block';
        } else if (industryInfoSection) {
            industryInfoSection.style.display = 'none';
        }
        
        // 更新贷款信息
        const loansList = document.getElementById('loans-list');
        const monthlyLoanTotal = document.getElementById('monthly-loan-total');
        const loansInfo = document.getElementById('loans-info');
        
        if (this.player.startup.loans && this.player.startup.loans.length > 0) {
            loansList.innerHTML = '';
            let totalMonthlyPayment = 0;
            
            this.player.startup.loans.forEach(loan => {
                if (loan.remainingAmount > 0 && loan.remainingMonths > 0) {
                    totalMonthlyPayment += loan.monthlyPayment;
                    
                    const loanItem = document.createElement('div');
                    loanItem.className = 'loan-item';
                    loanItem.innerHTML = `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <div>
                                <strong>${loan.type === 'interest_free' ? '无息贷款' : '银行贷款'}</strong>
                                <span style="color: #666; font-size: 12px; margin-left: 10px;">
                                    剩余：${loan.remainingAmount.toFixed(2)} 元 / ${loan.remainingMonths} 个月
                                </span>
                            </div>
                            <div style="color: #dc3545; font-weight: bold;">
                                每月：${loan.monthlyPayment.toFixed(2)} 元
                            </div>
                        </div>
                    `;
                    loansList.appendChild(loanItem);
                }
            });
            
            monthlyLoanTotal.textContent = totalMonthlyPayment.toFixed(2);
            loansInfo.style.display = 'block';
        } else {
            loansList.innerHTML = '<p style="color: #666; font-size: 14px;">暂无贷款</p>';
            monthlyLoanTotal.textContent = '0';
            loansInfo.style.display = 'block';
        }
        
        // 更新融资历史
        const fundingHistoryList = document.getElementById('funding-history-list');
        const fundingHistorySection = document.getElementById('funding-history-section');
        
        if (this.player.startup.fundingHistory && this.player.startup.fundingHistory.length > 0) {
            fundingHistoryList.innerHTML = '';
            
            this.player.startup.fundingHistory.forEach((funding, index) => {
                const historyItem = document.createElement('div');
                historyItem.className = 'funding-history-item';
                historyItem.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #eee;">
                        <div>
                            <strong>${funding.round}</strong>
                            <span style="color: #666; font-size: 12px; margin-left: 10px;">
                                第 ${index + 1} 轮
                            </span>
                        </div>
                        <div>
                            <span style="color: #28a745; font-weight: bold;">
                                ${(funding.amount / 10000).toFixed(2)} 万元
                            </span>
                            <span style="color: #666; font-size: 12px; margin-left: 10px;">
                                估值：${(funding.valuation / 10000).toFixed(2)} 万元
                            </span>
                        </div>
                    </div>
                `;
                fundingHistoryList.appendChild(historyItem);
            });
            
            fundingHistorySection.style.display = 'block';
        } else {
            fundingHistoryList.innerHTML = '<p style="color: #666; font-size: 14px;">暂无融资记录</p>';
            fundingHistorySection.style.display = 'block';
        }
        
        // 更新员工列表
        const employeeList = document.getElementById('employee-list');
        employeeList.innerHTML = '';
        
        // 首先显示玩家（如果存在）
        if (this.player.startup.playerEmployee) {
            const playerEmp = this.player.startup.playerEmployee;
            const playerAbility = this.getPlayerAbilityByPosition(playerEmp.position);
            
            const playerCard = document.createElement('div');
            playerCard.className = 'employee-card';
            playerCard.style.border = '2px solid #667eea'; // 特殊标记玩家卡片
            playerCard.innerHTML = `
                <h5>${playerEmp.position} - ${playerEmp.name} (你)</h5>
                <p>业务能力：${playerAbility}</p>
                <p>月薪：<input type="number" id="player-salary-input" value="${playerEmp.salary}" min="0" style="width: 100px; padding: 4px; border: 1px solid #ddd; border-radius: 4px;"> 元</p>
                <p style="margin-top: 8px;">
                    <label>岗位：</label>
                    <select id="player-position-select" style="padding: 4px; border: 1px solid #ddd; border-radius: 4px; margin-left: 8px;">
                        ${this.data.employeePositions.map(pos => 
                            `<option value="${pos}" ${pos === playerEmp.position ? 'selected' : ''}>${pos}</option>`
                        ).join('')}
                    </select>
                </p>
                <button class="btn btn-primary" style="margin-top: 8px; padding: 6px 12px; font-size: 14px;" id="save-player-settings-btn">保存设置</button>
            `;
            
            // 绑定保存设置按钮
            const saveBtn = playerCard.querySelector('#save-player-settings-btn');
            saveBtn.addEventListener('click', () => {
                this.savePlayerEmployeeSettings();
            });
            
            employeeList.appendChild(playerCard);
        }
        
        // 显示其他员工
        if (this.player.startup.employees.length === 0 && !this.player.startup.playerEmployee) {
            employeeList.innerHTML += '<p>暂无员工</p>';
        } else {
            this.player.startup.employees.forEach((emp, index) => {
                const card = document.createElement('div');
                card.className = 'employee-card';
                card.innerHTML = `
                    <h5>${emp.position} - ${emp.name}</h5>
                    <p>业务能力：${emp.ability}</p>
                    <p>月薪：${emp.salary.toLocaleString()} 元</p>
                    <button class="btn btn-secondary" style="margin-top: 8px; padding: 6px 12px; font-size: 14px;" data-employee-index="${index}">辞退</button>
                `;
                
                // 绑定辞退按钮事件
                const fireBtn = card.querySelector('button[data-employee-index]');
                fireBtn.addEventListener('click', () => {
                    this.fireEmployee(index);
                });
                
                employeeList.appendChild(card);
            });
        }
        
        // 更新项目列表
        const projectList = document.getElementById('project-list');
        projectList.innerHTML = '';
        if (this.player.startup.projects.length === 0) {
            projectList.innerHTML = '<p>暂无项目</p>';
        } else {
            this.player.startup.projects.forEach((project, index) => {
                const card = document.createElement('div');
                card.className = 'project-card';
                let progressHtml = '';
                if (project.status === 'designing') {
                    // 设计阶段
                    const progress = (project.designCurrentMonth / project.designTotalMonths) * 100;
                    progressHtml = `
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${progress}%; background: linear-gradient(90deg, #ffc107 0%, #ff9800 100%);">
                                ${Math.round(progress)}%
                            </div>
                        </div>
                        <p>设计进度：${project.designCurrentMonth}/${project.designTotalMonths} 月</p>
                    `;
                } else if (project.status === 'design_completed') {
                    // 设计完成，等待开始研发
                    progressHtml = `
                        <p style="color: orange;">设计完成！</p>
                        <button class="btn btn-primary start-develop-btn" data-project-index="${index}">开始研发</button>
                    `;
                } else if (project.status === 'developing') {
                    // 研发阶段
                    const progress = (project.currentMonth / project.totalMonths) * 100;
                    progressHtml = `
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${progress}%">
                                ${Math.round(progress)}%
                            </div>
                        </div>
                        <p>研发进度：${project.currentMonth}/${project.totalMonths} 月</p>
                    `;
                } else if (project.status === 'completed') {
                    progressHtml = `
                        <p style="color: green;">研发完成！</p>
                        <button class="btn btn-primary start-sales-btn" data-project-index="${index}">投入销售</button>
                    `;
                } else if (project.status === 'selling') {
                    // 计算销售团队详细信息
                    const projectIndex = index;
                    const salesCount = this.getSalesEmployeeCount(projectIndex);
                    const salesAbility = this.getTotalAbilityByPosition('销售', projectIndex);
                    const efficiencyFactor = this.calculateEfficiencyFactor(salesCount);
                    
                    // 计算销售月数和生命周期阶段
                    let salesMonths = 0;
                    let lifecycleStage = '';
                    if (project.salesStartMonth) {
                        salesMonths = this.currentTurn - project.salesStartMonth + 1;
                        if (salesMonths <= 3) {
                            lifecycleStage = '增长期';
                        } else if (salesMonths <= 12) {
                            lifecycleStage = '稳定期';
                        } else if (salesMonths <= 24) {
                            lifecycleStage = '成熟期';
                        } else {
                            lifecycleStage = '衰退期';
                        }
                    }
                    
                    // 显示分配的销售员工信息
                    let salesEmployeesHtml = '';
                    if (project.assignedEmployees && project.assignedEmployees.length > 0) {
                        const salesEmployees = project.assignedEmployees.map(empId => {
                            if (empId === 'player') {
                                const playerEmp = this.player.startup.playerEmployee;
                                if (playerEmp && playerEmp.position === '销售') {
                                    return this.player.name + '(你)';
                                }
                                return null;
                            } else {
                                const emp = this.player.startup.employees[empId];
                                if (emp && emp.position === '销售') {
                                    return emp.name;
                                }
                                return null;
                            }
                        }).filter(name => name).join(', ');
                        if (salesEmployees) {
                            salesEmployeesHtml = `<p style="font-size: 12px; color: #666; margin-top: 5px;">销售员工：${salesEmployees}</p>`;
                        }
                    }
                    
                    progressHtml = `
                        <p style="color: blue; font-weight: bold;">销售中... 每月收入：${project.monthlyRevenue.toLocaleString()} 元</p>
                        <p style="font-size: 11px; color: #888; margin-top: 3px;">
                            销售团队：${salesCount}人 | 能力：${salesAbility} | 
                            效率：${(efficiencyFactor * 100).toFixed(0)}% | 
                            阶段：${lifecycleStage} (${salesMonths}个月)
                        </p>
                        ${salesEmployeesHtml}
                    `;
                }
                
                // 显示分配的员工信息
                let assignedEmployeesHtml = '';
                if (project.assignedEmployees && project.assignedEmployees.length > 0) {
                    const employeeNames = project.assignedEmployees.map(empId => {
                        if (empId === 'player') {
                            return this.player.name + '(你)';
                        } else {
                            const emp = this.player.startup.employees[empId];
                            return emp ? emp.name : '';
                        }
                    }).filter(name => name).join(', ');
                    assignedEmployeesHtml = `<p style="font-size: 12px; color: #666; margin-top: 5px;">参与员工：${employeeNames || '无'}</p>`;
                } else {
                    assignedEmployeesHtml = `<p style="font-size: 12px; color: #999; margin-top: 5px;">未分配员工</p>`;
                }
                
                card.innerHTML = `
                    <h5>${project.name} (${project.grade}级)</h5>
                    ${progressHtml}
                    ${assignedEmployeesHtml}
                    <button class="btn btn-secondary assign-employees-btn" data-project-index="${index}" style="margin-top: 8px; padding: 6px 12px; font-size: 14px;">分配员工</button>
                `;
                projectList.appendChild(card);
            });
            
            // 绑定开始研发按钮事件
            document.querySelectorAll('.start-develop-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const index = parseInt(e.target.dataset.projectIndex);
                    this.startDevelop(index);
                });
            });
            
            // 绑定分配员工按钮事件
            document.querySelectorAll('.assign-employees-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const index = parseInt(e.target.dataset.projectIndex);
                    this.showAssignEmployeesPanel(index);
                });
            });
            
            // 绑定投入销售按钮事件
            document.querySelectorAll('.start-sales-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const index = parseInt(e.target.dataset.projectIndex);
                    this.startSales(index);
                });
            });
            
            // 绑定保存分配和取消按钮
            document.getElementById('save-assignments-btn').addEventListener('click', () => {
                this.saveEmployeeAssignments();
            });
            document.getElementById('cancel-assignments-btn').addEventListener('click', () => {
                this.showPanel('startup-management');
            });
            
            // 绑定新工作行动按钮
            document.getElementById('work-overtime-btn').addEventListener('click', () => {
                this.workOvertime();
            });
            
            document.getElementById('work-social-btn').addEventListener('click', () => {
                this.workSocial();
            });
            
            document.getElementById('work-training-btn').addEventListener('click', () => {
                this.workTraining();
            });
            
            document.getElementById('work-sidejob-btn').addEventListener('click', () => {
                this.workSideJob();
            });
            
            document.getElementById('work-jobhunt-btn').addEventListener('click', () => {
                this.workJobHunt();
            });
            
            // 培训面板返回按钮
            document.getElementById('back-from-training').addEventListener('click', () => {
                this.showPanel('work-management');
            });
            
            // 跳槽面板返回按钮
            document.getElementById('back-from-jobhunt').addEventListener('click', () => {
                this.showPanel('work-management');
            });
        }
    },
    
    /**
     * 生成中文姓名
     */
    /**
     * 生成中文姓名（根据性别）
     */
    generateChineseName(gender) {
        const genderKey = gender === '男' ? 'male' : 'female';
        const nameList = this.data.candidateNames[genderKey];
        return nameList[this.randomInt(0, nameList.length - 1)];
    },
    
    /**
     * 生成教育背景（受年龄影响）
     */
    generateEducation(age) {
        let school, degree;
        
        // 根据年龄调整学校等级概率
        if (age >= 25 && age <= 28) {
            // 25-28岁：更可能有高学历（刚毕业）
            const rand = Math.random();
            if (rand < 0.4) {
                // 985/藤校：40%
                school = this.data.universities[this.randomInt(2, 3)]; // 985或藤校
            } else if (rand < 0.7) {
                // 211：30%
                school = this.data.universities[1]; // 211
            } else {
                // 普通本科：30%
                school = this.data.universities[0]; // 普通本科
            }
            
            // 硕士/博士概率：60%
            const degreeRand = Math.random();
            if (degreeRand < 0.6) {
                degree = this.data.degrees[this.randomInt(1, 2)]; // 硕士或博士
            } else {
                degree = this.data.degrees[0]; // 学士
            }
        } else if (age >= 29 && age <= 35) {
            // 29-35岁：学历分布正常
            const rand = Math.random();
            if (rand < 0.25) {
                // 985/藤校：25%
                school = this.data.universities[this.randomInt(2, 3)];
            } else if (rand < 0.6) {
                // 211：35%
                school = this.data.universities[1];
            } else {
                // 普通本科：40%
                school = this.data.universities[0];
            }
            
            // 硕士/博士概率：40%
            const degreeRand = Math.random();
            if (degreeRand < 0.4) {
                degree = this.data.degrees[this.randomInt(1, 2)];
            } else {
                degree = this.data.degrees[0];
            }
        } else {
            // 36-45岁：更可能有普通学历（但经验丰富）
            const rand = Math.random();
            if (rand < 0.15) {
                // 985/藤校：15%
                school = this.data.universities[this.randomInt(2, 3)];
            } else if (rand < 0.4) {
                // 211：25%
                school = this.data.universities[1];
            } else {
                // 普通本科：60%
                school = this.data.universities[0];
            }
            
            // 硕士/博士概率：20%
            const degreeRand = Math.random();
            if (degreeRand < 0.2) {
                degree = this.data.degrees[this.randomInt(1, 2)];
            } else {
                degree = this.data.degrees[0];
            }
        }
        
        return {
            school: school.name,
            schoolLevel: school.level,
            degree: degree.name,
            degreeLevel: degree.level
        };
    },
    
    /**
     * 生成工作经验（受年龄影响，灵活相关）
     */
    generateExperience(age) {
        let years;
        
        // 特殊情况：10%概率出现特殊情况
        const specialCase = Math.random() < 0.1;
        
        if (specialCase) {
            if (age >= 25 && age <= 28) {
                // 年轻有经验：25-28岁，但经验5-8年（跳槽频繁）
                years = this.randomInt(5, 8);
            } else if (age >= 36 && age <= 45) {
                // 年长经验少：36-45岁，但经验0-3年（转行或重新开始）
                years = this.randomInt(0, 3);
            } else {
                // 其他年龄段，使用正常逻辑
                const minYears = Math.max(0, age - 22 - this.randomInt(0, 2));
                const maxYears = age - 22 + this.randomInt(0, 3);
                years = this.randomInt(minYears, maxYears);
            }
        } else {
            // 正常情况：年龄和经验灵活相关
            // 最小经验：max(0, age - 22 - 随机0-2年)（考虑上学时间）
            // 最大经验：age - 22 + 随机0-3年（允许跳槽导致经验更多）
            const minYears = Math.max(0, age - 22 - this.randomInt(0, 2));
            const maxYears = Math.min(25, age - 22 + this.randomInt(0, 3)); // 最多25年经验
            years = this.randomInt(minYears, maxYears);
        }
        
        const previousCompanies = Math.min(years > 0 ? Math.floor(years / 3) + 1 : 0, 5);
        const industryIndex = this.randomInt(0, this.data.industries.length - 1);
        
        return {
            years: years,
            previousCompanies: previousCompanies,
            industry: this.data.industries[industryIndex].name
        };
    },
    
    /**
     * 生成技能特长
     */
    generateSpecialties(position) {
        const specialties = this.data.specialties[position] || [];
        if (specialties.length === 0) return [];
        
        const count = this.randomInt(2, 4); // 2-4个技能
        const selected = [];
        const available = [...specialties];
        
        for (let i = 0; i < count && available.length > 0; i++) {
            const index = this.randomInt(0, available.length - 1);
            selected.push(available[index]);
            available.splice(index, 1);
        }
        
        return selected;
    },
    
    /**
     * 生成性格特点
     */
    generatePersonality() {
        const traits = this.data.personalityTraits;
        return traits[this.randomInt(0, traits.length - 1)];
    },
    
    /**
     * 计算基础薪资（非线性分段函数）
     * 能力越高，每点能力带来的薪资增长越大
     */
    calculateBaseSalary(ability) {
        if (ability <= 30) {
            return 3000 + ability * 100;  // 3000-6000元
        } else if (ability <= 60) {
            return 6000 + (ability - 30) * 150;  // 6000-10500元
        } else if (ability <= 100) {
            return 10500 + (ability - 60) * 200;  // 10500-18500元
        } else if (ability <= 150) {
            return 18500 + (ability - 100) * 300;  // 18500-33500元
        } else {
            return 33500 + (ability - 150) * 400;  // 33500-53500元
        }
    },
    
    /**
     * 计算教育背景加成
     */
    calculateEducationBonus(education) {
        // 学校加成
        const schoolBonus = {
            1: 500,   // 普通本科
            2: 1000,  // 211大学
            3: 2000,  // 985大学
            4: 3000   // 藤校
        };
        
        // 学历加成
        const degreeBonus = {
            1: 0,     // 学士
            2: 1500,  // 硕士
            3: 3000   // 博士
        };
        
        return (schoolBonus[education.schoolLevel] || 0) + 
               (degreeBonus[education.degreeLevel] || 0);
    },
    
    /**
     * 计算工作经验加成（边际递减效应）
     */
    calculateExperienceBonus(years) {
        if (years <= 2) {
            return years * 800;  // 0-2年：每年+800元
        } else if (years <= 5) {
            return 2 * 800 + (years - 2) * 600;  // 3-5年：每年+600元
        } else if (years <= 10) {
            return 2 * 800 + 3 * 600 + (years - 5) * 400;  // 6-10年：每年+400元
        } else if (years <= 15) {
            return 2 * 800 + 3 * 600 + 5 * 400 + (years - 10) * 300;  // 11-15年：每年+300元
        } else {
            return 2 * 800 + 3 * 600 + 5 * 400 + 5 * 300 + (years - 15) * 200;  // 16年以上：每年+200元
        }
    },
    
    /**
     * 计算技能加成（限制最多3个技能）
     */
    calculateSkillBonus(specialties) {
        return Math.min(specialties.length, 3) * 300;
    },
    
    /**
     * 计算年龄影响
     */
    calculateAgeBonus(age) {
        if (age >= 25 && age <= 28) return 500;   // 年轻有潜力
        if (age >= 29 && age <= 35) return 0;     // 黄金年龄
        if (age >= 36 && age <= 40) return -300;  // 年龄稍大
        if (age >= 41 && age <= 45) return -600;  // 年龄较大
        return 0;
    },
    
    /**
     * 计算期望薪资（改进版，更贴近真实世界）
     */
    calculateExpectedSalary(candidate) {
        const position = candidate.position;
        
        // 岗位基础薪资倍数
        const positionMultiplier = {
            '研发': 1.2,  // 技术岗位薪资较高
            '产品': 1.1,  // 产品岗位薪资较高
            '销售': 1.0,  // 基础倍数
            '行政': 0.8   // 行政岗位薪资较低
        };
        
        // 岗位特殊调整系数
        const positionAdjustments = {
            '研发': { abilityCoeff: 1.1, educationCoeff: 1.0, experienceCoeff: 1.0 },  // 能力影响更大
            '产品': { abilityCoeff: 1.0, educationCoeff: 1.2, experienceCoeff: 1.0 },  // 教育影响更大
            '销售': { abilityCoeff: 1.0, educationCoeff: 1.0, experienceCoeff: 1.3 },  // 经验影响更大
            '行政': { abilityCoeff: 0.9, educationCoeff: 1.0, experienceCoeff: 1.0 }   // 基础薪资较低
        };
        
        const adjustments = positionAdjustments[position] || { 
            abilityCoeff: 1.0, 
            educationCoeff: 1.0, 
            experienceCoeff: 1.0 
        };
        const multiplier = positionMultiplier[position] || 1.0;
        
        // 1. 基础薪资（应用能力系数）
        let baseSalary = this.calculateBaseSalary(candidate.ability) * adjustments.abilityCoeff;
        
        // 2. 教育加成（应用教育系数）
        let educationBonus = this.calculateEducationBonus(candidate.education) * adjustments.educationCoeff;
        
        // 3. 经验加成（应用经验系数）
        let experienceBonus = this.calculateExperienceBonus(candidate.experience.years) * adjustments.experienceCoeff;
        
        // 4. 技能加成
        let skillBonus = this.calculateSkillBonus(candidate.specialties);
        
        // 5. 年龄影响
        let ageBonus = this.calculateAgeBonus(candidate.age);
        
        // 6. 计算总薪资（应用岗位倍数）
        let totalSalary = (baseSalary + educationBonus + experienceBonus + skillBonus + ageBonus) * multiplier;
        
        // 7. 实习生薪资折扣（实习生薪资更低）
        if (candidate.source === 'campus') {
            totalSalary = totalSalary * 0.6; // 实习生薪资为正常薪资的60%
        }
        
        // 8. 添加随机波动（±8%）
        const variation = totalSalary * 0.08 * (Math.random() * 2 - 1);
        
        // 9. 最低薪资保护（实习生可以更低，例如2000元）
        const minSalary = candidate.source === 'campus' ? 2000 : 3000;
        return Math.max(minSalary, Math.floor(totalSalary + variation));
    },
    
    /**
     * 生成候选人（改进版：实现属性关联）
     * 生成顺序：年龄 → 性别 → 姓名 → 教育 → 经验 → 能力
     */
    generateCandidate(position, source) {
        const channel = this.data.recruitmentChannels.find(c => c.id === source);
        const qualityBonus = channel ? channel.qualityBonus : 1.0;
        
        // 1. 生成年龄（实习生年龄限制：20-25岁，其他25-45岁）
        let age;
        if (source === 'campus') {
            age = this.randomInt(20, 25); // 实习生年龄20-25岁
        } else {
            age = this.randomInt(25, 45);
        }
        
        // 2. 生成性别
        const gender = Math.random() < 0.5 ? '男' : '女';
        
        // 3. 根据性别生成姓名
        const name = this.generateChineseName(gender);
        
        // 4. 根据年龄生成教育背景
        const education = this.generateEducation(age);
        
        // 5. 根据年龄生成经验
        const experience = this.generateExperience(age);
        
        // 6. 根据教育、经验、年龄计算基础能力
        // 6.1 教育背景基础能力
        let baseAbility = 30; // 基础值
        if (education.schoolLevel >= 3) baseAbility += 20; // 985/藤校
        if (education.schoolLevel >= 2) baseAbility += 10; // 211
        if (education.degreeLevel >= 2) baseAbility += 15; // 硕士
        if (education.degreeLevel >= 3) baseAbility += 25; // 博士
        
        // 6.2 经验加成（边际递减）
        let experienceBonus = 0;
        if (experience.years <= 2) {
            experienceBonus = experience.years * 3; // 每年+3
        } else if (experience.years <= 5) {
            experienceBonus = 6 + (experience.years - 2) * 2; // 每年+2
        } else if (experience.years <= 10) {
            experienceBonus = 12 + (experience.years - 5) * 1.5; // 每年+1.5
        } else {
            experienceBonus = 19.5 + (experience.years - 10) * 1; // 每年+1
        }
        
        // 6.3 年龄加成（黄金年龄）
        let ageBonus = 0;
        if (age >= 29 && age <= 35) ageBonus = 5; // 黄金年龄
        
        // 6.4 计算基础能力
        baseAbility = baseAbility + experienceBonus + ageBonus;
        
        // 6.5 应用随机波动（±20%）
        const variation = baseAbility * 0.2 * (Math.random() * 2 - 1);
        let ability = Math.floor(baseAbility + variation);
        
        // 6.6 应用渠道质量加成
        ability = Math.floor(ability * qualityBonus);
        
        // 6.7 能力分布调整（潜力股和平衡机制）
        if (ability < 50 && Math.random() < 0.3) {
            // 30%概率：潜力股，提升到50-70
            ability = this.randomInt(50, 70);
        } else if (ability > 100 && Math.random() < 0.2) {
            // 20%概率：保持平衡，降低到80-100
            ability = this.randomInt(80, 100);
        }
        
        // 6.8 限制在合理范围内
        ability = Math.max(0, Math.min(200, ability));
        
        // 7. 创建候选人对象
        const candidate = {
            id: `candidate_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: name,
            age: age,
            gender: gender,
            position: position,
            ability: ability,
            education: education,
            experience: experience,
            specialties: this.generateSpecialties(position),
            expectedSalary: 0, // 稍后计算
            minSalary: 0,
            negotiable: Math.random() < 0.7,
            source: source,
            interviewStage: 0, // 0=未面试, 1=初试, 2=复试
            interviewResult: 'pending', // pending/passed/failed
            personality: this.generatePersonality(),
            loyalty: this.randomInt(50, 100),
            growthPotential: this.randomInt(30, 100)
        };
        
        // 8. 计算薪资
        candidate.expectedSalary = this.calculateExpectedSalary(candidate);
        // 最低接受薪资：可议价候选人可以接受80-90%的薪资，不可议价候选人只能接受95-100%
        if (candidate.negotiable) {
            candidate.minSalary = Math.floor(candidate.expectedSalary * (0.8 + Math.random() * 0.1)); // 80-90%
        } else {
            candidate.minSalary = Math.floor(candidate.expectedSalary * (0.95 + Math.random() * 0.05)); // 95-100%
        }
        
        return candidate;
    },
    
    /**
     * 生成候选人池
     */
    generateCandidatePool(channelId) {
        const channel = this.data.recruitmentChannels.find(c => c.id === channelId);
        if (!channel) return [];
        
        const candidates = [];
        const candidateCount = channel.candidateCount;
        
        for (let i = 0; i < candidateCount; i++) {
            const position = this.data.employeePositions[this.randomInt(0, this.data.employeePositions.length - 1)];
            const candidate = this.generateCandidate(position, channelId);
            candidates.push(candidate);
        }
        
        return candidates;
    },
    
    /**
     * 显示招聘面板（改进版）
     */
    showHirePanel() {
        this.showPanel('hire-panel');
        
        // 计算可招募员工数
        const maxEmployees = this.getMaxEmployees();
        if (this.player.startup.employees.length >= maxEmployees) {
            const candidateList = document.getElementById('candidate-list');
            candidateList.innerHTML = `<p style="color: #d32f2f;">已达到最大员工数（${maxEmployees}）</p>`;
            return;
        }
        
        // 如果没有候选人池，生成新的
        if (this.currentCandidates.length === 0) {
            this.currentCandidates = this.generateCandidatePool(this.currentRecruitmentChannel);
        }
        
        // 更新UI
        this.updateHirePanelUI();
    },
    
    /**
     * 更新招聘面板UI
     */
    updateHirePanelUI() {
        // 更新渠道选择
        this.updateChannelSelection();
        
        // 更新候选人列表
        this.updateCandidateList();
    },
    
    /**
     * 更新渠道选择UI
     */
    updateChannelSelection() {
        const channelContainer = document.getElementById('recruitment-channels');
        if (!channelContainer) return;
        
        channelContainer.innerHTML = '';
        
        this.data.recruitmentChannels.forEach(channel => {
            const btn = document.createElement('button');
            btn.className = 'btn btn-channel';
            if (this.currentRecruitmentChannel === channel.id) {
                btn.classList.add('active');
            }
            
            // 检查内推渠道是否可用
            const isDisabled = channel.id === 'internal_referral' && this.player.startup.employees.length === 0;
            if (isDisabled) {
                btn.disabled = true;
                btn.style.opacity = '0.5';
                btn.style.cursor = 'not-allowed';
            }
            
            btn.innerHTML = `
                <div style="font-weight: bold;">${channel.name}${isDisabled ? ' (需要员工)' : ''}</div>
                <div style="font-size: 12px; color: #666;">
                    费用：${channel.cost.toLocaleString()}元 | 
                    候选人：${channel.candidateCount}人 | 
                    质量：${(channel.qualityBonus * 100).toFixed(0)}%
                </div>
                ${channel.description ? `<div style="font-size: 11px; color: #999; margin-top: 4px;">${channel.description}</div>` : ''}
            `;
            
            if (!isDisabled) {
                btn.addEventListener('click', () => {
                    this.selectRecruitmentChannel(channel.id);
                });
            }
            
            channelContainer.appendChild(btn);
        });
    },
    
    /**
     * 选择招聘渠道
     */
    selectRecruitmentChannel(channelId) {
        const channel = this.data.recruitmentChannels.find(c => c.id === channelId);
        if (!channel) return;
        
        // 检查内推渠道（需要有员工才能内推）
        if (channelId === 'internal_referral' && this.player.startup.employees.length === 0) {
            alert('内推需要至少有一名员工才能使用');
            return;
        }
        
        // 检查资金
        if (this.player.startup.balance < channel.cost) {
            alert(`公司余额不足，无法使用${channel.name}（需要${channel.cost.toLocaleString()}元）`);
            return;
        }
        
        // 扣除费用
        if (channel.cost > 0) {
            this.player.startup.balance -= channel.cost;
            this.updateStartupPanel();
        }
        
        // 更新渠道
        this.currentRecruitmentChannel = channelId;
        
        // 生成新的候选人池
        this.currentCandidates = this.generateCandidatePool(channelId);
        
        // 更新UI
        this.updateHirePanelUI();
        
        alert(`已切换到${channel.name}，生成${this.currentCandidates.length}名候选人`);
    },
    
    /**
     * 更新候选人列表
     */
    updateCandidateList() {
        const candidateList = document.getElementById('candidate-list');
        if (!candidateList) return;
        
        candidateList.innerHTML = '';
        
        // 应用筛选
        const filteredCandidates = this.filterCandidates(this.currentCandidates);
        
        if (filteredCandidates.length === 0) {
            candidateList.innerHTML = '<p style="color: #666;">没有符合条件的候选人</p>';
            return;
        }
        
        filteredCandidates.forEach(candidate => {
            const item = this.createCandidateCard(candidate);
            candidateList.appendChild(item);
        });
    },
    
    /**
     * 创建候选人卡片
     */
    createCandidateCard(candidate) {
        const item = document.createElement('div');
        item.className = 'list-item candidate-card';
        
        // 能力星级显示
        const stars = Math.floor(candidate.ability / 40); // 每40能力一颗星，最多5星
        const starHtml = '⭐'.repeat(Math.min(5, stars)) + '☆'.repeat(Math.max(0, 5 - stars));
        
        // 面试状态
        let interviewStatus = '';
        if (candidate.interviewStage === 1) {
            interviewStatus = '<span style="color: #ff9800; font-size: 12px;">[初试中]</span>';
        } else if (candidate.interviewStage === 2) {
            interviewStatus = '<span style="color: #4caf50; font-size: 12px;">[复试通过]</span>';
        } else if (candidate.interviewResult === 'failed') {
            interviewStatus = '<span style="color: #f44336; font-size: 12px;">[面试失败]</span>';
        }
        
        item.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                <div>
                    <h4 style="margin: 0;">${candidate.name} (${candidate.age}岁, ${candidate.gender}) ${interviewStatus}</h4>
                    <p style="margin: 5px 0; color: #666; font-size: 13px;">
                        ${candidate.position} | 能力：${candidate.ability} ${starHtml}
                    </p>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px; margin-bottom: 10px;">
                <div>
                    <strong>教育：</strong>${candidate.education.school} ${candidate.education.degree}
                </div>
                <div>
                    <strong>经验：</strong>${candidate.experience.years}年 | ${candidate.experience.previousCompanies}家公司
                </div>
                <div>
                    <strong>行业：</strong>${candidate.experience.industry}
                </div>
                <div>
                    <strong>期望薪资：</strong>${candidate.expectedSalary.toLocaleString()}元/月
                </div>
            </div>
            
            <div style="margin-bottom: 10px;">
                <strong style="font-size: 12px;">技能：</strong>
                ${candidate.specialties.map(s => `<span style="background: #e3f2fd; padding: 2px 6px; border-radius: 3px; font-size: 11px; margin-right: 4px;">${s}</span>`).join('')}
            </div>
            
            <div style="display: flex; gap: 8px; margin-top: 10px;">
                <button class="btn btn-small" onclick="Game.showCandidateDetail('${candidate.id}')">查看详情</button>
                ${candidate.interviewStage === 0 ? `<button class="btn btn-small" onclick="Game.interviewCandidate('${candidate.id}', 1)">初试</button>` : ''}
                ${candidate.interviewStage === 1 && candidate.interviewResult === 'passed' ? `<button class="btn btn-small" onclick="Game.interviewCandidate('${candidate.id}', 2)">复试</button>` : ''}
                ${candidate.interviewStage === 2 && candidate.interviewResult === 'passed' ? `<button class="btn btn-small btn-primary" onclick="Game.hireCandidate('${candidate.id}')">招聘</button>` : ''}
            </div>
        `;
        
        return item;
    },
    
    /**
     * 筛选候选人
     */
    filterCandidates(candidates) {
        // 获取筛选条件
        const positionFilter = document.getElementById('filter-position')?.value || 'all';
        const abilityMin = parseInt(document.getElementById('filter-ability-min')?.value) || 0;
        const abilityMax = parseInt(document.getElementById('filter-ability-max')?.value) || 200;
        const salaryMin = parseInt(document.getElementById('filter-salary-min')?.value) || 0;
        const salaryMax = parseInt(document.getElementById('filter-salary-max')?.value) || 1000000;
        const experienceFilter = document.getElementById('filter-experience')?.value || 'all';
        const degreeFilter = document.getElementById('filter-degree')?.value || 'all';
        
        return candidates.filter(candidate => {
            // 岗位筛选
            if (positionFilter !== 'all' && candidate.position !== positionFilter) {
                return false;
            }
            
            // 能力范围筛选
            if (candidate.ability < abilityMin || candidate.ability > abilityMax) {
                return false;
            }
            
            // 薪资范围筛选
            if (candidate.expectedSalary < salaryMin || candidate.expectedSalary > salaryMax) {
                return false;
            }
            
            // 经验筛选
            if (experienceFilter !== 'all') {
                const years = candidate.experience.years;
                if (experienceFilter === '0-2' && (years < 0 || years > 2)) return false;
                if (experienceFilter === '3-5' && (years < 3 || years > 5)) return false;
                if (experienceFilter === '5-10' && (years < 5 || years > 10)) return false;
                if (experienceFilter === '10+' && years < 10) return false;
            }
            
            // 学历筛选
            if (degreeFilter !== 'all') {
                const degreeLevel = candidate.education.degreeLevel;
                if (degreeFilter === '1' && degreeLevel !== 1) return false;
                if (degreeFilter === '2' && degreeLevel !== 2) return false;
                if (degreeFilter === '3' && degreeLevel !== 3) return false;
            }
            
            return true;
        });
    },
    
    /**
     * 面试候选人
     */
    interviewCandidate(candidateId, stage) {
        const candidate = this.currentCandidates.find(c => c.id === candidateId);
        if (!candidate) {
            alert('候选人不存在');
            return;
        }
        
        // 计算面试成功率
        const successRate = this.calculateInterviewSuccessRate(candidate, stage);
        const checkValue = this.randomInt(1, 100);
        const passed = checkValue <= successRate;
        
        // 更新候选人状态
        if (passed) {
            candidate.interviewStage = stage;
            candidate.interviewResult = 'passed';
            
            if (stage === 1) {
                alert(`初试通过！${candidate.name} 进入复试阶段。\n面试成功率：${successRate}%`);
            } else if (stage === 2) {
                alert(`复试通过！可以招聘 ${candidate.name}。\n面试成功率：${successRate}%`);
            }
        } else {
            candidate.interviewResult = 'failed';
            alert(`面试失败！${candidate.name} 拒绝了offer。\n面试成功率：${successRate}%，实际结果：${checkValue}%`);
        }
        
        // 更新UI
        this.updateCandidateList();
    },
    
    /**
     * 计算面试成功率
     */
    calculateInterviewSuccessRate(candidate, stage) {
        // 基础成功率
        let baseRate = 70;
        
        // 实习生渠道成功率加成（极高成功率）
        if (candidate.source === 'campus') {
            baseRate = 90; // 实习生基础成功率90%
        }
        
        // 玩家属性加成
        const communicationBonus = (this.player.attributes.communication - 50) / 10;
        const intelligenceBonus = (this.player.attributes.intelligence - 50) / 10;
        
        // 候选人能力惩罚（能力越高越难招聘）
        const abilityPenalty = candidate.ability / 20;
        
        // 公司吸引力（估值越高吸引力越大）
        const companyAttraction = this.player.startup.valuation > 0 
            ? (this.player.startup.valuation / 1000) / 10 
            : 0;
        
        // 阶段惩罚（复试更难）
        const stagePenalty = stage === 2 ? 10 : 0;
        
        // 计算最终成功率
        let finalRate = baseRate 
            + communicationBonus 
            + intelligenceBonus 
            - abilityPenalty 
            + companyAttraction
            - stagePenalty;
        
        // 实习生渠道额外加成
        if (candidate.source === 'campus') {
            finalRate += 15; // 额外+15%成功率
        }
        
        // 限制在合理范围内（实习生可以更高）
        const maxRate = candidate.source === 'campus' ? 98 : 95;
        finalRate = Math.min(maxRate, Math.max(30, finalRate));
        
        return Math.floor(finalRate);
    },
    
    /**
     * 显示候选人详情
     */
    showCandidateDetail(candidateId) {
        const candidate = this.currentCandidates.find(c => c.id === candidateId);
        if (!candidate) {
            alert('候选人不存在');
            return;
        }
        
        const modal = document.getElementById('candidate-detail-modal');
        if (!modal) {
            // 创建详情模态框
            this.createCandidateDetailModal(candidate);
        } else {
            this.updateCandidateDetailModal(candidate);
            modal.classList.remove('hidden');
        }
    },
    
    /**
     * 创建候选人详情模态框
     */
    createCandidateDetailModal(candidate) {
        // 如果已存在，先移除
        const existing = document.getElementById('candidate-detail-modal');
        if (existing) existing.remove();
        
        const modal = document.createElement('div');
        modal.id = 'candidate-detail-modal';
        modal.className = 'modal';
        
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 700px;">
                <span class="close" onclick="Game.closeCandidateDetail()" style="position: absolute; right: 15px; top: 15px; font-size: 28px; font-weight: bold; cursor: pointer; color: #aaa;">&times;</span>
                <h2 style="margin-top: 0;">${candidate.name} 的详细信息</h2>
                <div id="candidate-detail-content"></div>
            </div>
        `;
        
        document.body.appendChild(modal);
        this.updateCandidateDetailModal(candidate);
        modal.classList.remove('hidden');
    },
    
    /**
     * 更新候选人详情内容
     */
    updateCandidateDetailModal(candidate) {
        const content = document.getElementById('candidate-detail-content');
        if (!content) return;
        
        const stars = Math.floor(candidate.ability / 40);
        const starHtml = '⭐'.repeat(Math.min(5, stars)) + '☆'.repeat(Math.max(0, 5 - stars));
        
        content.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div>
                    <h3>基本信息</h3>
                    <p><strong>姓名：</strong>${candidate.name}</p>
                    <p><strong>年龄：</strong>${candidate.age}岁</p>
                    <p><strong>性别：</strong>${candidate.gender}</p>
                    <p><strong>岗位：</strong>${candidate.position}</p>
                    <p><strong>业务能力：</strong>${candidate.ability} ${starHtml}</p>
                </div>
                
                <div>
                    <h3>教育背景</h3>
                    <p><strong>毕业学校：</strong>${candidate.education.school}</p>
                    <p><strong>学历：</strong>${candidate.education.degree}</p>
                </div>
                
                <div>
                    <h3>工作经验</h3>
                    <p><strong>工作年限：</strong>${candidate.experience.years}年</p>
                    <p><strong>前公司数量：</strong>${candidate.experience.previousCompanies}家</p>
                    <p><strong>行业背景：</strong>${candidate.experience.industry}</p>
                </div>
                
                <div>
                    <h3>薪资信息</h3>
                    <p><strong>期望薪资：</strong>${candidate.expectedSalary.toLocaleString()}元/月</p>
                    <p><strong>最低接受：</strong>${candidate.minSalary.toLocaleString()}元/月</p>
                    <p><strong>可议价：</strong>${candidate.negotiable ? '是' : '否'}</p>
                </div>
            </div>
            
            <div style="margin-top: 15px;">
                <h3>技能特长</h3>
                <div>
                    ${candidate.specialties.map(s => `<span style="background: #e3f2fd; padding: 4px 8px; border-radius: 4px; margin-right: 8px; display: inline-block; margin-bottom: 5px;">${s}</span>`).join('')}
                </div>
            </div>
            
            <div style="margin-top: 15px;">
                <h3>其他属性</h3>
                <p><strong>性格特点：</strong>${candidate.personality}</p>
                <p><strong>忠诚度：</strong>${candidate.loyalty}/100</p>
                <p><strong>成长潜力：</strong>${candidate.growthPotential}/100</p>
                <p><strong>招聘渠道：</strong>${this.data.recruitmentChannels.find(c => c.id === candidate.source)?.name || candidate.source}</p>
            </div>
            
            <div style="margin-top: 20px; text-align: center;">
                ${candidate.interviewStage === 0 ? `<button class="btn btn-primary" onclick="Game.interviewCandidate('${candidate.id}', 1); Game.closeCandidateDetail();">开始初试</button>` : ''}
                ${candidate.interviewStage === 1 && candidate.interviewResult === 'passed' ? `<button class="btn btn-primary" onclick="Game.interviewCandidate('${candidate.id}', 2); Game.closeCandidateDetail();">开始复试</button>` : ''}
                ${candidate.interviewStage === 2 && candidate.interviewResult === 'passed' ? `<button class="btn btn-primary" onclick="Game.hireCandidate('${candidate.id}'); Game.closeCandidateDetail();">立即招聘</button>` : ''}
            </div>
        `;
    },
    
    /**
     * 关闭候选人详情
     */
    closeCandidateDetail() {
        const modal = document.getElementById('candidate-detail-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    },
    
    /**
     * 初始化候选人详情模态框事件（点击外部关闭）
     */
    initCandidateDetailModal() {
        // 点击模态框外部关闭
        document.addEventListener('click', (e) => {
            const modal = document.getElementById('candidate-detail-modal');
            if (modal && !modal.classList.contains('hidden')) {
                if (e.target === modal) {
                    this.closeCandidateDetail();
                }
            }
        });
    },
    
    /**
     * 刷新候选人池
     */
    refreshCandidates() {
        const refreshCost = 500;
        
        if (this.player.startup.balance < refreshCost) {
            alert(`公司余额不足，无法刷新候选人（需要${refreshCost.toLocaleString()}元）`);
            return;
        }
        
        if (!confirm(`确定要花费${refreshCost.toLocaleString()}元刷新候选人池吗？`)) {
            return;
        }
        
        // 扣除费用
        this.player.startup.balance -= refreshCost;
        this.updateStartupPanel();
        
        // 生成新的候选人池
        this.currentCandidates = this.generateCandidatePool(this.currentRecruitmentChannel);
        
        // 更新UI
        this.updateCandidateList();
        
        alert('候选人池已刷新！');
    },
    
    /**
     * 招聘候选人（改进版）
     */
    hireCandidate(candidateId) {
        const candidate = this.currentCandidates.find(c => c.id === candidateId);
        if (!candidate) {
            alert('候选人不存在');
            return;
        }
        
        // 检查是否通过复试
        if (candidate.interviewStage !== 2 || candidate.interviewResult !== 'passed') {
            alert('该候选人尚未通过复试，无法招聘');
            return;
        }
        
        // 检查最大员工数
        const maxEmployees = this.getMaxEmployees();
        if (this.player.startup.employees.length >= maxEmployees) {
            alert(`已达到最大员工数（${maxEmployees}）`);
            return;
        }
        
        // 确定最终薪资（可议价则降低10-20%）
        let finalSalary = candidate.expectedSalary;
        if (candidate.negotiable) {
            const discount = this.randomInt(10, 20) / 100;
            finalSalary = Math.floor(candidate.expectedSalary * (1 - discount));
            // 不能低于最低接受薪资
            finalSalary = Math.max(finalSalary, candidate.minSalary);
        }
        
        // 创建员工对象
        const employee = {
            name: candidate.name,
            position: candidate.position,
            ability: candidate.ability,
            salary: finalSalary,
            // 保留额外信息（可选，用于未来扩展）
            loyalty: candidate.loyalty,
            growthPotential: candidate.growthPotential,
            personality: candidate.personality
        };
        
        // 添加到员工列表
        this.player.startup.employees.push(employee);
        
        // 从候选人列表中移除
        const index = this.currentCandidates.indexOf(candidate);
        if (index > -1) {
            this.currentCandidates.splice(index, 1);
        }
        
        // 更新UI
        this.updateStartupPanel();
        this.updateCandidateList();
        
        alert(`成功招聘 ${employee.position} - ${employee.name}，月薪 ${finalSalary.toLocaleString()} 元`);
    },
    
    /**
     * 招聘员工（保留原函数名以兼容）
     */
    hireEmployee(employee) {
        // 兼容旧代码，直接添加员工
        const maxEmployees = this.getMaxEmployees();
        if (this.player.startup.employees.length >= maxEmployees) {
            alert('已达到最大员工数');
            return;
        }
        
        this.player.startup.employees.push(employee);
        this.updateStartupPanel();
        alert(`成功招聘 ${employee.position} - ${employee.name}`);
        
        // 返回创业管理主界面
        this.showPanel('startup-management');
    },
    
    /**
     * 计算最大员工数
     */
    getMaxEmployees() {
        if (!this.player.startup) return 5;
        
        let adminAbility = this.player.startup.employees
            .filter(emp => emp.position === '行政')
            .reduce((sum, emp) => sum + emp.ability, 0);
        
        // 如果玩家担任行政岗位，也要计算玩家的能力
        if (this.player.startup.playerEmployee && this.player.startup.playerEmployee.position === '行政') {
            adminAbility += this.getPlayerAbilityByPosition('行政');
        }
        
        const base = 5;
        const additional = Math.floor(adminAbility / 10);
        return base + additional;
    },
    
    /**
     * 获取指定岗位的员工能力总和（包含玩家）
     * @param {string} position - 岗位名称
     * @param {number} projectIndex - 项目索引（可选），如果提供则只计算分配给该项目的员工
     */
    getTotalAbilityByPosition(position, projectIndex = null) {
        if (!this.player.startup) return 0;
        
        let total = 0;
        
        // 如果指定了项目，只计算分配给该项目的员工
        if (projectIndex !== null && this.player.startup.projects[projectIndex]) {
            const project = this.player.startup.projects[projectIndex];
            const assignedEmployees = project.assignedEmployees || [];
            
            assignedEmployees.forEach(empId => {
                if (empId === 'player') {
                    // 玩家
                    if (this.player.startup.playerEmployee && this.player.startup.playerEmployee.position === position) {
                        total += this.getPlayerAbilityByPosition(position);
                    }
                } else {
                    // 普通员工
                    const emp = this.player.startup.employees[empId];
                    if (emp && emp.position === position) {
                        total += emp.ability;
                    }
                }
            });
        } else {
            // 计算所有员工（包括玩家）
            total = this.player.startup.employees
                .filter(emp => emp.position === position)
                .reduce((sum, emp) => sum + emp.ability, 0);
            
            // 如果玩家担任该岗位，也要计算玩家的能力
            if (this.player.startup.playerEmployee && this.player.startup.playerEmployee.position === position) {
                total += this.getPlayerAbilityByPosition(position);
            }
        }
        
        return total;
    },
    
    /**
     * 招聘员工
     */
    hireEmployee(employee) {
        const maxEmployees = this.getMaxEmployees();
        if (this.player.startup.employees.length >= maxEmployees) {
            alert('已达到最大员工数');
            return;
        }
        
        this.player.startup.employees.push(employee);
        this.updateStartupPanel();
        alert(`成功招聘 ${employee.position} - ${employee.name}`);
        
        // 返回创业管理主界面
        this.showPanel('startup-management');
    },
    
    /**
     * 辞退员工
     */
    fireEmployee(index) {
        if (!this.player.startup || index < 0 || index >= this.player.startup.employees.length) {
            return;
        }
        
        const employee = this.player.startup.employees[index];
        if (!confirm(`确定要辞退 ${employee.position} - ${employee.name} 吗？`)) {
            return;
        }
        
        // 检查该员工是否参与正在销售的项目
        const wasInSellingProjects = [];
        this.player.startup.projects.forEach((project, projIndex) => {
            if (project.status === 'selling' && 
                project.assignedEmployees && 
                project.assignedEmployees.includes(index)) {
                wasInSellingProjects.push(projIndex);
            }
        });
        
        // 从员工列表中移除
        this.player.startup.employees.splice(index, 1);
        
        // 更新所有项目的员工索引（因为删除了一个员工，后面的索引都要-1）
        this.player.startup.projects.forEach(project => {
            if (project.assignedEmployees) {
                project.assignedEmployees = project.assignedEmployees.map(empId => {
                    if (typeof empId === 'number' && empId > index) {
                        return empId - 1; // 索引减1
                    }
                    return empId;
                });
            }
        });
        
        // 如果该员工参与销售项目，重新计算收入
        wasInSellingProjects.forEach(projIndex => {
            const project = this.player.startup.projects[projIndex];
            if (project && project.status === 'selling') {
                const oldRevenue = project.monthlyRevenue;
                project.monthlyRevenue = this.calculateProjectRevenue(project);
                if (oldRevenue !== project.monthlyRevenue) {
                    console.log(`项目 ${project.name} 收入已更新：${oldRevenue.toLocaleString()} → ${project.monthlyRevenue.toLocaleString()} 元`);
                }
            }
        });
        
        this.updateStartupPanel();
        alert(`已辞退 ${employee.position} - ${employee.name}`);
    },
    
    /**
     * 根据岗位计算玩家的业务能力
     */
    getPlayerAbilityByPosition(position) {
        // 不同岗位使用不同的属性组合
        switch(position) {
            case '产品':
                // 产品岗位：主要看智商和沟通
                return Math.floor((this.player.attributes.intelligence + this.player.attributes.communication) / 2);
            case '研发':
                // 研发岗位：主要看智商和精力
                return Math.floor((this.player.attributes.intelligence + this.player.attributes.energy) / 2);
            case '销售':
                // 销售岗位：主要看沟通和精力
                return Math.floor((this.player.attributes.communication + this.player.attributes.energy) / 2);
            case '行政':
                // 行政岗位：主要看沟通和理想
                return Math.floor((this.player.attributes.communication + this.player.attributes.ideal) / 2);
            default:
                return 0;
        }
    },
    
    /**
     * 保存玩家员工设置（岗位和工资）
     */
    savePlayerEmployeeSettings() {
        if (!this.player.startup || !this.player.startup.playerEmployee) {
            return;
        }
        
        const salaryInput = document.getElementById('player-salary-input');
        const positionSelect = document.getElementById('player-position-select');
        
        if (!salaryInput || !positionSelect) {
            return;
        }
        
        const newSalary = parseInt(salaryInput.value) || 0;
        const newPosition = positionSelect.value;
        
        if (newSalary < 0) {
            alert('工资不能为负数');
            return;
        }
        
        const oldPosition = this.player.startup.playerEmployee.position;
        this.player.startup.playerEmployee.salary = newSalary;
        this.player.startup.playerEmployee.position = newPosition;
        
        // 如果玩家岗位改变，且正在销售的项目中有玩家参与，重新计算收入
        if (oldPosition !== newPosition) {
            this.player.startup.projects.forEach((project, index) => {
                if (project.status === 'selling' && 
                    project.assignedEmployees && 
                    project.assignedEmployees.includes('player')) {
                    // 检查玩家是否在销售岗位（旧岗位或新岗位）
                    if (oldPosition === '销售' || newPosition === '销售') {
                        const oldRevenue = project.monthlyRevenue;
                        project.monthlyRevenue = this.calculateProjectRevenue(project);
                        if (oldRevenue !== project.monthlyRevenue) {
                            console.log(`项目 ${project.name} 收入已更新：${oldRevenue.toLocaleString()} → ${project.monthlyRevenue.toLocaleString()} 元`);
                        }
                    }
                }
            });
        }
        
        this.updateStartupPanel();
        alert('设置已保存！');
    },
    
    /**
     * 评估项目可行性
     * @param {string} grade - 项目评级
     * @param {number} productAbility - 产品能力
     * @param {number} devAbility - 研发能力
     * @param {number} salesAbility - 销售能力
     * @returns {Object} 评估结果
     */
    evaluateProjectFeasibility(grade, productAbility, devAbility, salesAbility) {
        // 项目评级所需的最低能力要求
        const gradeRequirements = {
            'C': { product: 20, dev: 20, sales: 20, total: 60 },
            'B': { product: 50, dev: 50, sales: 50, total: 150 },
            'A': { product: 200, dev: 200, sales: 200, total: 600 },
            'S': { product: 1000, dev: 1000, sales: 1000, total: 3000 },
            'SS': { product: 5000, dev: 5000, sales: 5000, total: 15000 }
        };
        
        const requirements = gradeRequirements[grade] || gradeRequirements['C'];
        const totalAbility = productAbility + devAbility + salesAbility;
        
        // 计算可行性分数（0-100）
        let feasibility = 100;
        let warnings = [];
        let risks = [];
        
        // 检查各项能力是否满足要求
        if (productAbility < requirements.product) {
            const shortage = requirements.product - productAbility;
            feasibility -= shortage * 0.5;
            warnings.push(`产品能力不足（缺少${shortage}点）`);
        }
        
        if (devAbility < requirements.dev) {
            const shortage = requirements.dev - devAbility;
            feasibility -= shortage * 0.5;
            warnings.push(`研发能力不足（缺少${shortage}点）`);
        }
        
        if (salesAbility < requirements.sales) {
            const shortage = requirements.sales - salesAbility;
            feasibility -= shortage * 0.3;
            warnings.push(`销售能力不足（缺少${shortage}点）`);
        }
        
        if (totalAbility < requirements.total) {
            risks.push('团队综合能力可能不足以完成项目');
        }
        
        // 如果可行性低于50，标记为高风险
        if (feasibility < 50) {
            risks.push('高风险项目，建议先提升团队能力');
        }
        
        feasibility = Math.max(0, Math.min(100, feasibility));
        
        return {
            feasibility: Math.floor(feasibility),
            warnings: warnings,
            risks: risks,
            isRecommended: feasibility >= 70 && warnings.length === 0
        };
    },
    
    /**
     * 预估项目信息
     * @param {string} grade - 项目评级
     * @param {number} productAbility - 产品能力（预估）
     * @param {number} devAbility - 研发能力（预估）
     * @param {number} salesAbility - 销售能力（预估）
     * @returns {Object} 预估信息
     */
    estimateProjectInfo(grade, productAbility, devAbility, salesAbility) {
        // 基础时间配置
        const baseDesignMonthsByGrade = {
            'C': 1, 'B': 2, 'A': 3, 'S': 4, 'SS': 5
        };
        const baseMonthsByGrade = {
            'C': 3, 'B': 5, 'A': 8, 'S': 12, 'SS': 18
        };
        
        // 收入倍数配置
        const revenueMultiplierByGrade = {
            'C': 50, 'B': 100, 'A': 250, 'S': 750, 'SS': 3000
        };
        
        const baseDesignMonths = baseDesignMonthsByGrade[grade] || 3;
        const baseMonths = baseMonthsByGrade[grade] || 8;
        const baseMultiplier = revenueMultiplierByGrade[grade] || 100;
        
        // 预估设计时间（假设分配了产品员工）
        const estimatedDesignMonths = productAbility > 0 
            ? Math.max(1, Math.ceil(baseDesignMonths * (100 / (productAbility + 50))))
            : baseDesignMonths;
        
        // 预估研发时间（假设分配了研发员工）
        // 应用行业技术门槛影响
        let techImpact = 1.0;
        if (this.player.startup && this.player.startup.industry) {
            const techThreshold = this.player.startup.industry.techThreshold || 50;
            techImpact = 1.0 + (techThreshold - 50) / 50 * 0.3; // 技术门槛影响研发时间（-15%到+30%）
        }
        const estimatedDevMonths = devAbility > 0
            ? Math.max(1, Math.ceil(baseMonths * (100 / (devAbility + 50)) * techImpact))
            : Math.ceil(baseMonths * techImpact);
        
        // 预估月收入（假设分配了销售员工，使用初始效率系数和生命周期系数）
        const estimatedBaseRevenue = salesAbility * baseMultiplier;
        const estimatedEfficiencyFactor = this.calculateEfficiencyFactor(Math.max(1, Math.floor(salesAbility / 50))); // 粗略估算销售人数
        const estimatedLifecycleFactor = 1.0; // 初始生命周期系数
        const estimatedMonthlyRevenue = Math.floor(estimatedBaseRevenue * estimatedEfficiencyFactor * estimatedLifecycleFactor);
        
        return {
            designMonths: estimatedDesignMonths,
            devMonths: estimatedDevMonths,
            totalMonths: estimatedDesignMonths + estimatedDevMonths,
            estimatedMonthlyRevenue: estimatedMonthlyRevenue,
            estimatedYearlyRevenue: estimatedMonthlyRevenue * 12
        };
    },
    
    /**
     * 显示项目立项面板（改进版）
     */
    showProjectCreatePanel() {
        this.showPanel('project-create-panel');
        const projectOptions = document.getElementById('project-options');
        projectOptions.innerHTML = '';
        
        // 计算团队各项能力总和（包含玩家）
        const productAbility = this.getTotalAbilityByPosition('产品');
        const devAbility = this.getTotalAbilityByPosition('研发');
        const salesAbility = this.getTotalAbilityByPosition('销售');
        const totalAbility = productAbility + devAbility + salesAbility;
        
        // 检查是否有基本能力
        if (productAbility === 0 && devAbility === 0) {
            projectOptions.innerHTML = '<p style="color: #d32f2f;">没有产品或研发岗位员工，无法立项</p>';
            return;
        }
        
        // 生成可选项目列表（根据团队能力）
        const availableGrades = [];
        const allGrades = ['C', 'B', 'A', 'S', 'SS'];
        
        // 根据团队能力确定可立项的评级
        if (totalAbility >= 600) {
            availableGrades.push('SS', 'S', 'A', 'B', 'C');
        } else if (totalAbility >= 450) {
            availableGrades.push('S', 'A', 'B', 'C');
        } else if (totalAbility >= 300) {
            availableGrades.push('A', 'B', 'C');
        } else if (totalAbility >= 150) {
            availableGrades.push('B', 'C');
        } else {
            availableGrades.push('C');
        }
        
        // 为每个可立项的评级创建项目选项
        availableGrades.forEach(grade => {
            const evaluation = this.evaluateProjectFeasibility(grade, productAbility, devAbility, salesAbility);
            const estimate = this.estimateProjectInfo(grade, productAbility, devAbility, salesAbility);
            
            const item = document.createElement('div');
            item.className = 'list-item';
            
            // 根据可行性设置样式
            let itemStyle = '';
            let recommendationBadge = '';
            if (evaluation.isRecommended) {
                itemStyle = 'border: 2px solid #4caf50; background: #f1f8f4;';
                recommendationBadge = '<span style="background: #4caf50; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-left: 8px;">推荐</span>';
            } else if (evaluation.feasibility < 50) {
                itemStyle = 'border: 2px solid #f44336; background: #fff5f5;';
            } else {
                itemStyle = 'border: 2px solid #ff9800; background: #fff8f0;';
            }
            
            // 构建警告和风险提示
            let warningsHtml = '';
            if (evaluation.warnings.length > 0) {
                warningsHtml = '<div style="margin-top: 8px; padding: 8px; background: #fff3cd; border-radius: 4px; font-size: 12px;">';
                warningsHtml += '<strong style="color: #856404;">⚠️ 警告：</strong><ul style="margin: 4px 0; padding-left: 20px;">';
                evaluation.warnings.forEach(warning => {
                    warningsHtml += `<li style="color: #856404;">${warning}</li>`;
                });
                warningsHtml += '</ul></div>';
            }
            
            let risksHtml = '';
            if (evaluation.risks.length > 0) {
                risksHtml = '<div style="margin-top: 8px; padding: 8px; background: #f8d7da; border-radius: 4px; font-size: 12px;">';
                risksHtml += '<strong style="color: #721c24;">⚠️ 风险：</strong><ul style="margin: 4px 0; padding-left: 20px;">';
                evaluation.risks.forEach(risk => {
                    risksHtml += `<li style="color: #721c24;">${risk}</li>`;
                });
                risksHtml += '</ul></div>';
            }
            
            item.style.cssText = itemStyle + ' cursor: pointer; padding: 15px; margin-bottom: 12px; border-radius: 8px;';
            
            item.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <h4 style="margin: 0; color: #333;">${grade}级项目${recommendationBadge}</h4>
                    <span style="font-size: 12px; color: #666;">可行性：${evaluation.feasibility}%</span>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; font-size: 13px;">
                    <div>
                        <strong>团队能力：</strong><br>
                        产品：${productAbility} | 研发：${devAbility} | 销售：${salesAbility}
                    </div>
                    <div>
                        <strong>预估时间：</strong><br>
                        设计：${estimate.designMonths}月 | 研发：${estimate.devMonths}月<br>
                        <span style="color: #666; font-size: 11px;">总计：${estimate.totalMonths}个月</span>
                    </div>
                </div>
                
                <div style="background: #e3f2fd; padding: 8px; border-radius: 4px; margin-bottom: 8px; font-size: 12px;">
                    <strong>💰 预估收入：</strong>
                    月收入约 ${estimate.estimatedMonthlyRevenue.toLocaleString()} 元<br>
                    <span style="color: #666;">年收入约 ${estimate.estimatedYearlyRevenue.toLocaleString()} 元</span>
                </div>
                
                ${warningsHtml}
                ${risksHtml}
                
                <p style="color: #666; font-size: 11px; margin-top: 10px; margin-bottom: 0;">
                    💡 提示：立项后需要分配员工才能开始设计
                </p>
            `;
            
            item.addEventListener('click', () => {
                if (evaluation.feasibility < 30) {
                    if (!confirm(`该项目可行性较低（${evaluation.feasibility}%），确定要继续立项吗？`)) {
                        return;
                    }
                }
                this.createProject(grade, productAbility);
            });
            
            projectOptions.appendChild(item);
        });
        
        // 如果没有可立项的项目
        if (availableGrades.length === 0) {
            projectOptions.innerHTML = '<p style="color: #d32f2f;">团队能力不足，无法立项。建议先招聘员工提升团队能力。</p>';
        }
    },
    
    /**
     * 创建项目
     */
    createProject(grade, productAbility) {
        const project = {
            name: `${grade}级项目`,
            grade: grade,
            status: 'designing', // 先进入设计阶段
            designCurrentMonth: 0, // 设计当前进度
            designTotalMonths: 0, // 设计总时长
            currentMonth: 0, // 研发当前进度
            totalMonths: 0, // 研发总时长
            monthlyRevenue: 0,
            initialRevenue: 0, // 初始收入，用于计算最低收入
            assignedEmployees: [] // 分配给该项目的员工索引列表（包括玩家标记）
        };
        
        // 计算设计所需月数（根据项目难度和产品员工能力）
        // 不同级别项目的基础设计时间（级别越高，需要时间越长）
        const baseDesignMonthsByGrade = {
            'C': 1,   // C级：最简单，1个月基础设计时间
            'B': 2,   // B级：较简单，2个月基础设计时间
            'A': 3,   // A级：中等，3个月基础设计时间
            'S': 4,   // S级：较复杂，4个月基础设计时间
            'SS': 5   // SS级：最复杂，5个月基础设计时间
        };
        
        const baseDesignMonths = baseDesignMonthsByGrade[grade] || 3;
        
        // 先使用基础时间，分配员工后会重新计算
        project.designTotalMonths = baseDesignMonths;
        
        // 计算研发所需月数（项目级别和研发能力共同决定，包含玩家）
        // 不同级别项目的基础研发时间（级别越高，需要时间越长）
        const baseMonthsByGrade = {
            'C': 3,   // C级：最简单，3个月基础时间
            'B': 5,   // B级：较简单，5个月基础时间
            'A': 8,   // A级：中等，8个月基础时间
            'S': 12,  // S级：较复杂，12个月基础时间
            'SS': 18  // SS级：最复杂，18个月基础时间
        };
        
        const baseMonths = baseMonthsByGrade[grade] || 8;
        
        // 先使用基础时间，分配员工后会重新计算
        project.totalMonths = baseMonths;
        
        const projectIndex = this.player.startup.projects.length;
        this.player.startup.projects.push(project);
        this.updateStartupPanel();
        this.showPanel('startup-management');
        alert(`项目立项成功！请先分配员工，然后项目会自动开始设计`);
        
        // 自动打开员工分配面板
        setTimeout(() => {
            this.showAssignEmployeesPanel(projectIndex);
        }, 500);
    },
    
    /**
     * 研发产品
     */
    developProduct() {
        if (!this.player.startup) {
            alert('你还没有创业');
            return;
        }
        
        // 检查是否有设计中的项目
        const designingProjects = this.player.startup.projects.filter(p => p.status === 'designing');
        if (designingProjects.length > 0) {
            alert('还有项目正在设计中，请等待设计完成');
            return;
        }
        
        const developingProjects = this.player.startup.projects.filter(p => p.status === 'developing');
        if (developingProjects.length === 0) {
            alert('没有正在研发的项目');
            return;
        }
        
        developingProjects.forEach(project => {
            project.currentMonth++;
            if (project.currentMonth >= project.totalMonths) {
                project.status = 'completed';
                alert(`${project.name} 研发完成！`);
            }
        });
        
        this.updateStartupPanel();
    },
    
    /**
     * 开始研发
     */
    startDevelop(projectIndex) {
        if (!this.player.startup) return;
        
        const project = this.player.startup.projects[projectIndex];
        if (!project || project.status !== 'design_completed') {
            alert('该项目设计未完成，无法开始研发');
            return;
        }
        
        // 检查是否已分配员工
        if (!project.assignedEmployees || project.assignedEmployees.length === 0) {
            alert('请先分配员工才能开始研发');
            return;
        }
        
        // 检查是否分配了研发岗位的员工
        const devAbility = this.getTotalAbilityByPosition('研发', projectIndex);
        if (devAbility === 0) {
            alert('请先分配研发岗位的员工才能开始研发');
            return;
        }
        
        // 重新计算研发时间（基于分配的员工）
        const baseMonthsByGrade = {
            'C': 3, 'B': 5, 'A': 8, 'S': 12, 'SS': 18
        };
        const baseMonths = baseMonthsByGrade[project.grade] || 8;
        
        // 应用行业技术门槛影响
        let techImpact = 1.0;
        if (this.player.startup && this.player.startup.industry) {
            const techThreshold = this.player.startup.industry.techThreshold || 50;
            techImpact = 1.0 + (techThreshold - 50) / 50 * 0.3; // 技术门槛影响研发时间（-15%到+30%）
        }
        
        project.totalMonths = Math.max(1, Math.ceil(baseMonths * (100 / (devAbility + 50)) * techImpact));
        
        // 转为研发状态，研发进度从0开始
        project.status = 'developing';
        project.currentMonth = 0;
        
        this.updateStartupPanel();
        alert(`${project.name} 开始研发！预计需要 ${project.totalMonths} 个月完成`);
    },
    
    /**
     * 显示员工分配面板
     */
    showAssignEmployeesPanel(projectIndex) {
        if (!this.player.startup || !this.player.startup.projects[projectIndex]) {
            return;
        }
        
        const project = this.player.startup.projects[projectIndex];
        this.currentAssigningProjectIndex = projectIndex; // 保存当前分配的项目索引
        
        // 显示项目名称
        document.getElementById('assign-project-name').textContent = `项目：${project.name} (${project.grade}级)`;
        
        // 获取所有可用员工（未被分配到其他未完成项目的员工）
        const availableEmployees = [];
        const assignedToOtherProjects = new Set();
        
        // 找出所有被分配到其他未完成项目的员工
        this.player.startup.projects.forEach((p, idx) => {
            if (idx !== projectIndex && p.status !== 'completed' && p.status !== 'selling' && p.assignedEmployees) {
                p.assignedEmployees.forEach(empId => {
                    assignedToOtherProjects.add(empId);
                });
            }
        });
        
        // 添加玩家（如果未被分配）
        if (!assignedToOtherProjects.has('player')) {
            availableEmployees.push({
                id: 'player',
                name: this.player.name + ' (你)',
                position: this.player.startup.playerEmployee ? this.player.startup.playerEmployee.position : '产品',
                ability: this.getPlayerAbilityByPosition(this.player.startup.playerEmployee ? this.player.startup.playerEmployee.position : '产品'),
                isPlayer: true
            });
        }
        
        // 添加其他员工（如果未被分配）
        this.player.startup.employees.forEach((emp, idx) => {
            if (!assignedToOtherProjects.has(idx)) {
                availableEmployees.push({
                    id: idx,
                    name: emp.name,
                    position: emp.position,
                    ability: emp.ability,
                    isPlayer: false
                });
            }
        });
        
        // 显示可用员工列表
        const availableList = document.getElementById('available-employees-list');
        availableList.innerHTML = '';
        
        if (availableEmployees.length === 0) {
            availableList.innerHTML = '<p>没有可用员工</p>';
        } else {
            availableEmployees.forEach(emp => {
                const item = document.createElement('div');
                item.className = 'list-item';
                item.innerHTML = `
                    <h4>${emp.name}</h4>
                    <p>岗位：${emp.position}</p>
                    <p>业务能力：${emp.ability}</p>
                    <button class="btn btn-primary assign-emp-btn" data-emp-id="${emp.id}" style="margin-top: 8px; padding: 6px 12px; font-size: 14px;">分配</button>
                `;
                
                const assignBtn = item.querySelector('.assign-emp-btn');
                assignBtn.addEventListener('click', () => {
                    this.assignEmployeeToProject(emp.id);
                });
                
                availableList.appendChild(item);
            });
        }
        
        // 显示已分配员工列表
        this.updateAssignedEmployeesList();
        
        this.showPanel('assign-employees-panel');
    },
    
    /**
     * 更新已分配员工列表显示
     */
    updateAssignedEmployeesList() {
        const assignedList = document.getElementById('assigned-employees-list');
        assignedList.innerHTML = '';
        
        if (!this.player.startup || this.currentAssigningProjectIndex === undefined) {
            return;
        }
        
        const project = this.player.startup.projects[this.currentAssigningProjectIndex];
        const assignedEmployees = project.assignedEmployees || [];
        
        if (assignedEmployees.length === 0) {
            assignedList.innerHTML = '<p>未分配员工</p>';
        } else {
            assignedEmployees.forEach(empId => {
                const item = document.createElement('div');
                item.className = 'list-item';
                
                if (empId === 'player') {
                    const playerEmp = this.player.startup.playerEmployee;
                    item.innerHTML = `
                        <h4>${this.player.name} (你)</h4>
                        <p>岗位：${playerEmp ? playerEmp.position : '产品'}</p>
                        <p>业务能力：${this.getPlayerAbilityByPosition(playerEmp ? playerEmp.position : '产品')}</p>
                        <button class="btn btn-secondary remove-emp-btn" data-emp-id="player" style="margin-top: 8px; padding: 6px 12px; font-size: 14px;">移除</button>
                    `;
                } else {
                    const emp = this.player.startup.employees[empId];
                    if (emp) {
                        item.innerHTML = `
                            <h4>${emp.name}</h4>
                            <p>岗位：${emp.position}</p>
                            <p>业务能力：${emp.ability}</p>
                            <button class="btn btn-secondary remove-emp-btn" data-emp-id="${empId}" style="margin-top: 8px; padding: 6px 12px; font-size: 14px;">移除</button>
                        `;
                    }
                }
                
                const removeBtn = item.querySelector('.remove-emp-btn');
                removeBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.removeEmployeeFromProject(empId);
                });
                
                assignedList.appendChild(item);
            });
        }
    },
    
    /**
     * 分配员工到项目
     */
    assignEmployeeToProject(empId) {
        if (!this.player.startup || this.currentAssigningProjectIndex === undefined) {
            return;
        }
        
        const project = this.player.startup.projects[this.currentAssigningProjectIndex];
        if (!project.assignedEmployees) {
            project.assignedEmployees = [];
        }
        
        // 检查是否已分配
        if (project.assignedEmployees.includes(empId)) {
            alert('该员工已分配到此项目');
            return;
        }
        
        project.assignedEmployees.push(empId);
        this.updateAssignedEmployeesList();
        this.showAssignEmployeesPanel(this.currentAssigningProjectIndex); // 刷新可用员工列表
    },
    
    /**
     * 从项目中移除员工
     */
    removeEmployeeFromProject(empId) {
        if (!this.player.startup || this.currentAssigningProjectIndex === undefined) {
            return;
        }
        
        const project = this.player.startup.projects[this.currentAssigningProjectIndex];
        if (!project.assignedEmployees) {
            return;
        }
        
        const index = project.assignedEmployees.indexOf(empId);
        if (index > -1) {
            project.assignedEmployees.splice(index, 1);
            this.updateAssignedEmployeesList();
            // 只更新可用员工列表，不重新渲染整个面板，避免触发验证
            // 获取所有可用员工（未被分配到其他未完成项目的员工）
            const availableEmployees = [];
            const assignedToOtherProjects = new Set();
            
            // 找出所有被分配到其他未完成项目的员工
            this.player.startup.projects.forEach((p, idx) => {
                if (idx !== this.currentAssigningProjectIndex && p.status !== 'completed' && p.status !== 'selling' && p.assignedEmployees) {
                    p.assignedEmployees.forEach(empId => {
                        assignedToOtherProjects.add(empId);
                    });
                }
            });
            
            // 添加玩家（如果未被分配）
            if (!assignedToOtherProjects.has('player')) {
                availableEmployees.push({
                    id: 'player',
                    name: this.player.name + ' (你)',
                    position: this.player.startup.playerEmployee ? this.player.startup.playerEmployee.position : '产品',
                    ability: this.getPlayerAbilityByPosition(this.player.startup.playerEmployee ? this.player.startup.playerEmployee.position : '产品'),
                    isPlayer: true
                });
            }
            
            // 添加其他员工（如果未被分配）
            this.player.startup.employees.forEach((emp, idx) => {
                if (!assignedToOtherProjects.has(idx)) {
                    availableEmployees.push({
                        id: idx,
                        name: emp.name,
                        position: emp.position,
                        ability: emp.ability,
                        isPlayer: false
                    });
                }
            });
            
            // 更新可用员工列表显示
            const availableList = document.getElementById('available-employees-list');
            availableList.innerHTML = '';
            
            if (availableEmployees.length === 0) {
                availableList.innerHTML = '<p>没有可用员工</p>';
            } else {
                availableEmployees.forEach(emp => {
                    const item = document.createElement('div');
                    item.className = 'list-item';
                    item.innerHTML = `
                        <h4>${emp.name}</h4>
                        <p>岗位：${emp.position}</p>
                        <p>业务能力：${emp.ability}</p>
                        <button class="btn btn-primary assign-emp-btn" data-emp-id="${emp.id}" style="margin-top: 8px; padding: 6px 12px; font-size: 14px;">分配</button>
                    `;
                    
                    const assignBtn = item.querySelector('.assign-emp-btn');
                    assignBtn.addEventListener('click', () => {
                        this.assignEmployeeToProject(emp.id);
                    });
                    
                    availableList.appendChild(item);
                });
            }
        }
    },
    
    /**
     * 保存员工分配
     */
    saveEmployeeAssignments() {
        if (!this.player.startup || this.currentAssigningProjectIndex === undefined) {
            return;
        }
        
        const project = this.player.startup.projects[this.currentAssigningProjectIndex];
        
        if (!project.assignedEmployees || project.assignedEmployees.length === 0) {
            alert('请至少分配一个员工');
            return;
        }
        
        // 重新计算项目时间（基于分配的员工）
        if (project.status === 'designing') {
            const productAbility = this.getTotalAbilityByPosition('产品', this.currentAssigningProjectIndex);
            const baseDesignMonthsByGrade = {
                'C': 1, 'B': 2, 'A': 3, 'S': 4, 'SS': 5
            };
            const baseDesignMonths = baseDesignMonthsByGrade[project.grade] || 3;
            
            if (productAbility === 0) {
                project.designTotalMonths = baseDesignMonths;
            } else {
                project.designTotalMonths = Math.max(1, Math.ceil(baseDesignMonths * (100 / (productAbility + 50))));
            }
        }
        
        // 如果项目正在销售，重新计算收入（因为销售团队可能变化）
        if (project.status === 'selling') {
            const oldRevenue = project.monthlyRevenue;
            project.monthlyRevenue = this.calculateProjectRevenue(project);
            if (oldRevenue !== project.monthlyRevenue) {
                console.log(`项目 ${project.name} 收入已更新：${oldRevenue.toLocaleString()} → ${project.monthlyRevenue.toLocaleString()} 元`);
            }
        }
        
        this.currentAssigningProjectIndex = undefined;
        this.updateStartupPanel();
        this.showPanel('startup-management');
        alert('员工分配已保存！');
    },
    
    /**
     * 开始销售（全局函数，供HTML调用）
     */
    startSales(projectIndex) {
        if (!this.player.startup) return;
        
        const project = this.player.startup.projects[projectIndex];
        if (!project || project.status !== 'completed') return;
        
        // 检查是否已分配员工
        if (!project.assignedEmployees || project.assignedEmployees.length === 0) {
            alert('请先分配员工才能开始销售');
            return;
        }
        
        // 计算销售能力总和（只计算分配给该项目的员工）
        const salesAbility = this.getTotalAbilityByPosition('销售', projectIndex);
        
        if (salesAbility === 0) {
            alert('没有销售岗位员工分配给该项目');
            return;
        }
        
        // 记录开始销售的时间
        project.salesStartMonth = this.currentTurn;
        project.status = 'selling';
        
        // 使用动态计算函数计算初始收入
        project.monthlyRevenue = this.calculateProjectRevenue(project);
        project.initialRevenue = project.monthlyRevenue; // 保存初始收入用于显示
        
        this.updateStartupPanel();
        alert(`${project.name} 开始销售，预计每月收入 ${project.monthlyRevenue.toLocaleString()} 元`);
    },
    
    /**
     * 推广销售
     */
    promoteSales() {
        if (!this.player.startup) {
            alert('你还没有创业');
            return;
        }
        
        const sellingProjects = this.player.startup.projects.filter(p => p.status === 'selling');
        if (sellingProjects.length === 0) {
            alert('没有正在销售的项目');
            return;
        }
        
        sellingProjects.forEach(project => {
            // 每回合收入减少5%-15%
            const decreaseRate = this.randomInt(5, 15) / 100; // 5%到15%的随机减少率
            const newRevenue = project.monthlyRevenue * (1 - decreaseRate);
            
            // 最低收入不低于初始收入的20%
            const minRevenue = project.initialRevenue * 0.2;
            project.monthlyRevenue = Math.max(minRevenue, newRevenue);
            
            // 将收入加入公司账户
            this.player.startup.balance += project.monthlyRevenue;
        });
        
        this.updateStartupPanel();
        alert('本月销售完成，收入已加入公司账户');
    },
    
    /**
     * 总结学习
     */
    learnSummary() {
        if (!this.player.startup) {
            alert('你还没有创业');
            return;
        }
        
        const cost = 10000;
        if (this.player.startup.balance < cost) {
            alert('公司余额不足');
            return;
        }
        
        this.player.startup.balance -= cost;
        
        // 随机增加一个属性
        const attributes = ['energy', 'intelligence', 'communication', 'luck', 'ideal'];
        const randomAttr = attributes[this.randomInt(0, attributes.length - 1)];
        const increase = this.randomInt(1, 5);
        this.player.attributes[randomAttr] += increase;
        
        this.updatePlayerPanel();
        this.updateStartupPanel();
        alert(`总结学习完成！${this.getAttributeName(randomAttr)} +${increase}`);
    },
    
    /**
     * 获取属性中文名
     */
    getAttributeName(attr) {
        const names = {
            energy: '精力',
            intelligence: '智商',
            communication: '沟通',
            luck: '气运',
            ideal: '理想'
        };
        return names[attr] || attr;
    },
    
    /**
     * 下一回合
     */
    nextTurn() {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/d420deeb-fad3-4d2f-a745-655aa7abb486',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'script.js:1931',message:'nextTurn called',data:{currentTurnBefore:this.currentTurn,isExecuting:this.isNextTurnExecuting,stack:new Error().stack},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        console.log('nextTurn function called');
        
        // 防止重复执行
        if (this.isNextTurnExecuting) {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/d420deeb-fad3-4d2f-a745-655aa7abb486',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'script.js:1935',message:'nextTurn blocked - already executing',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
            // #endregion
            console.log('nextTurn already executing, ignoring duplicate call');
            return;
        }
        
        // 如果正在显示事件，不能进入下一回合
        if (this.gameState === 'event') {
            alert('请先处理完当前事件');
            return;
        }
        
        // 标记为正在执行（使用try-finally确保总是重置）
        this.isNextTurnExecuting = true;
        
        try {
        
        console.log('Current turn:', this.currentTurn);
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/d420deeb-fad3-4d2f-a745-655aa7abb486',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'script.js:1940',message:'before currentTurn++',data:{currentTurn:this.currentTurn},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        this.currentTurn++;
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/d420deeb-fad3-4d2f-a745-655aa7abb486',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'script.js:1941',message:'after currentTurn++',data:{currentTurn:this.currentTurn},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        this.player.age = 22 + Math.floor(this.currentTurn / 12);
        document.getElementById('current-turn').textContent = this.currentTurn;
        
        // 扣除每月开销
        const monthlyExpenses = this.calculateMonthlyExpenses();
        this.player.money -= monthlyExpenses;
        
        // 应用生活标准的属性提升
        this.applyLivingStandardBenefits();
        
        // 检查存款是否不足
        if (this.player.money < 0) {
            alert(`警告：存款不足！当前欠款 ${Math.abs(this.player.money).toLocaleString()} 元`);
        }
        
        // 根据当前状态处理回合逻辑
        if (this.player.currentJob) {
            // 工作状态
            // 确保基础薪资存在
            if (!this.player.currentJob.baseSalary) {
                this.player.currentJob.baseSalary = this.player.currentJob.salary || 0;
            }
            
            // 使用新的薪资计算方式（多因素计算）
            const finalSalary = this.calculateFinalSalary();
            this.player.money += finalSalary;
            
            this.player.workYears += 1/12; // 增加工作年限
            this.player.workMonths = (this.player.workMonths || 0) + 1; // 增加工作月数
            this.player.totalWorkMonths = (this.player.totalWorkMonths || 0) + 1; // 增加总工作月数
            this.player.workActionUsed = false; // 重置工作行动使用状态
            
            // 更新工作表现历史记录
            if (!this.player.workHistory) {
                this.player.workHistory = {
                    recentPerformance: [],
                    lastPromotionMonth: 0,
                    lastJobChangeMonth: 0,
                    lastSalaryIncreaseMonth: 0,
                    lastQuarterlyBonusMonth: 0
                };
            }
            this.updateWorkPerformanceOverall();
            const currentPerf = {
                quality: this.player.workPerformance.quality,
                efficiency: this.player.workPerformance.efficiency,
                teamwork: this.player.workPerformance.teamwork,
                initiative: this.player.workPerformance.initiative,
                overall: this.player.workPerformance.overall
            };
            this.player.workHistory.recentPerformance.push(currentPerf);
            // 只保留最近6个月的记录
            if (this.player.workHistory.recentPerformance.length > 6) {
                this.player.workHistory.recentPerformance.shift();
            }
            
            // 计算绩效奖金（包含季度奖金）
            const performanceBonus = this.calculatePerformanceBonus();
            if (performanceBonus > 0) {
                this.player.money += performanceBonus;
                // 季度奖金单独提示
                const quarterlyBonus = this.calculateQuarterlyBonus();
                if (quarterlyBonus > 0 && this.player.workMonths % 3 === 0) {
                    alert(`季度奖金发放！获得${quarterlyBonus.toLocaleString()}元`);
                }
            }
            
            // 计算年终奖
            const yearEndBonus = this.calculateYearEndBonus();
            if (yearEndBonus > 0) {
                this.player.money += yearEndBonus;
                alert(`年终奖发放！获得${yearEndBonus.toLocaleString()}元`);
            }
            
            // 计算副业收入
            const sideJobIncome = this.calculateSideJobIncome();
            if (sideJobIncome > 0) {
                this.player.money += sideJobIncome;
            }
            
            // 年增长机制：每年自动增长3-8%（基于工作表现）
            const workMonths = this.player.workMonths || 0;
            if (workMonths > 0 && workMonths % 12 === 0) {
                const lastIncreaseMonth = this.player.workHistory.lastSalaryIncreaseMonth || 0;
                if (workMonths !== lastIncreaseMonth) {
                    this.updateWorkPerformanceOverall();
                    const performance = this.player.workPerformance.overall;
                    // 年增长：3-8%（基于工作表现，表现越好增长越多）
                    const growthRate = 0.03 + (performance - 50) / 50 * 0.05; // 50分3%，100分8%
                    const oldBaseSalary = this.player.currentJob.baseSalary;
                    this.player.currentJob.baseSalary = Math.floor(oldBaseSalary * (1 + growthRate));
                    this.player.workHistory.lastSalaryIncreaseMonth = workMonths;
                    alert(`年度调薪！基础薪资从${oldBaseSalary.toLocaleString()}元提升到${this.player.currentJob.baseSalary.toLocaleString()}元（增长${(growthRate * 100).toFixed(1)}%）`);
                }
            }
            
            // 工作表现自然变化机制
            // 如果连续3个月没有积极行动，各维度-1
            const recentActions = this.player.workHistory.recentPerformance || [];
            if (recentActions.length >= 3) {
                const last3Months = recentActions.slice(-3);
                // 检查最近3个月的表现是否都在下降（简单判断：如果最近的表现比3个月前低超过5分）
                const firstPerf = last3Months[0].overall || last3Months[0];
                const lastPerf = last3Months[last3Months.length - 1].overall || last3Months[last3Months.length - 1];
                if (lastPerf < firstPerf - 5 && this.player.workActionUsed === false) {
                    // 没有积极行动，各维度-1
                    this.player.workPerformance.quality = Math.max(0, this.player.workPerformance.quality - 1);
                    this.player.workPerformance.efficiency = Math.max(0, this.player.workPerformance.efficiency - 1);
                    this.player.workPerformance.teamwork = Math.max(0, this.player.workPerformance.teamwork - 1);
                    this.player.workPerformance.initiative = Math.max(0, this.player.workPerformance.initiative - 1);
                    this.updateWorkPerformanceOverall();
                }
            }
            
            // 如果工作表现过高（>90），可能触发"倦怠"状态，效率下降
            if (this.player.workPerformance.overall > 90 && Math.random() < 0.2) {
                this.player.workPerformance.efficiency = Math.max(0, this.player.workPerformance.efficiency - 1);
                this.updateWorkPerformanceOverall();
            }
            
            this.updatePlayerPanel();
            this.updateWorkPanel();
            
            // 工作事件有30%概率触发
            if (Math.random() < 0.3) {
                this.triggerEvent('work');
            }
        } else if (this.player.graduate) {
            // 研究生状态
            const graduate = this.player.graduate;
            
            // 每月基础补助
            this.player.money += 1000;
            
            // 奖学金收入
            if (graduate.scholarship) {
                this.player.money += graduate.scholarship.monthlyIncome;
            }
            
            // 实习收入
            if (graduate.internship) {
                this.player.money += graduate.internship.monthlyIncome;
            }
            
            // 更新学习月数
            graduate.studyMonths = this.currentTurn - graduate.startTurn;
            
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/d420deeb-fad3-4d2f-a745-655aa7abb486',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'script.js:6835',message:'Resetting graduateActionUsed in nextTurn',data:{before:this.player.graduateActionUsed,currentTurn:this.currentTurn},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'B'})}).catch(()=>{});
            // #endregion
            
            // 重置研究生行动使用状态
            this.player.graduateActionUsed = false;
            
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/d420deeb-fad3-4d2f-a745-655aa7abb486',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'script.js:6840',message:'graduateActionUsed reset to false',data:{after:this.player.graduateActionUsed},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'B'})}).catch(()=>{});
            // #endregion
            
            // 更新学术能力综合评分
            this.updateAcademicAbilityOverall();
            
            // 检查是否满足毕业条件
            const req = graduate.graduationRequirement;
            const canGraduate = graduate.studyMonths >= req.minMonths &&
                               graduate.academicPoints >= req.minAcademicPoints &&
                               graduate.academicAbility.overall >= req.minOverallAbility;
            
            if (canGraduate) {
                // 满足所有毕业条件，自动毕业
                alert('恭喜！你已满足所有毕业条件，自动毕业！');
                this.graduate();
            } else {
                // 检查是否超过最长学习时间（2倍）
                if (graduate.studyMonths >= req.minMonths * 2) {
                    alert('学习时间过长，强制毕业（未满足所有条件）');
                    this.graduate();
                } else {
                    // 随机触发研究生事件（概率触发）
                    const eventProbability = this.calculateGraduateEventProbability();
                    if (Math.random() < eventProbability) {
                        this.triggerEvent('graduate');
                    }
                }
            }
            
            this.updateGraduatePanel();
            this.updatePlayerPanel();
        } else if (this.player.startup) {
            // 创业状态
            // 支付员工工资（包含玩家）
            let totalSalary = this.player.startup.employees.reduce((sum, emp) => sum + emp.salary, 0);
            let playerSalary = 0;
            if (this.player.startup.playerEmployee) {
                playerSalary = this.player.startup.playerEmployee.salary;
                totalSalary += playerSalary;
            }
            
            // 应用行业资金需求影响运营成本
            let costMultiplier = 1.0;
            if (this.player.startup.industry) {
                const capitalNeed = this.player.startup.industry.capitalNeed || 50;
                // 资金需求影响成本（-15%到+30%）
                costMultiplier = 1.0 + (capitalNeed - 50) / 50 * 0.3;
            }
            
            // 基础运营成本（除了员工薪资外，还有固定运营成本）
            const baseOperatingCost = 5000; // 每月基础运营成本5000元
            const totalOperatingCost = (totalSalary + baseOperatingCost) * costMultiplier;
            
            this.player.startup.balance -= totalOperatingCost;
            
            // 玩家作为员工获得的工资转入个人账户
            if (playerSalary > 0) {
                this.player.money += playerSalary;
            }
            
            // 处理贷款偿还
            if (this.player.startup.loans && this.player.startup.loans.length > 0) {
                this.player.startup.loans = this.player.startup.loans.filter(loan => {
                    // 检查是否已还清
                    if (loan.remainingMonths <= 0 || loan.remainingAmount <= 0) {
                        return false; // 移除已还清的贷款
                    }
                    
                    // 计算本月还款额
                    const payment = Math.min(loan.monthlyPayment, loan.remainingAmount);
                    
                    // 从公司账户扣除
                    if (this.player.startup.balance >= payment) {
                        this.player.startup.balance -= payment;
                        loan.remainingAmount -= payment;
                        loan.remainingMonths--;
                    } else {
                        // 账户余额不足，逾期处理
                        // 先尝试从个人账户扣除
                        if (this.player.money >= payment) {
                            this.player.money -= payment;
                            loan.remainingAmount -= payment;
                            loan.remainingMonths--;
                            alert(`警告：公司账户余额不足，已从个人账户扣除 ${payment.toLocaleString()} 元用于偿还贷款`);
                        } else {
                            // 完全无法偿还，增加逾期利息或触发破产
                            loan.remainingAmount += payment * 0.1; // 增加10%逾期费用
                            alert(`严重警告：无法偿还贷款，已产生逾期费用！逾期金额 ${payment.toLocaleString()} 元`);
                        }
                    }
                    
                    return true; // 保留未还清的贷款
                });
            }
            
            // 自动处理销售项目收入（动态计算）
            const sellingProjects = this.player.startup.projects.filter(p => p.status === 'selling');
            sellingProjects.forEach(project => {
                // 每回合重新计算收入（考虑当前销售团队和项目生命周期）
                project.monthlyRevenue = this.calculateProjectRevenue(project);
                
                // 将收入加入公司账户
                this.player.startup.balance += project.monthlyRevenue;
            });
            
            // 自动推进设计项目（只推进已分配员工的项目）
            const designingProjects = this.player.startup.projects.filter(p => p.status === 'designing');
            designingProjects.forEach((project, index) => {
                // 检查是否已分配员工
                if (!project.assignedEmployees || project.assignedEmployees.length === 0) {
                    return; // 未分配员工，不推进
                }
                
                // 重新计算设计时间（基于分配的员工）
                const productAbility = this.getTotalAbilityByPosition('产品', index);
                const baseDesignMonthsByGrade = {
                    'C': 1, 'B': 2, 'A': 3, 'S': 4, 'SS': 5
                };
                const baseDesignMonths = baseDesignMonthsByGrade[project.grade] || 3;
                
                if (productAbility === 0) {
                    project.designTotalMonths = baseDesignMonths;
                } else {
                    project.designTotalMonths = Math.max(1, Math.ceil(baseDesignMonths * (100 / (productAbility + 50))));
                }
                
                project.designCurrentMonth++;
                if (project.designCurrentMonth >= project.designTotalMonths) {
                    // 设计完成，转为设计完成状态，等待玩家手动开始研发
                    project.status = 'design_completed';
                    alert(`${project.name} 设计完成！请点击"开始研发"按钮开始研发`);
                }
            });
            
            // 自动推进研发项目（只推进已分配员工的项目）
            const developingProjects = this.player.startup.projects.filter(p => p.status === 'developing');
            developingProjects.forEach((project, index) => {
                // 检查是否已分配员工
                if (!project.assignedEmployees || project.assignedEmployees.length === 0) {
                    return; // 未分配员工，不推进
                }
                
                // 重新计算研发时间（基于分配的员工）
                const devAbility = this.getTotalAbilityByPosition('研发', index);
                const baseMonthsByGrade = {
                    'C': 3, 'B': 5, 'A': 8, 'S': 12, 'SS': 18
                };
                const baseMonths = baseMonthsByGrade[project.grade] || 8;
                
                // 应用行业技术门槛影响
                let techImpact = 1.0;
                if (this.player.startup && this.player.startup.industry) {
                    const techThreshold = this.player.startup.industry.techThreshold || 50;
                    techImpact = 1.0 + (techThreshold - 50) / 50 * 0.3; // 技术门槛影响研发时间（-15%到+30%）
                }
                
                if (devAbility === 0) {
                    project.totalMonths = Math.ceil(baseMonths * techImpact);
                } else {
                    project.totalMonths = Math.max(1, Math.ceil(baseMonths * (100 / (devAbility + 50)) * techImpact));
                }
                
                project.currentMonth++;
                if (project.currentMonth >= project.totalMonths) {
                    project.status = 'completed';
                    // 项目完成，释放员工（但保留列表，因为可能还需要销售）
                    // 销售阶段结束后再释放
                    alert(`${project.name} 研发完成！`);
                }
            });
            
            // 检查公司是否破产
            if (this.player.startup.balance < 0) {
                alert('公司破产了！');
                this.player.startup = null;
                this.player.career = '待业';
                this.showChoicePanel(['work', 'startup']);
            } else {
                this.updateStartupPanel();
                // 创业事件有30%概率触发
                if (Math.random() < 0.1) {
                    this.triggerEvent('startup');
                }
            }
        } else {
            // 待业状态，不触发事件，但更新面板
            this.updatePlayerPanel();
        }
        
        this.updatePlayerPanel();
        } finally {
            // 重置执行标志（确保即使出错也会重置）
            this.isNextTurnExecuting = false;
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/d420deeb-fad3-4d2f-a745-655aa7abb486',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'script.js:2137',message:'nextTurn completed',data:{currentTurnAfter:this.currentTurn},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
            // #endregion
        }
    },
    
    /**
     * 触发随机事件
     */
    triggerEvent(type) {
        // 对于研究生事件，使用筛选后的事件列表
        let availableEvents;
        if (type === 'graduate') {
            availableEvents = this.filterAvailableGraduateEvents();
            // 如果没有可用事件，使用旧格式的事件作为后备
            if (availableEvents.length === 0) {
                availableEvents = this.data.events[type] || [];
            }
        } else {
            availableEvents = this.data.events[type] || [];
        }
        
        if (availableEvents.length === 0) return;
        
        const event = availableEvents[this.randomInt(0, availableEvents.length - 1)];
        
        // 根据事件类型设置不同的检定难度
        let checkValue;
        if (type === 'work') {
            // 工作事件：难度降低，范围30-70，更容易通过
            checkValue = this.randomInt(30, 70);
        } else if (type === 'graduate') {
            // 研究生事件：根据多个因素动态调整难度
            // 兼容旧格式事件（没有baseDifficulty字段）
            if (event.baseDifficulty !== undefined) {
                checkValue = this.calculateGraduateEventDifficulty(event);
            } else {
                // 旧格式：根据学术能力调整难度
                if (this.player.graduate) {
                    const ability = this.player.graduate.academicAbility.overall;
                    const baseDifficulty = 80 - Math.floor(ability / 2);
                    const minDifficulty = 30;
                    const maxDifficulty = 80;
                    checkValue = this.randomInt(
                        Math.max(minDifficulty, baseDifficulty - 10),
                        Math.min(maxDifficulty, baseDifficulty + 10)
                    );
                } else {
                    checkValue = this.randomInt(40, 80);
                }
            }
        } else if (type === 'startup') {
            // 创业事件：较高难度，范围50-90
            checkValue = this.randomInt(50, 90);
        } else {
            // 默认难度
            checkValue = this.randomInt(50, 100);
        }
        
        // 获取检定属性（支持新格式的checkAttribute或旧格式的type）
        const checkAttribute = event.checkAttribute || event.type;
        const playerAttr = this.player.attributes[checkAttribute];
        const passed = playerAttr >= checkValue;
        
        // 显示事件弹窗
        document.getElementById('event-title').textContent = '突发事件';
        document.getElementById('event-description').textContent = event.description;
        const attributeName = this.getAttributeName(checkAttribute);
        document.getElementById('check-attribute').textContent = attributeName;
        document.getElementById('check-value').textContent = checkValue;
        document.getElementById('player-attribute-value').textContent = attributeName;
        document.getElementById('player-attribute').textContent = playerAttr;
        
        let resultText = '';
        if (passed) {
            // 对于工作事件，检定通过：70%概率增加属性，20%概率加薪，10%概率升职
            let actualReward = event.passReward || '';
            if (type === 'work' && event.passReward && event.passReward.includes('|')) {
                const options = event.passReward.split('|');
                const random = Math.random();
                if (random < 0.7) {
                    actualReward = options[1]; // 70%概率：属性提升
                } else if (random < 0.9) {
                    actualReward = options[0]; // 20%概率：加薪
                } else {
                    actualReward = options[2]; // 10%概率：升职
                }
            }
            resultText = `✓ 检定通过！${actualReward}`;
            if (actualReward) {
                this.applyEventReward(actualReward, type);
            }
        } else {
            // 对于工作事件，失败时可能被开除或降低属性（50%概率被开除，50%概率降低属性）
            let actualPenalty = event.failPenalty || '';
            if (type === 'work' && event.failPenalty && event.failPenalty.includes('|')) {
                const options = event.failPenalty.split('|');
                if (Math.random() < 0.5) {
                    actualPenalty = options[0]; // 被开除
                } else {
                    actualPenalty = options[1]; // 降低属性
                }
            }
            resultText = `✗ 检定失败！${actualPenalty}`;
            if (actualPenalty) {
                this.applyEventPenalty(actualPenalty, type);
            }
        }
        
        document.getElementById('check-result').textContent = resultText;
        document.getElementById('event-check').classList.remove('hidden');
        document.getElementById('event-modal').classList.remove('hidden');
        
        this.gameState = 'event';
    },
    
    /**
     * 应用事件奖励（可能包含多个效果，用逗号分隔）
     */
    applyEventReward(reward, type) {
        // 分割多个奖励效果（支持逗号和竖线分隔）
        const rewards = reward.split(/[，|]/).map(r => r.trim()).filter(r => r);
        
        rewards.forEach(r => {
            if (r.includes('加薪')) {
                const match = r.match(/(\d+)元/);
                if (match) {
                    const amount = parseInt(match[1]);
                    if (this.player.currentJob) {
                        this.player.currentJob.salary += amount;
                        alert(`加薪成功！新薪资：${this.player.currentJob.salary.toLocaleString()} 元/月`);
                    }
                }
            } else if (r.includes('+')) {
                // 属性增加，格式如 "精力+5"
                const attrNames = ['精力', '智商', '沟通', '气运', '理想'];
                for (let attrName of attrNames) {
                    if (r.includes(attrName)) {
                        const match = r.match(new RegExp(attrName + '\\+(\\d+)'));
                        if (match) {
                            const attr = this.getAttributeKey(attrName);
                            const amount = parseInt(match[1]);
                            if (attr) {
                                this.player.attributes[attr] = Math.min(100, this.player.attributes[attr] + amount);
                            }
                        }
                        break;
                    }
                }
            } else if (r === '升职' || r.includes('升职')) {
                // 升职：提升职级，最高4级
                if (this.player.currentJob && this.player.jobLevel < 4) {
                    this.player.jobLevel++;
                    const levelNames = ['初级', '中级', '高级', '资深'];
                    const levelName = levelNames[this.player.jobLevel - 1] || '初级';
                    // 升职时加薪30%
                    const raise = Math.floor(this.player.currentJob.salary * 0.3);
                    this.player.currentJob.salary += raise;
                    alert(`恭喜升职！职级提升至${levelName}，加薪${raise.toLocaleString()}元`);
                }
            } else if (r.includes('公司余额')) {
                const match = r.match(/公司余额\+?(\d+)/);
                if (match) {
                    const amount = parseInt(match[1]);
                    if (this.player.startup) {
                        this.player.startup.balance += amount;
                    }
                }
            } else if (r.includes('获得强力员工')) {
                if (this.player.startup) {
                    const positions = ['产品', '研发', '销售'];
                    const position = positions[this.randomInt(0, positions.length - 1)];
                    this.player.startup.employees.push({
                        name: '强力员工',
                        position: position,
                        ability: 150,
                        salary: 50000
                    });
                    alert('获得强力员工！');
                }
            } else if (r.includes('公司估值提升')) {
                if (this.player.startup) {
                    this.player.startup.valuation += 100;
                    alert('公司估值提升！');
                }
            } else if (r.includes('员工士气提升')) {
                // 员工士气提升可以增加所有员工的能力
                if (this.player.startup) {
                    this.player.startup.employees.forEach(emp => {
                        emp.ability = Math.min(200, emp.ability + 10);
                    });
                    alert('员工士气提升！所有员工能力+10');
                }
            }
            
            // 研究生事件特殊奖励处理
            if (type === 'graduate' && this.player.graduate) {
                this.applyGraduateEventReward(r);
            }
        });
        
        // 更新面板
        this.updatePlayerPanel();
        if (this.player.currentJob) {
            this.updateWorkPanel();
        }
        if (this.player.startup) {
            this.updateStartupPanel();
        }
        if (this.player.graduate) {
            this.updateGraduatePanel();
        }
    },
    
    /**
     * 处理研究生事件特殊奖励
     */
    applyGraduateEventReward(reward) {
        if (!this.player.graduate) return;
        
        const graduate = this.player.graduate;
        const ability = graduate.academicAbility;
        
        // 学术积分
        if (reward.includes('学术积分')) {
            const match = reward.match(/学术积分[+-](\d+)/);
            if (match) {
                const amount = reward.includes('+') ? parseInt(match[1]) : -parseInt(match[1]);
                graduate.academicPoints = Math.max(0, graduate.academicPoints + amount);
            }
        }
        
        // 研究能力
        if (reward.includes('研究能力')) {
            const match = reward.match(/研究能力[+-](\d+)/);
            if (match) {
                const amount = reward.includes('+') ? parseInt(match[1]) : -parseInt(match[1]);
                ability.research = Math.max(0, Math.min(100, ability.research + amount));
                this.updateAcademicAbilityOverall();
            }
        }
        
        // 写作能力
        if (reward.includes('写作能力')) {
            const match = reward.match(/写作能力[+-](\d+)/);
            if (match) {
                const amount = reward.includes('+') ? parseInt(match[1]) : -parseInt(match[1]);
                ability.writing = Math.max(0, Math.min(100, ability.writing + amount));
                this.updateAcademicAbilityOverall();
            }
        }
        
        // 实验能力
        if (reward.includes('实验能力')) {
            const match = reward.match(/实验能力[+-](\d+)/);
            if (match) {
                const amount = reward.includes('+') ? parseInt(match[1]) : -parseInt(match[1]);
                ability.experiment = Math.max(0, Math.min(100, ability.experiment + amount));
                this.updateAcademicAbilityOverall();
            }
        }
        
        // 导师关系
        if (reward.includes('导师关系')) {
            const match = reward.match(/导师关系[+-](\d+)/);
            if (match) {
                const amount = reward.includes('+') ? parseInt(match[1]) : -parseInt(match[1]);
                graduate.mentorRelationship = Math.max(0, Math.min(100, graduate.mentorRelationship + amount));
            }
        }
        
        // 人脉值
        if (reward.includes('人脉值')) {
            const match = reward.match(/人脉值[+-](\d+)/);
            if (match) {
                const amount = reward.includes('+') ? parseInt(match[1]) : -parseInt(match[1]);
                this.player.networkValue = Math.max(0, this.player.networkValue + amount);
            }
        }
        
        // 获得工作机会
        if (reward.includes('获得工作机会')) {
            // 可以选择接受工作机会（这里只是标记，实际需要玩家选择）
            alert('你获得了工作机会！可以在毕业后选择接受');
        }
        
        // 金钱奖励（通用处理，但需要确保在研究生状态下也能生效）
        if (reward.includes('金钱')) {
            const match = reward.match(/金钱[+-](\d+)/);
            if (match) {
                const amount = reward.includes('+') ? parseInt(match[1]) : -parseInt(match[1]);
                this.player.money += amount;
            }
        } else if (reward.includes('元') && !reward.includes('加薪')) {
            // 处理"金钱+5000"这种格式，但排除"加薪XXX元"
            const match = reward.match(/(\d+)元/);
            if (match) {
                const amount = parseInt(match[1]);
                this.player.money += amount;
            }
        }
        
        // 根据学术能力给予额外奖励
        const overallAbility = ability.overall;
        if (overallAbility >= 80) {
            // 高能力：额外学术积分和学术能力提升
            graduate.academicPoints += this.randomInt(2, 5);
            const abilityType = ['research', 'writing', 'experiment'][this.randomInt(0, 2)];
            ability[abilityType] += this.randomInt(1, 2);
            this.updateAcademicAbilityOverall();
        } else if (overallAbility >= 60) {
            // 中等能力：少量额外奖励
            graduate.academicPoints += this.randomInt(1, 2);
        }
    },
    
    /**
     * 应用事件惩罚（可能包含多个效果，用逗号或竖线分隔）
     */
    applyEventPenalty(penalty, type) {
        // 分割多个惩罚效果（支持逗号和竖线分隔）
        const penalties = penalty.split(/[，|]/).map(p => p.trim()).filter(p => p);
        
        penalties.forEach(p => {
            if (p === '被开除') {
                this.player.career = '待业';
                this.player.currentJob = null;
                this.updatePlayerPanel();
                alert('你被开除了！');
            } else if (p.includes('-')) {
                // 属性降低，格式如 "精力-3"
                const attrNames = ['精力', '智商', '沟通', '气运', '理想'];
                for (let attrName of attrNames) {
                    if (p.includes(attrName)) {
                        const match = p.match(new RegExp(attrName + '-(\\d+)'));
                        if (match) {
                            const attr = this.getAttributeKey(attrName);
                            const amount = parseInt(match[1]);
                            if (attr) {
                                this.player.attributes[attr] = Math.max(0, this.player.attributes[attr] - amount);
                            }
                        }
                        break;
                    }
                }
            } else if (p.includes('公司余额')) {
                const match = p.match(/公司余额-?(\d+)/);
                if (match) {
                    const amount = parseInt(match[1]);
                    if (this.player.startup) {
                        this.player.startup.balance = Math.max(0, this.player.startup.balance - amount);
                    }
                }
            } else if (p === '员工离职') {
                if (this.player.startup && this.player.startup.employees.length > 0) {
                    const index = this.randomInt(0, this.player.startup.employees.length - 1);
                    const employee = this.player.startup.employees.splice(index, 1)[0];
                    alert(`${employee.name} 离职了！`);
                }
            }
            
            // 研究生事件特殊惩罚处理
            if (type === 'graduate' && this.player.graduate) {
                this.applyGraduateEventPenalty(p);
            }
        });
        
        // 更新面板
        this.updatePlayerPanel();
        if (this.player.currentJob) {
            this.updateWorkPanel();
        }
        if (this.player.startup) {
            this.updateStartupPanel();
        }
        if (this.player.graduate) {
            this.updateGraduatePanel();
        }
    },
    
    /**
     * 处理研究生事件特殊惩罚
     */
    applyGraduateEventPenalty(penalty) {
        if (!this.player.graduate) return;
        
        const graduate = this.player.graduate;
        const ability = graduate.academicAbility;
        
        // 学术积分
        if (penalty.includes('学术积分')) {
            const match = penalty.match(/学术积分[+-](\d+)/);
            if (match) {
                const amount = penalty.includes('+') ? parseInt(match[1]) : -parseInt(match[1]);
                graduate.academicPoints = Math.max(0, graduate.academicPoints + amount);
            }
        }
        
        // 研究能力
        if (penalty.includes('研究能力')) {
            const match = penalty.match(/研究能力[+-](\d+)/);
            if (match) {
                const amount = penalty.includes('+') ? parseInt(match[1]) : -parseInt(match[1]);
                ability.research = Math.max(0, Math.min(100, ability.research + amount));
                this.updateAcademicAbilityOverall();
            }
        }
        
        // 写作能力
        if (penalty.includes('写作能力')) {
            const match = penalty.match(/写作能力[+-](\d+)/);
            if (match) {
                const amount = penalty.includes('+') ? parseInt(match[1]) : -parseInt(match[1]);
                ability.writing = Math.max(0, Math.min(100, ability.writing + amount));
                this.updateAcademicAbilityOverall();
            }
        }
        
        // 实验能力
        if (penalty.includes('实验能力')) {
            const match = penalty.match(/实验能力[+-](\d+)/);
            if (match) {
                const amount = penalty.includes('+') ? parseInt(match[1]) : -parseInt(match[1]);
                ability.experiment = Math.max(0, Math.min(100, ability.experiment + amount));
                this.updateAcademicAbilityOverall();
            }
        }
        
        // 导师关系
        if (penalty.includes('导师关系')) {
            const match = penalty.match(/导师关系[+-](\d+)/);
            if (match) {
                const amount = penalty.includes('+') ? parseInt(match[1]) : -parseInt(match[1]);
                graduate.mentorRelationship = Math.max(0, Math.min(100, graduate.mentorRelationship + amount));
            }
        }
        
        // 人脉值
        if (penalty.includes('人脉值')) {
            const match = penalty.match(/人脉值[+-](\d+)/);
            if (match) {
                const amount = penalty.includes('+') ? parseInt(match[1]) : -parseInt(match[1]);
                this.player.networkValue = Math.max(0, this.player.networkValue + amount);
            }
        }
        
        // 失去实习
        if (penalty.includes('失去实习')) {
            if (graduate.internship) {
                graduate.internship = null;
                alert('你失去了实习机会');
            }
        }
        
        // 研究进度延迟
        if (penalty.includes('研究进度延迟')) {
            // 延迟可以通过增加学习月数来模拟，或者标记一个延迟状态
            // 这里我们简单处理，不实际延迟，只是提示
            alert('研究进度受到影响');
        }
    },
    
    /**
     * 获取属性键名
     */
    getAttributeKey(name) {
        const keys = {
            '精力': 'energy',
            '智商': 'intelligence',
            '沟通': 'communication',
            '气运': 'luck',
            '理想': 'ideal'
        };
        return keys[name] || null;
    },
    
    /**
     * 关闭事件弹窗
     */
    closeEventModal() {
        document.getElementById('event-modal').classList.add('hidden');
        document.getElementById('event-check').classList.add('hidden');
        this.gameState = 'playing';
        
        // 检查是否需要显示选择面板
        // 兼容旧数据：如果只有currentMajor而没有graduate，需要初始化
        if (this.player.currentMajor && !this.player.graduate) {
            const major = this.player.currentMajor;
            const degreeType = major.degreeType || '硕士';
            const minMonths = major.minMonths || (degreeType === '博士' ? 36 : 24);
            const minAcademicPoints = major.minAcademicPoints || (degreeType === '博士' ? 200 : 100);
            const minOverallAbility = degreeType === '博士' ? 75 : 60;
            
            this.player.graduate = {
                major: major,
                startTurn: this.player.graduateStartTurn || this.currentTurn,
                studyMonths: this.currentTurn - (this.player.graduateStartTurn || this.currentTurn),
                academicAbility: {
                    research: 50,
                    writing: 50,
                    experiment: 50,
                    overall: 50
                },
                academicPoints: 0,
                achievements: [],
                scholarship: null,
                internship: null,
                mentorRelationship: 50,
                graduationRequirement: {
                    minMonths: minMonths,
                    minAcademicPoints: minAcademicPoints,
                    minOverallAbility: minOverallAbility
                }
            };
        }
        
        if (this.player.career === '待业' && !this.player.startup && !this.player.currentJob && !this.player.currentMajor && !this.player.graduate) {
            this.showChoicePanel(['work', 'graduate', 'startup']);
        } else if (this.player.startup) {
            this.showPanel('startup-management');
        } else if (this.player.currentJob) {
            this.showPanel('work-management');
        }
    },
    
    /**
     * 隐藏所有面板，只保留game-header可见
     */
    hideAllPanels() {
        const mainGame = document.getElementById('main-game');
        if (mainGame) {
            // 隐藏main-game内的所有面板和choice-panel
            mainGame.querySelectorAll('.panel, .choice-panel').forEach(panel => {
                panel.classList.add('hidden');
            });
            // 明确隐藏选择面板
            const choicePanel = document.getElementById('choice-panel');
            if (choicePanel) {
                choicePanel.classList.add('hidden');
            }
            // 确保game-header可见
            const gameHeader = mainGame.querySelector('.game-header');
            if (gameHeader) {
                gameHeader.classList.remove('hidden');
            }
        }
    },
    
    /**
     * 隐藏选择面板
     */
    hideChoicePanel() {
        const choicePanel = document.getElementById('choice-panel');
        if (choicePanel) {
            choicePanel.classList.add('hidden');
        }
    },
    
    /**
     * 显示指定面板
     */
    showPanel(panelId) {
        // 只隐藏main-game内的面板，不包括main-game本身、character-creation和game-header
        const mainGame = document.getElementById('main-game');
        if (mainGame) {
            // 隐藏main-game内的所有面板和choice-panel，但保留game-header可见
            mainGame.querySelectorAll('.panel, .choice-panel').forEach(panel => {
                // 跳过game-header，它应该始终可见
                if (!panel.classList.contains('game-header') && panel.id !== 'game-header') {
                    panel.classList.add('hidden');
                }
            });
            // 明确隐藏选择面板（除非要显示的就是它）
            if (panelId !== 'choice-panel') {
                const choicePanel = document.getElementById('choice-panel');
                if (choicePanel) {
                    choicePanel.classList.add('hidden');
                }
            }
        }
        
        // 显示指定面板
        const panel = document.getElementById(panelId);
        if (panel) {
            panel.classList.remove('hidden');
        }
    },
    
    /**
     * 获取项目的销售员工数量
     * @param {number} projectIndex - 项目索引
     * @returns {number} 销售员工数量
     */
    getSalesEmployeeCount(projectIndex) {
        const project = this.player.startup.projects[projectIndex];
        if (!project || !project.assignedEmployees) return 0;
        
        let count = 0;
        project.assignedEmployees.forEach(empId => {
            if (empId === 'player') {
                // 玩家
                if (this.player.startup.playerEmployee && 
                    this.player.startup.playerEmployee.position === '销售') {
                    count++;
                }
            } else {
                // 普通员工
                const emp = this.player.startup.employees[empId];
                if (emp && emp.position === '销售') {
                    count++;
                }
            }
        });
        return count;
    },
    
    /**
     * 计算销售团队效率系数
     * 考虑：小团队有协同效应，大团队效率递减
     * @param {number} salesCount - 销售员工数量
     * @returns {number} 效率系数
     */
    calculateEfficiencyFactor(salesCount) {
        if (salesCount === 0) return 0;
        if (salesCount === 1) return 1.0;      // 1人：100%效率
        if (salesCount === 2) return 1.8;       // 2人：180%（协同效应）
        if (salesCount === 3) return 2.4;       // 3人：240%
        if (salesCount === 4) return 2.8;       // 4人：280%
        if (salesCount === 5) return 3.0;       // 5人：300%（最优规模）
        
        // 5-10人：每增加1人，效率+15%
        if (salesCount <= 10) {
            return 3.0 + (salesCount - 5) * 0.15;
        }
        
        // 10人以上：每增加1人，效率+5%（边际递减）
        return 3.75 + (salesCount - 10) * 0.05;
    },
    
    /**
     * 计算项目生命周期系数
     * 模拟：增长期 → 稳定期 → 成熟期 → 衰退期
     * @param {number} salesMonths - 项目销售月数
     * @returns {number} 生命周期系数
     */
    calculateLifecycleFactor(salesMonths) {
        if (salesMonths <= 3) {
            // 前3个月：增长期（0.8 → 1.2）
            return 0.8 + (salesMonths / 3) * 0.4;
        } else if (salesMonths <= 12) {
            // 3-12个月：稳定期（1.2 → 0.9）
            return 1.2 - ((salesMonths - 3) / 9) * 0.3;
        } else if (salesMonths <= 24) {
            // 12-24个月：成熟期（0.9 → 0.5）
            return 0.9 - ((salesMonths - 12) / 12) * 0.4;
        } else {
            // 24个月以上：衰退期（最低20%）
            return Math.max(0.2, 0.5 - ((salesMonths - 24) / 12) * 0.3);
        }
    },
    
    /**
     * 动态计算项目月收入
     * 每回合调用，根据当前销售团队重新计算
     * @param {Object} project - 项目对象
     * @returns {number} 月收入
     */
    calculateProjectRevenue(project) {
        if (project.status !== 'selling') return 0;
        
        const projectIndex = this.player.startup.projects.indexOf(project);
        
        // 1. 获取当前销售能力总和（动态）
        const salesAbility = this.getTotalAbilityByPosition('销售', projectIndex);
        if (salesAbility === 0) return 0;
        
        // 2. 项目级别倍数
        const revenueMultiplierByGrade = {
            'C': 50,   // C级项目：基础倍数50
            'B': 150,   // B级项目：基础倍数75
            'A': 500,  // A级项目：基础倍数100
            'S': 3000,  // S级项目：基础倍数150
            'SS': 30000  // SS级项目：基础倍数200
        };
        const baseMultiplier = revenueMultiplierByGrade[project.grade] || 100;
        
        // 3. 计算基础收入
        const baseRevenue = salesAbility * baseMultiplier * 2;
        
        // 4. 获取销售员工数量（用于效率曲线）
        const salesCount = this.getSalesEmployeeCount(projectIndex);
        
        // 5. 应用效率曲线
        const efficiencyFactor = this.calculateEfficiencyFactor(salesCount);
        
        // 6. 计算项目销售月数
        if (!project.salesStartMonth) {
            project.salesStartMonth = this.currentTurn;
        }
        const salesMonths = this.currentTurn - project.salesStartMonth + 1;
        
        // 7. 应用生命周期衰减
        const lifecycleFactor = this.calculateLifecycleFactor(salesMonths);
        
        // 8. 新增：行业收益影响
        let industryMultiplier = 1.0;
        if (this.player.startup && this.player.startup.industry) {
            const industry = this.player.startup.industry;
            
            // 行业收益倍数
            const industryRevenueMultiplier = industry.revenueMultiplier || 1.0;
            
            // 竞争度影响：高竞争度降低收益（最高-30%）
            const competition = industry.competition || 50;
            const competitionImpact = 1.0 - (competition / 100) * 0.3;
            
            // 成长潜力影响：高成长潜力增加收益（最高+30%）
            const growthPotential = industry.growthPotential || 50;
            const growthImpact = 1.0 + (growthPotential / 100) * 0.3;
            
            // 应用行业影响
            industryMultiplier = industryRevenueMultiplier * competitionImpact * growthImpact;
        }
        
        // 9. 计算最终收入
        const finalRevenue = baseRevenue * efficiencyFactor * lifecycleFactor * industryMultiplier;
        
        return Math.max(0, Math.floor(finalRevenue));
    },
    
    /**
     * 生成随机整数（包含min和max）
     */
    randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
};

// 将startSales暴露到全局，供HTML中的onclick调用
window.Game = Game;

// 页面加载完成后初始化游戏
window.addEventListener('DOMContentLoaded', () => {
    Game.init();
});
