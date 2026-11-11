import type { GameState } from "./types";
import type { LifeGrade } from "../game/grade";

/* 未配置 AI / 生成失败时的本地后记：用本局真实履历、关系、剧情志拼出分阶段、首尾呼应、不少于 1000 字的生平记事 */
export function localEpilogue(
  g: GameState,
  rank: { title: string; body: string },
  grade: LifeGrade,
  firstScenes: string[],
  lastScenes: string[],
  journal: string[],
): string {
  const name = g.player.name;
  const hist = g.player.history ?? [];
  const early = hist.slice(0, Math.ceil(hist.length / 3));
  const mid = hist.slice(Math.ceil(hist.length / 3), Math.ceil((hist.length * 2) / 3));
  const late = hist.slice(Math.ceil((hist.length * 2) / 3));
  const list = (h: typeof hist) => h.map((x) => `「${x.title}」——${x.detail}`).join("；");
  const close = [...g.npcs].sort((a, b) => b.affinity - a.affinity).slice(0, 3);
  const first = firstScenes[0];
  const best = grade.items.reduce((a, b) => (b.score > a.score ? b : a));
  const worst = grade.items.reduce((a, b) => (b.score < a.score ? b : a));

  const paras = [
    `【${name}·生平记事】`,
    `很多年以后，人们提起${name}，总会先想起那句评语——${rank.title}。${rank.body}可若是问她自己，她大概只会笑一笑，说：一切都要从那个再普通不过的开始讲起。${first ? `那时的她还记得，${first}……` : "那时的她，什么都还没有，只有一点不肯熄灭的心气。"}`,
    `初出茅庐的日子是最难的，也是最亮的。${g.player.description ? `她是那样一个人：${g.player.description}。` : ""}${early.length ? `那段时间里，她经历了${list(early)}。` : "那段时间里，她一次次被拒之门外，又一次次重新敲门。"}没有人知道她会走到哪里，连她自己也不知道，她只知道，不能停。`,
    `后来是漫长的打拼。${mid.length ? `${list(mid)}，` : ""}每一步都踩在不确定上。有过深夜一个人回家的路，有过被误解时咬着嘴唇的沉默，也有过某个瞬间突然被人看见的、几乎让她落泪的温暖。${journal.length ? `那些被她记在心里的片段——${journal.slice(0, 5).join("、")}——后来都成了她反复回想的章节。` : ""}`,
    `高光与低谷总是结伴而来。回头细算，她这一生最被人称道的是${best.label}（${best.detail}），而最让她遗憾的，大约是${worst.label}（${worst.detail}）。${late.length ? `后来的岁月里，${list(late)}。` : ""}她渐渐明白，所谓圆满，从来不是什么都得到，而是得到的、失去的，都能坦然地说一声「我认了」。`,
    close.length
      ? `在所有人里，她最常想起的是${close.map((n) => `${n.name}（${n.relation}）`).join("、")}。${close[0].name}陪她走过的那些日子，后来被她写进了日记的最后几页；有些话当时没说出口，后来也就不必说了——懂的人，一直都懂。`
      : "她这一路走得孤独，可每当想起途中那些短暂交汇的人，心里总是暖的。",
    `至于后传，人们知道的并不多。${lastScenes.length ? `最后被记住的画面，是${lastScenes[lastScenes.length - 1]}。` : ""}有人说她后来离开了喧嚣，住进一座安静的小城；有人说她仍然常常出现在年轻人的故事里，作为一句鼓励、一个榜样、一段被反复转述的传说。她的人生评级是「${grade.grade}」——${grade.verdict}，这是旁人给她的分数；而她给自己的，从来只有一句：认真活过。`,
    `暮年回望，窗外的光一寸寸移过书页。她又想起了最初的那一天，${first ? `想起${first.slice(0, 40)}……` : "想起那个两手空空却满怀期待的自己。"}原来兜兜转转这么多年，那个人一直都在，只是换了一种方式，陪她走到了这里。${name}合上了这本书，轻声说：谢谢你，陪我走完这一程。`,
  ];
  let text = paras.join("\n\n");
  // 素材很少时补一段，保证不少于 1000 字
  while (text.replace(/\s/g, "").length < 1000) {
    text += `\n\n她偶尔也会想，如果当初换一条路走，会不会有不一样的风景。可每一次想到最后，她都会摇摇头——那些眼泪、那些等待、那些在黑暗里独自练习的夜晚，少了任何一样，都不会有今天的${name}。人生没有标准答案，只有一份认真交出去的答卷。而这一份答卷上写着的，是她全部的勇气、温柔与不肯认输。`;
  }
  return text;
}
