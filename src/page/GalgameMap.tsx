import { useMemo, useRef, useLayoutEffect } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./GalgameMap.module.css";

// --- Mock Data (保持不变) ---
const sceneData =  {
    "yichuan_city": {
        "id": "yichuan_city",
        "name": "颍川城",
        "description": "位于中原名郡，士族世家聚集之地，街巷纵横，府宅林立。",
        "background": "/api/backend/saves/13c048d8d85428f7136067e08943aa23/scenes/yichuan_city_13c048d8d85428f7136067e08943aa23.png",
        "buildings": [
            {
                "id": "yichuan_scholar_house",
                "name": "荀氏府邸",
                "description": "颍川荀氏的家族宅邸，家中有藏书楼、女眷闺阁、议事厅。",
                "icon": "/api/backend/saves/13c048d8d85428f7136067e08943aa23/icons/yichuan_scholar_house_13c048d8d85428f7136067e08943aa23.png",
                "type": "guild",
                "eventId": "scholar_house_event",
                "features": [
                    "家族活动",
                    "日常修习",
                    "社交宴会",
                    "议事"
                ]
            },
            {
                "id": "yichuan_market",
                "name": "集市",
                "description": "热闹的市集，贩卖绸缎、首饰、粮食。",
                "icon": "/api/backend/saves/13c048d8d85428f7136067e08943aa23/icons/yichuan_market_13c048d8d85428f7136067e08943aa23.png",
                "type": "shop",
                "eventId": "market_event",
                "features": [
                    "购买日用品",
                    "打点关系",
                    "侍仆采买"
                ]
            },
            {
                "id": "yichuan_temple",
                "name": "城隍庙",
                "description": "供奉城隍，居民祈福与仪式活动场所。",
                "icon": "/api/backend/saves/13c048d8d85428f7136067e08943aa23/icons/yichuan_temple_13c048d8d85428f7136067e08943aa23.png",
                "type": "temple",
                "eventId": "temple_event",
                "features": [
                    "祈福祭祀",
                    "参与家族祭礼"
                ]
            }
        ],
        "npcs": [
            {
                "id": "npc_xun_father",
                "name": "荀大人",
                "age": 47,
                "gender": "男",
                "job": "族长",
                "description": "颍川荀氏族长，主家族事务，意见权威。",
                "icon": "/api/backend/saves/13c048d8d85428f7136067e08943aa23/avatars/npc_xun_father_13c048d8d85428f7136067e08943aa23.png",
                "type": "quest_giver",
                "eventId": "father_event",
                "relationships": 143,
                "memory": [
                    "建安1年3月8日 [剧情]: # 荀大人相关记忆\n\n**身份与外貌：**\n荀氏族长，须发花白，端坐议事厅主位，神色凝重\n\n**当前事件：**\n- 召集族中长辈在议事厅商议家族大事\n- 收到曹操遣人送来的联姻书信，正与荀夫人、族老荀谌等商讨是否答应\n- 召见十六岁的玩家（荀氏族中女子），让其参与家族决",
                    "建安1年3月8日 [剧情]: ## 荀大人相关记忆\n\n**身份与立场：**\n荀氏家族掌权者，负责处理家族重大决策。家族中有多名子弟在曹操幕下效力，包括荀彧、荀攸等重要谋臣。\n\n**当前事件：**\n- 收到曹操来信，提出为其次子曹彰（年方十三，生性勇武）求娶家族女子\n- 面临艰难抉择：曹操性情多疑，",
                    "建安1年3月8日 [剧情]: # 荀大人记忆节点\n\n## 当前事件：讨论曹彰婚事\n\n**荀大人的态度与行为：**\n- 听到玩家主动询问荀彧、荀攸对曹操的评价后，微微一愣，随后眼中闪过赞许之色\n- 捋须沉吟，认可玩家的主见，认为此事关乎一生，确该问清楚\n- 从袖中取出荀彧来信，展开细看并向",
                    "建安1年3月8日 [剧情]: ## 荀大人相关记忆\n\n**事件：商议曹彰婚事**\n\n玩家提出想在婚前见曹彰一面，哪怕隔帘相望。荀谌和荀夫人认为此举有违礼法，但荀大人抬手制止众人，审视玩家后表示\"你倒是个敢想敢言的。不过……也不是没有法子。\"\n\n**荀大人的解决方案：**\n- 提出利用月底颍川春",
                    "建安1年3月8日 [剧情]: # 荀大人相关记忆\n\n## 当前状态\n- 坐在议事厅主位，神色凝重\n- 面临重大决策，不敢独断，眼神询问荀夫人和阿彧的意见\n\n## 相关事件\n- 接待了袁绍使者辛评，对方从邺城赶来为袁绍三子袁尚提亲\n- 此前刚接待过曹操使者（前脚刚走）\n- 荀氏被卷入",
                    "建安1年3月8日 [剧情]: # 荀大人相关记忆\n\n## 当前处境与态度\n- 面临曹操和袁绍两大诸侯同时拉拢，处境艰难\n- 对袁绍使者辛评提出的联姻请求采取拖延策略，以女儿\"身染风寒\"为由推迟婚事商议\n- 收到袁绍亲笔信，袁绍承诺：若荀氏归附，愿举荐族中子弟入朝为官，并",
                    "建安1年3月8日 [剧情]: # 荀大人相关记忆\n\n## 当前状态\n- 面色铁青，手握曹操方面的急报信函\n- 神情严肃凝重，处于极度焦虑和压力之中\n\n## 关键事件\n- 深夜紧急召集族中长辈和玩家（荀阿彧）到议事厅商议重大变故\n- 收到许都急报，荀彧来信传达曹操的最后通牒\n\n## 重要对话\n- 告知",
                    "建安1年3月8日 [剧情]: # 荀大人相关信息记忆\n\n## 族议决策事件\n\n**场景**：荀氏族中重要会议，讨论曹操与袁绍的婚约提议\n\n**荀大人的行为表现**：\n- 会议主持者，族长身份\n- 在玩家发言时点头示意继续，表现出倾听态度\n- 听到玩家提出\"主动出击\"策略时，眼中闪过欣赏神色\n- 询问玩家具体条"
                ],
                "greetings": [
                    "老夫荀彧，颍川荀氏族长，不知阁下来此有何要事？",
                    "荀彧在此恭候多时，族中事务繁杂，还请速速道明来意。",
                    "颍川荀氏荀彧见过阁下，既入我荀府，必有要事相商吧？"
                ]
            },
            {
                "id": "npc_xun_mother",
                "name": "荀夫人",
                "age": 44,
                "gender": "女",
                "job": "主母",
                "description": "家宅女眷管理者，主德望与内务。",
                "icon": "/api/backend/saves/13c048d8d85428f7136067e08943aa23/avatars/npc_xun_mother_13c048d8d85428f7136067e08943aa23.png",
                "type": "mentor",
                "eventId": "mother_event",
                "relationships": 180,
                "memory": [
                    "建安1年3月8日 [剧情]: ## 荀夫人相关记忆\n\n**身份与地位：**\n- 荀氏家族的女性长辈，在家族会议中拥有发言权\n\n**关键言行：**\n- 对曹彰求亲一事表示：\"彰儿虽年幼，但曹氏势大。只是……\"显示出既认可曹家势力，又存在某些顾虑\n- 看了玩家一眼后欲言又止，暗示对这桩婚事有未明言的担",
                    "建安1年3月8日 [剧情]: ## 荀夫人相关信息总结\n\n**本次互动内容：**\n\n1. **对曹彰的评价**：荀夫人向玩家介绍了曹彰的基本情况——\"生得虎背熊腰，日日习武，不喜读书。性情刚烈，与其父相似。\"这是她对这门亲事中男方的描述。\n\n2. **参与家族议事**：荀夫人在场参与了关于玩家婚事的家族讨论，与",
                    "建安1年3月8日 [剧情]: ## 荀夫人相关记忆\n\n**事件：议亲风波中的态度转变**\n\n当玩家提出希望在婚前见曹彰一面时，荀夫人最初持保守态度。她手中佛珠停住，表示\"孩子，你这想法太大胆了。女儿家的名节……\"显示出对传统礼教的坚守和对玩家名节的担忧。\n\n但当荀大人提出春祭观礼的折中方案后，荀",
                    "建安1年3月8日 [剧情]: ## 荀夫人相关记忆信息\n\n**接待曹操使者王必**\n- 在正厅接待曹操派来的郎中王必，保持礼貌客气的态度\n- 王必代表曹操送来贵重礼物：西域琉璃珠、蜀锦两匹、诗书数册，名义上是为荀家千金（玩家）准备\n- 以女儿\"身体欠安\"为由委婉推辞见面安排\n\n**对曹操",
                    "建安1年3月8日 [剧情]: # 荀夫人相关记忆\n\n## 当前场景\n- 厅中只余母女二人，可以畅所欲言\n- 荀夫人坐在厅中，刚放下手中茶盏\n\n## 态度与表现\n- 对曹操的婚事安排表现出深刻洞察，认为曹操\"用兵如神，谋略深不可测\"\n- 叹气，神态复杂，显示内心矛盾\n- 看向女儿时眼神复",
                    "建安1年3月8日 [剧情]: # 荀夫人相关记忆\n\n## 关键事件\n- 与女儿商议曹彰婚事，女儿表示愿意为家族利益接受婚约\n- 对女儿的牺牲感到心疼，眼眶微红并握住女儿的手\n- 承诺即使答应婚事，若曹彰实在不堪也会想办法周旋\n- 决定传授女儿本事，帮助其准备未来生活\n\n## 重要行为\n-",
                    "建安1年3月8日 [剧情]: # 荀夫人相关记忆\n\n**当前事件：袁绍使者提亲**\n\n1. **行动表现**：荀夫人带领玩家（荀彧）快步前往议事厅处理紧急情况，展现出沉着冷静的应对能力。\n\n2. **关键判断**：荀夫人敏锐地察觉到曹操使者前脚刚走、袁绍使者后脚就到的异常情况，质疑这是有心算计还是",
                    "建安1年3月8日 [剧情]: ## 荀夫人相关记忆\n\n**背景情境：** 袁绍派遣辛评来荀府提亲，试图通过联姻拉拢荀氏。此前曹操也曾派人来过，荀氏面临两大诸侯的站队压力。\n\n**荀夫人的表现：**\n- 在辛评提亲时保持沉默，端坐不语，展现出审慎克制的态度\n- 当荀谌提到已有族人在曹营",
                    "建安1年3月8日 [剧情]: ## 荀夫人相关记忆信息\n\n**当前场景状态：**\n深夜议事厅紧急家族会议，讨论曹操逼婚与袁绍提亲的两难抉择。\n\n**荀夫人的表现：**\n- 神色惶急，内心焦虑不安\n- 见到玩家（阿彧）进入议事厅时，眼中闪过一丝安心\n- 在族中长辈激烈争论时突然出声制止：\"够",
                    "建安1年3月8日 [剧情]: ## 荀夫人相关记忆\n\n**家族会议中的关键表现：**\n- 当荀谌质疑玩家\"你一个女子，懂什么天下大势\"时，荀夫人果断呵斥\"住口！让她说完！\"，展现出对玩家的维护和支持\n\n**会议结束后的互动：**\n- 众人陆续离去后，荀夫人主动走到玩家身边\n- 轻轻握住玩家的手，表达关切"
                ],
                "greetings": [
                    "荀夫人见你气度不凡，愿与你说说持家御下的道理。",
                    "老身荀夫人管理家宅多年，见你年轻有为，不妨指点一二。",
                    "颍川荀夫人在此，年轻人若想明白内宅规矩，尽管来问。"
                ]
            }
        ],
        "events": [
            "market_event",
            "scholar_house_event",
            "temple_event"
        ],
        "exits": {
            "north": "yichuan_county",
            "south": "family_estate"
        }
    },
    "yichuan_county": {
        "id": "yichuan_county",
        "name": "颍川县",
        "description": "县治中心，官衙相连，小桥流水，民居错落。",
        "background": "/api/backend/saves/13c048d8d85428f7136067e08943aa23/scenes/yichuan_county_13c048d8d85428f7136067e08943aa23.png",
        "buildings": [
            {
                "id": "yichuan_government",
                "name": "县衙",
                "description": "地方官府，处理政务，士族世家常来拜谒。",
                "icon": "/api/backend/saves/13c048d8d85428f7136067e08943aa23/icons/yichuan_government_13c048d8d85428f7136067e08943aa23.png",
                "type": "guild",
                "eventId": "government_event",
                "features": [
                    "拜访官员",
                    "处理家族事务"
                ]
            }
        ],
        "npcs": [
            {
                "id": "npc_county_head",
                "name": "颍川令",
                "age": 52,
                "gender": "男",
                "job": "地方官",
                "description": "掌管一县政务，家族间周旋协调。",
                "icon": "/api/backend/saves/13c048d8d85428f7136067e08943aa23/avatars/npc_county_head_13c048d8d85428f7136067e08943aa23.png",
                "type": "quest_giver",
                "eventId": "county_head_event",
                "relationships": 60,
                "memory": [],
                "greetings": [
                    "本官颍川令，久闻阁下大名，今日得见，实乃幸事。",
                    "颍川县大小事务繁杂，老夫这把年纪还需在各家族间斡旋，唉，这便是颍川令的宿命啊。",
                    "来者何人？本官颍川令正为县中要事忧心，若有要事相商，且说来听听。"
                ]
            }
        ],
        "events": [
            "government_event"
        ],
        "exits": {
            "south": "yichuan_city",
            "east": "family_estate"
        }
    },
    "family_estate": {
        "id": "family_estate",
        "name": "家族庄园",
        "description": "坐落郊外，多田产与私家园林，庄重宁静。",
        "background": "/api/backend/saves/13c048d8d85428f7136067e08943aa23/scenes/family_estate_13c048d8d85428f7136067e08943aa23.png",
        "buildings": [
            {
                "id": "estate_field",
                "name": "田庄",
                "description": "家族经济命脉，种植五谷杂粮。",
                "icon": "/api/backend/saves/13c048d8d85428f7136067e08943aa23/icons/estate_field_13c048d8d85428f7136067e08943aa23.png",
                "type": "shop",
                "eventId": "estate_field_event",
                "features": [
                    "管理家业",
                    "田产经营"
                ]
            },
            {
                "id": "estate_servant_hall",
                "name": "仆役房",
                "description": "管理庄园仆役及家务。",
                "icon": "/api/backend/saves/13c048d8d85428f7136067e08943aa23/icons/estate_servant_hall_13c048d8d85428f7136067e08943aa23.png",
                "type": "guild",
                "eventId": "servant_hall_event",
                "features": [
                    "督促仆役",
                    "调度家务"
                ]
            }
        ],
        "npcs": [
            {
                "id": "npc_servant_leader",
                "name": "管事阿伯",
                "age": 59,
                "gender": "男",
                "job": "家宅管事",
                "description": "精明老成，主管田庄与仆役调度。",
                "icon": "/api/backend/saves/13c048d8d85428f7136067e08943aa23/avatars/npc_servant_leader_13c048d8d85428f7136067e08943aa23.png",
                "type": "merchant",
                "eventId": "servant_leader_event",
                "relationships": 45,
                "memory": [],
                "greetings": [
                    "管事阿伯在此，少爷/小姐今日可有什么吩咐？",
                    "老朽管事阿伯见过您，庄子里的事务都安排妥当了。",
                    "管事阿伯这厢有礼，府上大小事宜尽管吩咐便是。"
                ]
            }
        ],
        "events": [
            "estate_field_event",
            "servant_hall_event"
        ],
        "exits": {
            "west": "yichuan_city",
            "north": "yichuan_county"
        }
    },
    "langya_city": {
        "id": "langya_city",
        "name": "琅琊郡城",
        "description": "古郡名城，诸葛、王、张各大世家林立。",
        "background": "/api/backend/saves/13c048d8d85428f7136067e08943aa23/scenes/langya_city_13c048d8d85428f7136067e08943aa23.png",
        "buildings": [
            {
                "id": "langya_zhugeliang_house",
                "name": "诸葛氏宅邸",
                "description": "琅琊诸葛氏家宅，风雅鼎盛，常有宾客聚会。",
                "icon": "/api/backend/saves/13c048d8d85428f7136067e08943aa23/icons/langya_zhugeliang_house_13c048d8d85428f7136067e08943aa23.png",
                "type": "guild",
                "eventId": "zhugeliang_house_event",
                "features": [
                    "家族议事",
                    "社交宴饮"
                ]
            },
            {
                "id": "langya_academy",
                "name": "书院",
                "description": "士族子弟习学之地，讲学讲礼。",
                "icon": "/api/backend/saves/13c048d8d85428f7136067e08943aa23/icons/langya_academy_13c048d8d85428f7136067e08943aa23.png",
                "type": "guild",
                "eventId": "academy_event",
                "features": [
                    "读书习艺",
                    "辩论交流"
                ]
            }
        ],
        "npcs": [
            {
                "id": "npc_zhuge_junior",
                "name": "诸葛俊",
                "age": 35,
                "gender": "男",
                "job": "素士",
                "description": "诸葛氏子弟，文采风流，善谈辞章。",
                "icon": "/api/backend/saves/13c048d8d85428f7136067e08943aa23/avatars/npc_zhuge_junior_13c048d8d85428f7136067e08943aa23.png",
                "type": "quest_giver",
                "eventId": "zhuge_event",
                "relationships": 70,
                "memory": [],
                "greetings": [
                    "在下诸葛俊，久闻阁下英名，不知可有雅兴与我论诗赋文章？",
                    "琅琊诸葛俊见过足下，今日得遇，实乃幸事，敢问可曾读过新近流传的辞赋？",
                    "诸葛俊有礼了，这琅琊城中难得遇见知音，不知阁下对当世文坛可有高见？"
                ]
            }
        ],
        "events": [
            "zhugeliang_house_event",
            "academy_event"
        ],
        "exits": {
            "west": "langya_suburb",
            "east": "langya_county"
        }
    },
    "langya_county": {
        "id": "langya_county",
        "name": "琅琊县",
        "description": "郡下治所，河道穿城，生活气息浓厚。",
        "background": "/api/backend/saves/13c048d8d85428f7136067e08943aa23/scenes/langya_county_13c048d8d85428f7136067e08943aa23.png",
        "buildings": [],
        "npcs": [],
        "events": [],
        "exits": {
            "west": "langya_city"
        }
    },
    "langya_suburb": {
        "id": "langya_suburb",
        "name": "郊外宅园",
        "description": "琅琊士族田产所在，环绕林木与庄园。",
        "background": "/api/backend/saves/13c048d8d85428f7136067e08943aa23/scenes/langya_suburb_13c048d8d85428f7136067e08943aa23.png",
        "buildings": [
            {
                "id": "suburb_garden",
                "name": "家族花园",
                "description": "小桥流水，花木扶疏，是闺中女眷休憩处。",
                "icon": "/api/backend/saves/13c048d8d85428f7136067e08943aa23/icons/suburb_garden_13c048d8d85428f7136067e08943aa23.png",
                "type": "guild",
                "eventId": "garden_event",
                "features": [
                    "赏花散步",
                    "闺友密谈"
                ]
            }
        ],
        "npcs": [
            {
                "id": "npc_noble_lady",
                "name": "王夫人",
                "age": 38,
                "gender": "女",
                "job": "家族女眷",
                "description": "王氏家族女眷，关心闺中事务。",
                "icon": "/api/backend/saves/13c048d8d85428f7136067e08943aa23/avatars/npc_noble_lady_13c048d8d85428f7136067e08943aa23.png",
                "type": "quest_giver",
                "eventId": "noble_lady_event",
                "relationships": 65,
                "memory": [],
                "greetings": [
                    "妾身王夫人有礼了，这园中清雅，倒是难得遇见客人。",
                    "王夫人在此等候多时，不知阁下可愿听我说说府中一桩烦心事？",
                    "哎呀，稀客稀客！王夫人我正为女儿的婚事发愁，你来得正好。"
                ]
            }
        ],
        "events": [
            "garden_event"
        ],
        "exits": {
            "east": "langya_city"
        }
    },
    "hebei_city": {
        "id": "hebei_city",
        "name": "河北郡城",
        "description": "冀州重镇，甄氏、崔氏、郭氏等豪强世家林立。",
        "background": "/api/backend/saves/13c048d8d85428f7136067e08943aa23/scenes/hebei_city_13c048d8d85428f7136067e08943aa23.png",
        "buildings": [
            {
                "id": "hebei_market",
                "name": "冀州市集",
                "description": "各地商贩云集，可购买北地特产。",
                "icon": "/api/backend/saves/13c048d8d85428f7136067e08943aa23/icons/hebei_market_13c048d8d85428f7136067e08943aa23.png",
                "type": "shop",
                "eventId": "hebei_market_event",
                "features": [
                    "购物交易",
                    "获取时讯"
                ]
            },
            {
                "id": "hebei_clan_hall",
                "name": "甄氏府邸",
                "description": "河北甄氏家族本宅，聚族议事场所。",
                "icon": "/api/backend/saves/13c048d8d85428f7136067e08943aa23/icons/hebei_clan_hall_13c048d8d85428f7136067e08943aa23.png",
                "type": "guild",
                "eventId": "zhen_clan_event",
                "features": [
                    "家族聚会",
                    "婚配议事"
                ]
            }
        ],
        "npcs": [
            {
                "id": "npc_zhen_lady",
                "name": "甄女公子",
                "age": 16,
                "gender": "女",
                "job": "家族女公子",
                "description": "河北甄氏女公子，才德兼备，常与主角交往。",
                "icon": "/api/backend/saves/13c048d8d85428f7136067e08943aa23/avatars/npc_zhen_lady_13c048d8d85428f7136067e08943aa23.png",
                "type": "quest_giver",
                "eventId": "friend_event",
                "relationships": 55,
                "memory": [],
                "greetings": [
                    "甄女公子在此等候多时，不知阁下可有闲暇听我一言？",
                    "久闻阁下高义，甄女公子今日得见，实乃幸事。",
                    "公子别来无恙？甄女公子近日读得几卷好书，正想与你分享呢。"
                ]
            }
        ],
        "events": [
            "hebei_market_event",
            "zhen_clan_event"
        ],
        "exits": {
            "north": "hebei_estate"
        }
    },
    "hebei_estate": {
        "id": "hebei_estate",
        "name": "冀州家族庄园",
        "description": "甄氏家族田产所在，坊间传闻与家务杂事交融。",
        "background": "/api/backend/saves/13c048d8d85428f7136067e08943aa23/scenes/hebei_estate_13c048d8d85428f7136067e08943aa23.png",
        "buildings": [],
        "npcs": [],
        "events": [],
        "exits": {
            "south": "hebei_city"
        }
    },
    "jiangdong_city": {
        "id": "jiangdong_city",
        "name": "江东郡城",
        "description": "江东陆氏、孙氏等世家栖身，临江水，风物秀丽。",
        "background": "/api/backend/saves/13c048d8d85428f7136067e08943aa23/scenes/jiangdong_city_13c048d8d85428f7136067e08943aa23.png",
        "buildings": [
            {
                "id": "jiangdong_land_hall",
                "name": "陆氏宅邸",
                "description": "江东陆氏祖宅，风雅庄重，宾客往来频繁。",
                "icon": "/api/backend/saves/13c048d8d85428f7136067e08943aa23/icons/jiangdong_land_hall_13c048d8d85428f7136067e08943aa23.png",
                "type": "guild",
                "eventId": "land_hall_event",
                "features": [
                    "家族祭祀",
                    "宴会聚会"
                ]
            },
            {
                "id": "jiangdong_wharf",
                "name": "江码头",
                "description": "江东商贸与人员往来必经之地，水陆货运繁盛。",
                "icon": "/api/backend/saves/13c048d8d85428f7136067e08943aa23/icons/jiangdong_wharf_13c048d8d85428f7136067e08943aa23.png",
                "type": "shop",
                "eventId": "wharf_event",
                "features": [
                    "江货交易",
                    "外界信息获取"
                ]
            }
        ],
        "npcs": [
            {
                "id": "npc_land_miss",
                "name": "陆女公子",
                "age": 17,
                "gender": "女",
                "job": "家族女眷",
                "description": "陆氏女公子，善习汉乐，容仪出众。",
                "icon": "/api/backend/saves/13c048d8d85428f7136067e08943aa23/avatars/npc_land_miss_13c048d8d85428f7136067e08943aa23.png",
                "type": "friend",
                "eventId": "miss_event",
                "relationships": 53,
                "memory": [],
                "greetings": [
                    "陆女公子方才正习琴调弦，见是故人来访，甚是欢喜。",
                    "这江东郡城春景正好，陆女公子愿与你同赏庭中繁花。",
                    "陆女公子听闻你来，特命侍女备下清茶，快请入座叙话。"
                ]
            }
        ],
        "events": [
            "land_hall_event",
            "wharf_event"
        ],
        "exits": {
            "east": "jiangdong_suburb",
            "north": "family_estate"
        }
    },
    "jiangdong_suburb": {
        "id": "jiangdong_suburb",
        "name": "江东郊外田园",
        "description": "江岸田园，瓜果蔬菜，士族家产坐落其中。",
        "background": "/api/backend/saves/13c048d8d85428f7136067e08943aa23/scenes/jiangdong_suburb_13c048d8d85428f7136067e08943aa23.png",
        "buildings": [
            {
                "id": "suburb_farmland",
                "name": "农地",
                "description": "庄稼遍野，主家经营与采买之处。",
                "icon": "/api/backend/saves/13c048d8d85428f7136067e08943aa23/icons/suburb_farmland_13c048d8d85428f7136067e08943aa23.png",
                "type": "shop",
                "eventId": "farmland_event",
                "features": [
                    "田产管理",
                    "农事督导"
                ]
            }
        ],
        "npcs": [],
        "events": [
            "farmland_event"
        ],
        "exits": {
            "west": "jiangdong_city"
        }
    },
    "capital_xuchang": {
        "id": "capital_xuchang",
        "name": "许都",
        "description": "曹操迁献帝于此，成为天下权力中心，朝会不断。",
        "background": "/api/backend/saves/13c048d8d85428f7136067e08943aa23/scenes/capital_xuchang_13c048d8d85428f7136067e08943aa23.png",
        "buildings": [
            {
                "id": "imperial_palace",
                "name": "宫廷",
                "description": "帝王之地，百官朝拜，政务集结。",
                "icon": "/api/backend/saves/13c048d8d85428f7136067e08943aa23/icons/imperial_palace_13c048d8d85428f7136067e08943aa23.png",
                "type": "guild",
                "eventId": "palace_event",
                "features": [
                    "政务处理",
                    "官员晋升"
                ]
            },
            {
                "id": "noble_district",
                "name": "世家宅邸区",
                "description": "许多豪强世族聚居，往来频繁。",
                "icon": "/api/backend/saves/13c048d8d85428f7136067e08943aa23/icons/noble_district_13c048d8d85428f7136067e08943aa23.png",
                "type": "guild",
                "eventId": "noble_district_event",
                "features": [
                    "社交聚会",
                    "联姻调度"
                ]
            }
        ],
        "npcs": [
            {
                "id": "npc_imperial_officer",
                "name": "曹府官佐",
                "age": 41,
                "gender": "男",
                "job": "官员",
                "description": "曹魏核心官员，影响家族仕途。",
                "icon": "/api/backend/saves/13c048d8d85428f7136067e08943aa23/avatars/npc_imperial_officer_13c048d8d85428f7136067e08943aa23.png",
                "type": "quest_giver",
                "eventId": "imperial_officer_event",
                "relationships": 50,
                "memory": [],
                "greetings": [
                    "在下曹府官佐，奉丞相之命驻守许都，不知阁下前来所为何事？",
                    "曹府官佐见过了，如今天下纷乱，能在许都相遇也是缘分一桩。",
                    "老夫曹府官佐，在朝中为官多年，若有要事相商，但说无妨。"
                ]
            }
        ],
        "events": [
            "palace_event",
            "noble_district_event"
        ],
        "exits": {
            "west": "xuchang_market"
        }
    },
    "xuchang_market": {
        "id": "xuchang_market",
        "name": "许都市集",
        "description": "各地商贾云集，官民往来，消息广泛流通。",
        "background": "/api/backend/saves/13c048d8d85428f7136067e08943aa23/scenes/xuchang_market_13c048d8d85428f7136067e08943aa23.png",
        "buildings": [
            {
                "id": "market_food",
                "name": "乡食铺",
                "description": "贩卖各地粮食、酒菜的商铺。",
                "icon": "/api/backend/saves/13c048d8d85428f7136067e08943aa23/icons/market_food_13c048d8d85428f7136067e08943aa23.png",
                "type": "shop",
                "eventId": "food_shop_event",
                "features": [
                    "购买粮食",
                    "获取民间信息"
                ]
            }
        ],
        "npcs": [],
        "events": [
            "food_shop_event"
        ],
        "exits": {
            "east": "capital_xuchang"
        }
    }
}


type SceneNode = typeof sceneData[keyof typeof sceneData];
type SceneMap = Record<string, Partial<SceneNode>>;

const computePositions = (m: SceneMap) => {
    const ids = Object.keys(m);
    const positions: Record<string, { x: number; y: number }> = {};
    if (ids.length === 0) return { positions, width: 800, height: 800 };

    // === 核心调整：缩小距离 ===
    // 之前是 220, 现在改为 130，这样节点会非常紧凑
    const NODE_DISTANCE = 130;
    // 方向偏移量也相应减小
    const BASE_OFFSET = 180;

    const directionOffsets: Record<string, { x: number; y: number }> = {
        north: { x: 0, y: -BASE_OFFSET },
        south: { x: 0, y: BASE_OFFSET },
        east: { x: BASE_OFFSET, y: 0 },
        west: { x: -BASE_OFFSET, y: 0 },
        northeast: { x: BASE_OFFSET * 0.7, y: -BASE_OFFSET * 0.7 },
        northwest: { x: -BASE_OFFSET * 0.7, y: -BASE_OFFSET * 0.7 },
        southeast: { x: BASE_OFFSET * 0.7, y: BASE_OFFSET * 0.7 },
        southwest: { x: -BASE_OFFSET * 0.7, y: BASE_OFFSET * 0.7 },
    };

    const hasCollision = (x: number, y: number) => {
        return Object.values(positions).some(pos => {
            const dist = Math.hypot(pos.x - x, pos.y - y);
            return dist < NODE_DISTANCE;
        });
    };

    const findFree = (cx: number, cy: number) => {
        let angle = 0;
        let radius = NODE_DISTANCE;
        for (let attempts = 0; attempts < 100; attempts++) {
            const x = cx + Math.cos(angle) * radius;
            const y = cy + Math.sin(angle) * radius;
            if (!hasCollision(x, y)) return { x, y };
            angle += Math.PI / 5;
            if (angle >= Math.PI * 2) {
                angle %= (Math.PI * 2);
                radius += 40; // 半径增量也减小
            }
        }
        return { x: cx + radius, y: cy + radius };
    };

    const startId = ids[0];
    if (startId) positions[startId] = { x: 1500, y: 1500 }; // 画布中心点

    const visited = new Set<string>(startId ? [startId] : []);
    const queue = startId ? [startId] : [];

    while (queue.length) {
        const cur = queue.shift() as string;
        const curPos = positions[cur];
        const scene = m[cur];

        if (!scene || !scene.exits || !curPos) continue;

        Object.entries(scene.exits).forEach(([dir, targetId]) => {
            const tid = String(targetId);
            if (!m[tid] || visited.has(tid)) return;

            const offset = directionOffsets[dir] || { x: BASE_OFFSET, y: BASE_OFFSET };
            let tx = curPos.x + offset.x;
            let ty = curPos.y + offset.y;

            if (hasCollision(tx, ty)) {
                const free = findFree(curPos.x, curPos.y);
                tx = free.x; ty = free.y;
            }

            positions[tid] = { x: tx, y: ty };
            visited.add(tid);
            queue.push(tid);
        });
    }

    ids.forEach(id => {
        if (!positions[id]) positions[id] = findFree(1500, 1500);
    });

    const allPos = Object.values(positions);
    const minX = Math.min(...allPos.map(p => p.x));
    const maxX = Math.max(...allPos.map(p => p.x));
    const minY = Math.min(...allPos.map(p => p.y));
    const maxY = Math.max(...allPos.map(p => p.y));

    // 减小 Padding，让地图边缘更紧凑
    // 居中内容并设置最小画布尺寸
    const padding = 100;
    const minW = 700;
    const minH = 900;
    const contentW = (maxX - minX) + padding * 2;
    const contentH = (maxY - minY) + padding * 2;
    const width = Math.max(contentW, minW);
    const height = Math.max(contentH, minH);

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const offsetX = width / 2 - centerX;
    const offsetY = height / 2 - centerY;

    Object.keys(positions).forEach(id => {
        positions[id].x += offsetX;
        positions[id].y += offsetY;
    });

    return { positions, width, height };
};

const GalgameMap = () => {
    const navigate = useNavigate();
    const scrollRef = useRef<HTMLDivElement>(null);

    const mappedScenes = useMemo(() => Object.values(sceneData), []);
    const { positions, width, height } = useMemo(() => computePositions(sceneData), []);

    const worldMapBg = mappedScenes[0]?.background || "";

    useLayoutEffect(() => {
        if (!scrollRef.current) return;
        const container = scrollRef.current;
        const scrollX = Math.max(0, (width - container.clientWidth) / 2);
        const scrollY = Math.max(0, (height - container.clientHeight) / 2);
        container.scrollLeft = scrollX;
        container.scrollTop = scrollY;
    }, [width, height]);

    return (
        <div className={styles.page}>
            <div className={styles.mapContainer} 
                style={{ backgroundImage: worldMapBg ? `url(${worldMapBg})` : "none" }}
            >
                <div className={styles.mapOverlay} />
                <div className={styles.scrollArea} ref={scrollRef}>
                    <svg
                        className={styles.mapSvg}
                        width={width}
                        height={height}
                    >
                        <g>
                            {mappedScenes.map(scene =>
                                scene.exits
                                    ? Object.values(scene.exits).map((targetId, idx) => {
                                        const target = positions[String(targetId)];
                                        const self = positions[scene.id];
                                        if (!self || !target) return null;

                                        return (
                                            <line
                                                key={`${scene.id}-${targetId}-${idx}`}
                                                x1={self.x}
                                                y1={self.y}
                                                x2={target.x}
                                                y2={target.y}
                                                stroke="rgba(200, 200, 200, 0.4)" // 线条颜色淡一些
                                                strokeWidth={1.5} // 线条变细
                                                strokeDasharray="4 3" // 虚线更密
                                                strokeLinecap="round"
                                            />
                                        );
                                    })
                                    : null
                            )}
                        </g>

                        {mappedScenes.map(scene => {
                            const pos = positions[scene.id];
                            if (!pos) return null;

                            // 定义 SVG 容器大小：
                            // 虽然 CSS 里头是 60px，但这里得给足空间（100px）给 hover 放大和阴影
                            const NODE_WRAPPER_SIZE = 100;
                            const NODE_OFFSET = -NODE_WRAPPER_SIZE / 2;

                            return (
                                <g
                                    key={scene.id}
                                    className={styles.sceneNode}
                                    transform={`translate(${pos.x} ${pos.y})`}
                                    onClick={() => navigate(`/galgame/scene/${scene.id}`)}
                                >
                                    <foreignObject
                                        x={NODE_OFFSET}
                                        y={NODE_OFFSET}
                                        width={NODE_WRAPPER_SIZE}
                                        height={NODE_WRAPPER_SIZE}
                                        style={{ overflow: 'visible' }}
                                    >
                                        <div className={styles.sceneItem}>
                                            <div className={styles.sceneThumb}>
                                                {scene.background ? (
                                                    <img src={scene.background} alt={scene.name} />
                                                ) : (
                                                    <div style={{ width: '100%', height: '100%', background: '#444' }} />
                                                )}
                                            </div>
                                            <div className={styles.sceneName}>{scene.name}</div>
                                        </div>
                                    </foreignObject>
                                </g>
                            );
                        })}
                    </svg>
                </div>
            </div>
        </div>
    );
};

export default GalgameMap;