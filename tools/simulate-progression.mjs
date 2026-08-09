import {
  readStages, power, threat,
  RANK_LEVELS, RANK_COST, DMG_BONUS, DMG_COST, HP_BONUS, HP_COST, STAGE_REWARD,
  pad, padEnd,
} from './lib.mjs'

// 重试farm系数与主力单位投入占比，按实测校准
// 实测：通关前5关累计获得约 1112 能量（基础 915），其中约 36~55% 进入主力单位
const FARM = 1.2
const SHARE = 0.55

/**
 * greedy=true  贪心：有钱就买当前性价比最高的，绝不攒钱（多数玩家的真实行为）
 * greedy=false 攒钱：优先攒够等阶，买不起就存着（最优解，但玩家不可能预知）
 */
function simulate(greedy) {
  let rank = 0, dmg = 0, life = 0, bank = 0
  const trace = []

  for (const reward of STAGE_REWARD) {
    bank += reward * FARM * SHARE
    for (;;) {
      const base = power(RANK_LEVELS[rank], DMG_BONUS[dmg], HP_BONUS[life])
      const options = []
      if (rank < 6 && RANK_COST[rank + 1] <= bank)
        options.push([(power(RANK_LEVELS[rank + 1], DMG_BONUS[dmg], HP_BONUS[life]) - base) / RANK_COST[rank + 1], 'rank', RANK_COST[rank + 1]])
      if (dmg < 9 && DMG_COST[dmg + 1] <= bank)
        options.push([(power(RANK_LEVELS[rank], DMG_BONUS[dmg + 1], HP_BONUS[life]) - base) / DMG_COST[dmg + 1], 'dmg', DMG_COST[dmg + 1]])
      if (life < 9 && HP_COST[life + 1] <= bank)
        options.push([(power(RANK_LEVELS[rank], DMG_BONUS[dmg], HP_BONUS[life + 1]) - base) / HP_COST[life + 1], 'life', HP_COST[life + 1]])

      if (!options.length) break
      if (!greedy && rank < 6 && RANK_COST[rank + 1] > bank) break // 攒钱：等得起就等

      options.sort((a, b) => b[0] - a[0])
      const [, kind, cost] = options[0]
      if (kind === 'rank') rank++
      else if (kind === 'dmg') dmg++
      else life++
      bank -= cost
    }
    trace.push({
      power: power(RANK_LEVELS[rank], DMG_BONUS[dmg], HP_BONUS[life]),
      config: `${RANK_LEVELS[rank]}级/伤${DMG_BONUS[dmg]}/血${HP_BONUS[life]}`,
      bank: Math.round(bank),
    })
  }
  return trace
}

const stages = readStages()
const flow = stages.map((s) => s.flowThreat)
const greedy = simulate(true)
const saver = simulate(false)

console.log('两种玩法的余裕比对比')
console.log('（贪心 = 有钱就花，多数玩家的真实行为；攒钱 = 优先攒等阶，理论最优）\n')
console.log('关  流量威胁   贪心配置           余裕比   攒钱配置           余裕比')
console.log('─'.repeat(74))

for (let i = 0; i < stages.length; i++) {
  const gr = greedy[i].power / flow[i]
  const sr = saver[i].power / flow[i]
  console.log([
    pad(i + 1, 2), pad(flow[i].toFixed(2), 9),
    '  ' + padEnd(greedy[i].config, 18),
    pad(gr.toFixed(2), 6) + (gr < 1.4 ? ' 紧' : '   '),
    ' ' + padEnd(saver[i].config, 18),
    pad(sr.toFixed(2), 6),
  ].join(' '))
}

const gRatios = greedy.map((g, i) => g.power / flow[i])
const sRatios = saver.map((s, i) => s.power / flow[i])

console.log('\n贪心最低余裕比  %s  %s', Math.min(...gRatios).toFixed(2),
  Math.min(...gRatios) < 1.4 ? '← 低于1.4，会卡关' : '← 可通过')
console.log('攒钱区间        %s ~ %s', Math.min(...sRatios).toFixed(2), Math.max(...sRatios).toFixed(2))
console.log('两路线差距      %s 倍', (Math.max(...sRatios) / Math.min(...gRatios)).toFixed(1))

console.log('\n等阶成本 vs 单关可投入预算')
console.log('（等阶成本若超过单关预算，贪心玩家永远攒不到，会被锁在低等阶）\n')
const budgets = STAGE_REWARD.map((r) => r * FARM * SHARE)
for (let k = 1; k <= 6; k++) {
  const at = budgets.findIndex((b) => b >= RANK_COST[k])
  console.log('  等阶L%d (%s)  %s', k, pad(RANK_COST[k], 4),
    at < 0 ? '十关内单关收入永远不够 ✗' : `最早关${at + 1}可单关买下`)
}
