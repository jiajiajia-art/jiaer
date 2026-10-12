async function 结算(NPC, 友好度变化, 倾慕度变化, 触发怀孕) {
  //为了防止玩家利用卡屏回退反复刷友好度/倾慕度，等到结束触摸，再统一更新数据
  await 提升NPC属性('友好度', 友好度变化)
  await 提升NPC属性('倾慕度', 倾慕度变化)
  await 计算NPC关系()
  await 时间更新()  
  if (触发怀孕 == 1) {
    if (ac.var.性别+'怀孕' == ac.var.孕性 && ac.var.优先 != '对方怀孕') {
      //如果主控符合孕性，则检查主控是否已怀孕
      let 主控怀孕情况 = await 获取NPC属性('怀孕月数', ac.var.主控指针)
      if (主控怀孕情况 > 0) {
        await 设定NPC属性('怀孕月数', 0, ac.var.主控指针)
        await 添加NPC纪事(`【流产】${ac.var.姓名}流产了……`, ac.var.主控指针, '公共纪事')
        await ac.sysDialogOn({
          roleName: `角色名`,
          content: `你因为瑟瑟而流产了……`,
          id: 8406203,
          hasRoleName: false,
          hasBg: true,
          hasRoleAvatar: false,
          roleAvatarResId: '$1528927',
        });
      } else {
        await 设定NPC属性('怀孕月数', 1, ac.var.主控指针)
        ac.var.主控的孩子是谁的 = NPC.姓名
        await 添加NPC纪事(`【怀孕】${ac.var.姓名}怀了${NPC.姓名}的孩子！`, ac.var.主控指针, '公共纪事')
        //如果暂时不让玩家得知，就注释掉对话
        await ac.sysDialogOn({
          roleName: `角色名`,
          content: `你怀了${NPC.姓名}的孩子！`,
          id: 8406203,
          hasRoleName: false,
          hasBg: true,
          hasRoleAvatar: false,
          roleAvatarResId: '$1528927',
        });
      }
    } else if ( (NPC.性别+'怀孕' == ac.var.孕性 || ac.var.优先 == '对方怀孕') && ac.var.优先 != '都不怀孕') {
      //检查NPC是否已怀孕
      let NPC怀孕情况 = NPC.怀孕月数
      if (NPC怀孕情况 > 0) {
        await 设定NPC属性('怀孕月数', 0)
        await 添加NPC纪事(`【流产】${NPC.姓名}流产了……`, ac.var.NPC指针, '公共纪事')
        await ac.sysDialogOn({
          roleName: `角色名`,
          content: `${NPC.姓名}因为瑟瑟而流产了……`,
          id: 8406203,
          hasRoleName: false,
          hasBg: true,
          hasRoleAvatar: false,
          roleAvatarResId: '$1528927',
        });
      } else {
        await 设定NPC属性('怀孕月数', 1)
        await 添加NPC纪事(`【怀孕】${NPC.姓名}怀了${ac.var.姓名}的孩子！`, ac.var.NPC指针, '公共纪事')
        //如果暂时不让玩家得知，就注释掉对话
        await ac.sysDialogOn({
          roleName: `角色名`,
          content: `${NPC.姓名}怀了你的孩子！`,
          id: 8406203,
          hasRoleName: false,
          hasBg: true,
          hasRoleAvatar: false,
          roleAvatarResId: '$1528927',
        });
      }
    }
  }  
  await ac.jump({
    plotID: ac.var.返回剧情标记,
    transition: ac.SCENE_TRANSITION_TYPES.fade,
    duration: 1000,
  });
}

async function 检查NPC婚恋关系(所有NPC) {
  let 主控配偶 = 所有NPC[ac.var.主控指针].配偶

  // 筛选出有钟情对象的NPC
  let 有钟情的NPC = 所有NPC.filter(obj => {
    return obj.钟情 != '暂无' && obj.倾慕排行 != undefined;
  });

  for (let i = 0; i < 有钟情的NPC.length; i++) {
    const NPC = 有钟情的NPC[i];
    const NPC指针 = await 查询NPC指针(NPC.姓名);

    // 判断是否对主控求婚
    if (NPC.倾慕排行[0].值 >= 80 && 
        NPC.钟情 == ac.var.姓名 && 
        NPC.配偶 == "暂无" && 
        NPC.年龄 >= 16) {

      // 先保存NPC数据
      ac.var.NPC数据 = JSON.stringify(所有NPC);

      // 设置NPC指针，触发求婚剧情
      ac.var.NPC指针 = NPC指针;
      await ac.display({
        plotID: 9242776,
        transition: ac.SCENE_TRANSITION_TYPES.fade,
        duration: 1000,
      });
      所有NPC = JSON.parse(ac.var.NPC数据);
    } 
    // NPC对其他NPC求婚
    else if (NPC.倾慕排行[0].值 >= 80 && 
             NPC.配偶 == "暂无" && 
             NPC.年龄 >= 16) {
      所有NPC = await 处理NPC互相求婚(NPC, 所有NPC);
    }   
  }

  return 所有NPC;
}

async function 处理NPC互相求婚(求婚者, 所有NPC) {
  if (ac.var.调控模式) { 弹出提示(`${求婚者.姓名}开始求婚`,'不消失') }
  const 此人id = await 查询NPC指针(求婚者.姓名);
  const 对方id = await 查询NPC指针(求婚者.倾慕排行[0].名);

  // 如果找不到对方或者对方已有配偶，直接返回
  if (对方id < 0 || 所有NPC[对方id].配偶 != '暂无') return 所有NPC;

  const 求婚成功的概率 = 80;
  const r = await ac.random({ min: 0, max: 100 });

  // 如果涉及子嗣，需要征求玩家意见
  if (所有NPC[对方id].NPC分类 == '子嗣' || 所有NPC[此人id].NPC分类 == '子嗣') {
    await ac.sysDialogOn({
      roleName: `角色名`,
      content: `${所有NPC[对方id].姓名}希望与${所有NPC[此人id].姓名}成婚，${ac.var.姓名}作为长辈，是否同意？`,
      id: 8406203,
      hasRoleName: false,
      hasBg: true,
      hasRoleAvatar: false,
      roleAvatarResId: '$1528927',
    });

    // 创建选项按钮
    await ac.createOptionGroup({
      name: 'textOptionGroup6',
      defaultComposition: true,
      index: 0,
      inlayer: 'window',
      spacing: 20,
      optionGroup: [{
        textContent: `同意`,
        clickFunc: async function() {
          // 直接执行婚配逻辑
          所有NPC[此人id].配偶 = 所有NPC[对方id].姓名;
          所有NPC[对方id].配偶 = 所有NPC[此人id].姓名;

          // 添加纪事
          const 纪事内容 = `【婚恋】${所有NPC[此人id].姓名}与${所有NPC[对方id].姓名}成婚，喜结良缘！`;
          所有NPC[此人id].纪事 = 纪事内容 + "\n" + 所有NPC[此人id].纪事;
          所有NPC[对方id].纪事 = 纪事内容 + "\n" + 所有NPC[对方id].纪事;

          // 更新公共纪事
          ac.var.公共纪事 = 纪事内容 + '\n' + ac.var.公共纪事;

          // 保存NPC数据
          ac.var.NPC数据 = JSON.stringify(所有NPC);

          await ac.sysDialogOn({
            roleName: `角色名`,
            content: 纪事内容,
            id: 8406203,
            hasRoleName: false,
            hasBg: true,
            hasRoleAvatar: false,
            roleAvatarResId: '$1528927',
          });
        },
      }, {
        textContent: `不同意`,
        clickFunc: async function() {
          await ac.sysDialogOn({
            roleName: `角色名`,
            content: `${ac.var.姓名}没有同意。`,
            id: 8406203,
            hasRoleName: false,
            hasBg: true,
            hasRoleAvatar: false,
            roleAvatarResId: '$1528927',
          });
        },
      }],
    });
  } else {
    // 普通NPC之间的求婚
    if (r <= 求婚成功的概率) {
      // 求婚成功 - 直接内联完成婚配逻辑
      所有NPC[此人id].配偶 = 所有NPC[对方id].姓名;
      所有NPC[对方id].配偶 = 所有NPC[此人id].姓名;

      // 添加纪事
      const 纪事内容 = `【婚恋】${所有NPC[此人id].姓名}向${所有NPC[对方id].姓名}求婚，喜结良缘！`;
      所有NPC[此人id].纪事 = 纪事内容 + "\n" + 所有NPC[此人id].纪事;
      所有NPC[对方id].纪事 = `【婚恋】${所有NPC[对方id].姓名}答应了${所有NPC[此人id].姓名}的求婚，喜结良缘！\n` + 所有NPC[对方id].纪事;

      // 更新公共纪事
      ac.var.公共纪事 = 纪事内容 + '\n' + ac.var.公共纪事;
    } else {
      // 求婚失败，添加纪事
      const 失败纪事 = `【婚恋】${所有NPC[此人id].姓名}向${所有NPC[对方id].姓名}求婚，可惜没得到应允。`;
      所有NPC[此人id].纪事 = 失败纪事 + "\n" + 所有NPC[此人id].纪事;
      所有NPC[对方id].纪事 = `【婚恋】${所有NPC[对方id].姓名}拒绝了${所有NPC[此人id].姓名}的求婚，感觉还没准备好。\n` + 所有NPC[对方id].纪事;

      // 更新公共纪事
      ac.var.公共纪事 = 失败纪事 + '\n' + ac.var.公共纪事;
    }
  }
  if (ac.var.调控模式) { 弹出提示(`${求婚者.姓名}求婚结束`,'不消失')}
  return 所有NPC;
}

async function 检查生育情况(所有NPC) {
  // 处理已经怀孕的角色（包括主控和NPC）
  所有NPC = await 处理已怀孕角色(所有NPC);

  // 处理新的怀孕情况
  所有NPC = await 处理新怀孕情况(所有NPC);

  return 所有NPC;
}

async function 处理已怀孕角色(所有NPC) {
  // 遍历所有NPC，检查怀孕状态
  for (let i = 0; i < 所有NPC.length; i++) {
    const 角色 = 所有NPC[i];
    const 是主控 = 角色.姓名 === ac.var.姓名;

    // 检查是否已怀孕
    if (角色.怀孕月数 !== undefined && 角色.怀孕月数 > 0) {
      // 增加怀孕月数
      所有NPC[i].怀孕月数 += 1;
      // 检查是否到达生产月份
      if (所有NPC[i].怀孕月数 > 10) {
        // 重置怀孕月数
        所有NPC[i].怀孕月数 = 0;

        // 统一处理生产
        所有NPC = await 处理生子(角色, i, 所有NPC, 是主控);
      } else if (是主控) {
        // 如果是主控角色，显示怀孕进度
        await ac.sysDialogOn({
          roleName: `角色名`,
          content: `${ac.var.姓名}怀有${ac.var.主控的孩子是谁的}的孩子，再过${11 - 角色.怀孕月数}个月生产。`,
          id: 8406203,
          hasRoleName: false,
          hasBg: true,
          hasRoleAvatar: false,
          roleAvatarResId: '$1528927',
        });
      }
    }
  }

  return 所有NPC;
}

async function 处理新怀孕情况(所有NPC) {
  // 筛选出符合条件的女性角色（已婚且在生育年龄范围内）
  let 可怀孕角色 = 所有NPC.filter(obj => {
    return obj.姓名 != ac.var.姓名 && obj.性别+'怀孕' == ac.var.孕性 &&
      obj.年龄 >= 16 && obj.年龄 <= 30 && 
      (obj.怀孕月数 == 0 || obj.怀孕月数 == undefined) && 
      ((obj.配偶 != undefined && obj.配偶 != '暂无' && obj.配偶 != ac.var.姓名) || 
       (obj.配偶 == '皇上' && obj.受宠度 >= 70));
  });

  // 处理每个符合条件的角色
  for (let i = 0; i < 可怀孕角色.length; i++) {
    const 怀孕概率 = 50; // 为方便测试调高了
    const r = await ac.random({ min: 0, max: 100 });
    const 此人id = await 查询NPC指针(可怀孕角色[i].姓名);
    const 配偶id = await 查询NPC指针(可怀孕角色[i].配偶);

    if (r <= 怀孕概率 && (配偶id >= 0 || 可怀孕角色[i].NPC分类 == "妃子")) {   
      // 设置怀孕月数
      所有NPC[此人id].怀孕月数 = 1;      

      // 添加纪事
      const 纪事内容 = `【怀孕】${可怀孕角色[i].姓名}怀了${可怀孕角色[i].配偶}的孩子！`;
      所有NPC[此人id].纪事 = 纪事内容 + "\n" + 所有NPC[此人id].纪事;

      if (配偶id >= 0) {
        所有NPC[配偶id].纪事 = `【怀孕】${可怀孕角色[i].姓名}怀了${可怀孕角色[i].配偶}的孩子！\n` + 所有NPC[配偶id].纪事;
      }

      // 非主控角色怀孕，只更新公共纪事
      ac.var.公共纪事 = 纪事内容 + '\n' + ac.var.公共纪事;
    }  
  }

  return 所有NPC;
}

async function 处理生子(母亲, 母亲id, 所有NPC, 是主控 = false) {
  if (ac.var.调控模式) { 弹出提示(`${母亲.姓名}开始生子`,'不消失')}

  // 确定非生育者ID和主控关系
  let 非生育者id = await 查询NPC指针(母亲.配偶);
  const 主控是非生育者 = !是主控 && 母亲.配偶 == ac.var.姓名;
  const 与主控有关 = 是主控 || 主控是非生育者;

  if (是主控 && ac.var.主控的孩子是谁的) {
    非生育者id = await 查询NPC指针(ac.var.主控的孩子是谁的);
    ac.var.NPC指针2 = 非生育者id
  } else {
    //如果对方是母亲，获取对方id
    ac.var.NPC指针2 = 母亲id
  }

  let 母亲友好度 = await ac.random({ min: 70, max: 100 })
  let 非生育者友好度 = await ac.random({ min: 50, max: 80 })

  // 准备NPC参数
  let NPC参数 = {}
  if (与主控有关) {
    let 性别 = await ac.random({ min: 0, max: 1 }) === 0 ? '男' : '女'
    let 主控友好度 = 0
    if (主控是非生育者) {
      主控友好度 = 非生育者友好度
    } else {
      主控友好度 = 母亲友好度
    }
    NPC参数 = {
      NPC分类: '子嗣',
      性别: 性别,
      年龄段: '婴儿',
      关系: 性别 == '男'? '儿子' : '女儿',
      友好度: 主控友好度,
      友情排行: [{名: 所有NPC[非生育者id].姓名, 值: 非生育者友好度},{名: 所有NPC[母亲id].姓名, 值: 母亲友好度}],
      年龄: 0,
      家庭编码: 母亲.家庭编码,
      住所: 母亲.住所,
      住所标识: 母亲.住所标识,
    };
  } else {
    NPC参数 = {
      NPC分类: '居民',
      性别: await ac.random({ min: 0, max: 1 }) === 0 ? '男' : '女', // 随机性别
      年龄段: '婴儿',
      年龄: 0,
      家庭编码: 母亲.家庭编码,
      友情排行: [{名: 所有NPC[非生育者id].姓名, 值: 非生育者友好度},{名: 所有NPC[母亲id].姓名, 值: 母亲友好度}],
      住所: 母亲.住所,
      住所标识: 母亲.住所标识,
    };    
  }

  // 确定非生育者对象
  let 非生育者对象;
  if (主控是非生育者) {
    非生育者对象 = 所有NPC[ac.var.主控指针];
  } else if (非生育者id >= 0) {
    非生育者对象 = 所有NPC[非生育者id];
  } else {
    非生育者对象 = { 姓名: 母亲.配偶 }; // 创建一个简单的对象
  }

  // 生成子嗣
  let 新生儿 = await 生成随机居民(NPC参数, {}, 非生育者对象, 母亲);

  await 添加指针(新生儿, 所有NPC.length)
  // 添加到NPC列表
  所有NPC.push(新生儿);

  // 添加纪事和更新父母关系
  const 纪事内容 = `【生子】${母亲.姓名}生了${母亲.配偶}的孩子！`;

  // 更新母亲的孩子列表
  if (!所有NPC[母亲id].孩子) 所有NPC[母亲id].孩子 = [];
  所有NPC[母亲id].孩子.push(新生儿.姓名);
  所有NPC[母亲id].纪事 = 纪事内容 + "\n" + 所有NPC[母亲id].纪事;

  // 更新非生育者的孩子列表
  if (非生育者id >= 0) {
    if (!所有NPC[非生育者id].孩子) 所有NPC[非生育者id].孩子 = [];
    所有NPC[非生育者id].孩子.push(新生儿.姓名);
    所有NPC[非生育者id].纪事 = 纪事内容 + "\n" + 所有NPC[非生育者id].纪事;
  }

  // 非主控相关，只更新公共纪事
  ac.var.公共纪事 = 纪事内容 + '\n' + ac.var.公共纪事;

  // 如果是与主控有关的孩子，触发生子取名剧情
  if (与主控有关) {
    // 保存NPC数据
    ac.var.NPC数据 = JSON.stringify(所有NPC);
    await ac.display({
      plotID: 9242781,
      transition: ac.SCENE_TRANSITION_TYPES.fade,
      duration: 1000,
    });
    所有NPC = JSON.parse(ac.var.NPC数据);
  }

  if (ac.var.调控模式) { 弹出提示(`${母亲.姓名}生子结束`,'不消失')}
  return 所有NPC;
}