import { wallet } from "../game/wallet";
import { useEffect, useRef, useState } from "react";
import { useGame } from "../store/gameCtx";
import { Modal } from "./ui";
import { streamChat, isConfigured, type ChatMsg } from "../lib/ai";

/* 逾期违约 · 制片人上门追责
 * 通告越过截止周仍未拍完（或累计失误被撤换）时，responsible 制片人/制作人登门。
 * 玩家可与其对话周旋（接入 AI；未配置时走本地脚本），但终须赔付违约金了结——
 * 「我也可以回复他，但是我也会扣除钱。」 */
type Line = { who: "producer" | "me"; text: string };

/* 依关键词粗判玩家这句话的态度：诚恳/担责为正，顶撞/推诿为负，其余为 0。
 * 用来微调最终违约金——让「回话」这个动作真正有分量，而非纯情绪输出。 */
const CONTRITE = ["对不起", "抱歉", "我错", "是我", "我的错", "愿意", "赔偿", "负责", "改", "认", "补偿", "理解", "配合", "请您", "谅解", "下不为例"];
const DEFIANT = ["凭什么", "不赔", "不关我", "怪我", "你们", "关我", "不是我", "无所谓", "爱咋", "少来", "威胁", "找我干嘛", "不服"];
function scoreAttitude(text: string): number {
  let s = 0;
  for (const k of CONTRITE) if (text.includes(k)) s += 1;
  for (const k of DEFIANT) if (text.includes(k)) s -= 1;
  return Math.max(-2, Math.min(2, s)); // 单句最多 ±2，防止刷词
}

/* 各负责人的追责人设：语气基调（供 AI 扮演）+ 本地脚本台词（未配置 AI 时轮换） */
const PERSONA: Record<string, { tone: string; opener: (gig: string) => string; lines: string[] }> = {
  方知远: {
    tone: "老派电视剧制片，重资历与职业操守，语气沉稳、严厉、就事论事，最看不惯不守规矩的新人",
    opener: (g) => `《${g}》停机换人那天，全组两百多号人干等着。你知道一天的损失是多少吗？规矩就是规矩。`,
    lines: [
      "戏比天大，这四个字你是没学到家。合同上的违约条款，白纸黑字。",
      "我带过的新人不少，栽在态度上的，一个都没能翻身。别让自己成第一个。",
      "话我不多说。该赔的赔，往后想在这行立住，先把信誉补回来。",
    ],
  },
  许砚清: {
    tone: "文艺电影监制，清高内敛、话不多却字字见血，把作品看得比商业更重，失望时格外冷",
    opener: (g) => `《${g}》我筹备了很久。选你，是我看走了眼，还是你根本没把它当回事？`,
    lines: [
      "钱可以再筹，错过的档期和状态，补不回来。这是我最介意的。",
      "我不擅长逼人。但违约就是违约，成年人该为自己的选择买单。",
      "希望这是最后一次。有些门关上了，就不会再为你开。",
    ],
  },
  秦砚舟: {
    tone: "综艺制作人，圆滑健谈、笑里带刀，嘴上客气心里精算，最怕的是节目口碑与播出被连累",
    opener: (g) => `哎呀，《${g}》这档子事闹的——台里、赞助商都在问我怎么回事。你说，我这脸往哪儿搁？`,
    lines: [
      "咱们明白人不说暗话，节目开天窗谁都不好看。这个亏，得有人认。",
      "圈子就这么大，传起来可快了。趁没闹大，把违约的事儿麻利了结了吧。",
      "我还想着以后有的是合作机会呢——前提是，这回你得让我看到诚意。",
    ],
  },
  孟晚乔: {
    tone: "广告与品牌商务负责人，精明干练、只谈钱与品牌形象，语气冷静利落，不带私人情绪",
    opener: (g) => `《${g}》品牌方已经发函追责。违约影响的是商业信誉，这笔账，我们按合同算。`,
    lines: [
      "品牌不看理由，只看结果。档期没兑现，赔偿条款就自动生效。",
      "我的时间很贵，长话短说：违约金结清，这事到此为止。",
      "商业合作靠的是可预期。你这次失了分，往后报价我只能往下压。",
    ],
  },
  梁怀音: {
    tone: "音乐制作人，性情中人、为作品动真情，语气直接甚至带点情绪，恨铁不成钢",
    opener: (g) => `《${g}》的棚我都订好了，乐手全在等你！你倒好，人呢？你对得起这些人吗？`,
    lines: [
      "做音乐讲的是心气儿，你这一撂挑子，心气儿全散了！",
      "我可以不计较钱，可合同摆在这儿，我替你担不了这个责。",
      "赔了违约金，咱俩就两清。往后你再来找我，得先让我信你。",
    ],
  },
  林宜: {
    tone: "你的经纪人，亦师亦友，语气痛心多过责难，替你惋惜也替你收拾烂摊子",
    opener: (g) => `《${g}》违约的函我压下来了……可这回真的压不住了。你怎么就没撑住呢？`,
    lines: [
      "我不是要骂你。我是心疼你走到这一步，前面铺的路白费了。",
      "违约金公司先垫，可这笔账终究记在你头上。你得自己扛。",
      "跌倒了就爬起来。把这次了结干净，姐还站在你这边。",
    ],
  },
};

export default function BreachDialog() {
  const { game, cfg, resolveBreach } = useGame();
  const b = game?.sim.breach ?? null;

  const [lines, setLines] = useState<Line[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [attitude, setAttitude] = useState(0); // 累计态度分：诚恳为正、顶撞为负，影响最终违约金
  const bodyRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);

  const ai = !!cfg && isConfigured(cfg);
  const persona = b ? PERSONA[b.producer] : undefined;

  // 态度对最终违约金的折算：诚恳最多减 20%，顶撞最多加 20%
  const feeMul = Math.max(0.8, Math.min(1.2, 1 - attitude * 0.05));
  const finalFee = b ? Math.round(b.fee * feeMul) : 0;
  const feeText = `${wallet.fmt(finalFee)}`;
  const baseFeeText = b ? `${wallet.fmt(b.fee)}` : "";

  // 场景设定 —— 供 AI 扮演该负责人（带其专属人设）；本地脚本作后备
  const sys = (): string =>
    `你在扮演华语影视/娱乐行业的负责人「${b?.producer}」（隶属${b?.loc}）。` +
    `人物性格：${persona?.tone ?? "专业、克制而有压迫感"}。` +
    `艺人未能在合同约定的档期内完成《${b?.gigName}》（${b?.gigType}），构成违约，已被迫换人并造成损失。` +
    `你现在登门追责，既表达失望也明确要求对方承担违约责任（违约金约${feeText}）。务必贴合上述性格说话。` +
    `每次只说 1–3 句中文，像真实对话，不要旁白、不要括号动作、不要 JSON、不要列表。可以就艺人的解释适度回应，但立场不松动。`;

  const opener = b
    ? `${b.producer}：${persona ? persona.opener(b.gigName) : `《${b.gigName}》你没能按约定拍完，损失不小。这事，你打算怎么给我一个交代？`}`
    : "";

  // 本地脚本后备（未配置 AI）：按各负责人的专属台词轮换
  const localReply = (): string => {
    const pool = persona?.lines ?? [
      "话说得再漂亮，档期也回不来了。合同白纸黑字，违约金你得认。",
      "我理解你有你的难处，但这行靠的是信誉。这次的窟窿，得你来补。",
      "行业里传得快。想把影响压到最小，就痛快点把违约的事了结了吧。",
    ];
    return `${b?.producer}：${pool[lines.filter((l) => l.who === "me").length % pool.length]}`;
  };

  // 首次挂载：给出开场白
  useEffect(() => {
    if (!b || startedRef.current) return;
    startedRef.current = true;
    setLines([{ who: "producer", text: opener }]);
  }, [b, opener]);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
  }, [lines, thinking]);

  if (!b) return null;

  const send = async () => {
    const text = input.trim();
    if (!text || thinking) return;
    const nextLines: Line[] = [...lines, { who: "me", text }];
    setLines(nextLines);
    setInput("");
    setAttitude((a) => Math.max(-4, Math.min(4, a + scoreAttitude(text)))); // 全程态度累加，封顶 ±4（对应违约金 ±20%）

    if (!ai) {
      setTimeout(() => setLines((ls) => [...ls, { who: "producer", text: localReply() }]), 350);
      return;
    }
    setThinking(true);
    const history: ChatMsg[] = [
      { role: "system", content: sys() },
      ...nextLines.map((l): ChatMsg => ({ role: l.who === "me" ? "user" : "assistant", content: l.text })),
    ];
    try {
      let acc = "";
      await streamChat(cfg, history, (_c, full) => {
        acc = full;
      });
      const clean = acc.replace(/```[\s\S]*?```/g, "").trim() || localReply();
      setLines((ls) => [...ls, { who: "producer", text: clean.startsWith(b.producer) ? clean : `${b.producer}：${clean}` }]);
    } catch {
      setLines((ls) => [...ls, { who: "producer", text: localReply() }]);
    } finally {
      setThinking(false);
    }
  };

  return (
    <Modal title="违约追责 · 制片人登门" onClose={() => {}}>
      <div className="mb-3 rounded-lg border border-danger/40 bg-danger/5 px-3 py-2.5 text-[12.5px] leading-relaxed text-ink">
        你未能在约定档期内拍完 <b className="text-danger">《{b.gigName}》</b>，构成违约。
        <b className="text-danger">{b.producer}</b>（{b.loc}）找上门来。你可以与其周旋几句，但最终须赔付
        <b className="text-danger"> 违约金 {feeText}</b> 才能了结此事。
        {finalFee !== b.fee && (
          <span className="ml-1 text-ink-soft">
            （原为 <s>{baseFeeText}</s>，
            {finalFee < b.fee ? "态度诚恳，已酌减" : "言语顶撞，已加重"}）
          </span>
        )}
      </div>

      <div ref={bodyRef} className="mb-3 max-h-[38vh] space-y-2 overflow-y-auto pr-0.5">
        {lines.map((l, i) => (
          <div key={i} className={`flex ${l.who === "me" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed ${
                l.who === "me"
                  ? "rounded-br-sm bg-coral text-paper-2"
                  : "rounded-bl-sm bg-paper-2 text-ink"
              }`}
            >
              {l.text}
            </div>
          </div>
        ))}
        {thinking && <p className="pl-1 text-[12px] text-ink-soft">{b.producer}正在斟酌措辞……</p>}
      </div>

      <div className="flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          rows={2}
          placeholder="回应他几句（Enter 发送）"
          className="min-w-0 flex-1 resize-none rounded-lg border border-line bg-paper px-3 py-2 text-[13px] text-ink outline-none placeholder:text-ink-soft/60 focus:border-coral/60"
        />
        <button
          onClick={() => void send()}
          disabled={!input.trim() || thinking}
          className="shrink-0 rounded-lg bg-ink/80 px-3 py-2 text-[12.5px] font-semibold text-paper-2 transition hover:brightness-110 disabled:opacity-40"
        >
          回话
        </button>
      </div>

      <button
        onClick={() => resolveBreach(finalFee)}
        className="mt-3 w-full rounded-lg bg-danger py-2.5 text-[13px] font-semibold text-paper-2 transition hover:brightness-110"
      >
        赔付违约金 {feeText} 并了结
      </button>
      <p className="mt-1.5 text-center text-[11px] text-ink-soft">违约会计入你的从业记录，并折损负责人信任。</p>
    </Modal>
  );
}
