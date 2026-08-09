import {
  readStages, readTalents, threat, stoneHit, tierOf,
  STONE_TIER_BY_STAGE, pad, padEnd,
} from './lib.mjs'

const stages = readStages()
const stoneHp = readTalents()
  .find((t) => t.name.includes('生命上限'))
  .levels.map((l) => l.values[0])

console.log('关卡难度曲线\n')
console.log('关 敌级  到达率  流量威胁   增幅   地脉  单次  能挨  精英%  开局8秒  首个精英')
console.log('─'.repeat(84))

let prev = null
const growth = []

for (const [i, s] of stages.entries()) {
  const flow = s.flowThreat
  const inc = prev ? (flow / prev - 1) * 100 : null
  if (inc !== null) growth.push(inc)

  const stone = stoneHp[STONE_TIER_BY_STAGE[i]]
  const hit = stoneHit(s.enemyLevel)

  let eliteRate = 0
  let firstElite = Infinity
  let openCount = 0
  for (const p of s.points) {
    const total = p.weights.reduce((a, b) => a + b, 0)
    let w = 0
    p.entities.forEach((e, k) => {
      const t = tierOf(e)
      if (t === '精英' || t === 'BOSS级') w += p.weights[k]
    })
    eliteRate += p.rate * (w / total)
    if (w > 0 && p.delay < firstElite) firstElite = p.delay
    if (p.delay < 8) openCount += p.rate * (8 - p.delay)
  }

  console.log(
    [
      pad(i + 1, 2), pad(s.enemyLevel, 4), pad(s.rate.toFixed(3), 7),
      pad(flow.toFixed(2), 8),
      pad(inc === null ? '—' : `${inc > 0 ? '+' : ''}${inc.toFixed(0)}%`, 7),
      pad(stone, 6), pad(Math.round(hit), 5),
      pad((stone / hit).toFixed(1), 5),
      pad(`${((eliteRate / s.rate) * 100).toFixed(0)}%`, 6),
      pad(`${openCount.toFixed(1)}只`, 8),
      pad(firstElite === Infinity ? '无' : `${firstElite}s`, 9),
    ].join(' '),
  )
  prev = flow
}

console.log('\n增幅区间 %s%% ~ %s%%   最陡在关%d',
  Math.min(...growth).toFixed(0), Math.max(...growth).toFixed(0),
  growth.indexOf(Math.max(...growth)) + 2)

console.log('\n设计红线检查')
const problems = []
for (const [i, s] of stages.entries()) {
  const stone = stoneHp[STONE_TIER_BY_STAGE[i]]
  const hits = stone / stoneHit(s.enemyLevel)
  if (hits < 2) problems.push(`关${i + 1} 地脉只能挨 ${hits.toFixed(1)} 下（应 ≥2）`)

  const early = s.points.filter((p) => p.delay < 8)
  if (early.length > 1) problems.push(`关${i + 1} 开局8秒有 ${early.length} 个刷怪点（应为1个）`)

  let firstElite = Infinity
  const eliteSpots = []
  for (const p of s.points) {
    const w = p.entities.reduce((acc, e, k) =>
      acc + (['精英', 'BOSS级'].includes(tierOf(e)) ? p.weights[k] : 0), 0)
    if (w > 0) { eliteSpots.push(p.index); if (p.delay < firstElite) firstElite = p.delay }
    if (p.entities.some((e) => ['449', '450'].includes(String(e).slice(-3))))
      problems.push(`关${i + 1} ${p.index} 把 BOSS级单位当小怪刷`)
  }
  if (firstElite < 10 && firstElite !== Infinity)
    problems.push(`关${i + 1} 精英在 ${firstElite}s 就出现（应 ≥10s）`)

  if (!s.boss.isBoss || s.boss.isBoss === 'False')
    problems.push(`关${i + 1} BOSS点的「是否BOSS」为 False`)
  if (!s.boss.weights.length)
    problems.push(`关${i + 1} BOSS 权重列表为空`)
}

console.log(problems.length ? problems.map((p) => '  ✗ ' + p).join('\n') : '  全部通过')

const bosses = stages.map((s) => String(s.boss.entity).slice(-3))
console.log('\nBOSS 分配:', bosses.join(' '))
for (let i = 1; i < bosses.length; i++)
  if (bosses[i] === bosses[i - 1]) console.log(`  ⚠ 关${i} 与关${i + 1} BOSS 重复 (${bosses[i]})`)
