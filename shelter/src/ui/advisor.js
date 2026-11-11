// 老周的提醒：根据当前局面给一句话，不讲术语，只说眼前的事。
import { RULES, production, expenses, buildCost, weeksToWinter, isWinter, depletion } from '../engine/engine.js';
import { chapterById } from '../data/chapters.js';

export function runway(state) {
  const net = production(state) - expenses(state);
  return net >= 0 ? Infinity : Math.floor(state.supplies / -net);
}

export function advise(state) {
  const made = production(state);
  const used = expenses(state);
  const chapter = chapterById(state.chapter);
  const producers = state.facilities.filter((id) => id !== 'wall' && id !== 'truck').length;
  const toWinter = weeksToWinter(state);
  const left = runway(state);

  if (state.injuredWeeks > 0) {
    return `你得再躺 ${state.injuredWeeks} 周。这几周只有消耗，没有进账，${left === Infinity ? '好在自产够吃' : left < state.injuredWeeks ? '存粮撑不到你伤好，得想办法' : `存粮还能撑 ${left} 周`}。`;
  }
  if (state.debt > 0) {
    const next = state.debt + Math.ceil(state.debt * RULES.interest);
    return `欠粮 ${state.debt}，过完这周就是 ${next}。手里有余粮，先还它。`;
  }
  if (left <= 1) return '仓库快见底了。这周要是空手而归，今晚就有人挨饿。';
  if (producers === 0 && state.supplies >= buildCost(state, 'farm')) {
    return '存粮够建一座水培农场了。建好以后它每周自己产 4 份，不用你出门。';
  }
  if (producers === 0 && state.week >= 6) {
    return `已经搜了 ${state.week - 1} 周。只靠出门，哪天躺下了，仓库也就空了。`;
  }
  if (toWinter !== null && toWinter > 0 && toWinter <= 2) {
    return `还有 ${toWinter} 周入冬。到时候搜刮变难、农场减产，多留点口粮。`;
  }
  if (isWinter(state) && chapter.facilities.some((id) => state.supplies >= buildCost(state, id) + used)) {
    return '寒冬里别人撑不住，设备打七折。手里有余粮的人，这时候买最划算。';
  }
  if (made >= used && state.debt === 0) return '自产已经够吃了。再过完这一周，就不用出门了。';
  if (made / used >= 0.7) return '自产快够吃了，再添一座设施就差不多。';
  if (state.supplies > RULES.spoilFree + 15) {
    return `存粮超过 ${RULES.spoilFree} 的部分每周会坏掉一些。囤着不动，不如拿去建点什么。`;
  }
  if (depletion(state) < 0.9) return '附近的废墟越搜越空，每趟带回来的东西在变少。得快点让避难所自己产粮。';
  if (state.week === 1) return `这里每周要吃掉 ${used} 份物资。先出门找点吃的。`;
  if (left <= 3) return `不出门的话，存粮只够 ${left} 周。`;
  return null;
}
