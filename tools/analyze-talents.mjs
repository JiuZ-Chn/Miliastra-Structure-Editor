import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readTalents, pad, padEnd } from './lib.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const talents = readTalents()

console.log('天赋树总览\n')
console.log('天赋                      最高等级   地脉能量   地脉结晶')
console.log('─'.repeat(58))

let totalEnergy = 0, totalCrystal = 0, totalLevels = 0
for (const t of talents) {
  const energy = t.levels.reduce((a, l) => a + l.energy, 0)
  const crystal = t.levels.reduce((a, l) => a + l.crystal, 0)
  const mora = t.levels.reduce((a, l) => a + l.mora, 0)
  totalEnergy += energy
  totalCrystal += crystal
  totalLevels += t.levels.length
  console.log(padEnd(t.name, 26) + pad(t.maxLevel, 6) + pad(energy.toLocaleString(), 11) + pad(crystal, 11) +
    (mora ? `   ⚠ 含摩拉消耗 ${mora}` : ''))
}
console.log('─'.repeat(58))
console.log(padEnd('合计', 26) + pad('', 6) + pad(totalEnergy.toLocaleString(), 11) + pad(totalCrystal, 11))
console.log('\n共 %d 条天赋，%d 个等级档', talents.length, totalLevels)

console.log('\n\n一致性检查')
const problems = []

for (const t of talents) {
  if (t.levels.length !== t.maxLevel + 1)
    problems.push(`${t.name}: 最高等级 ${t.maxLevel} 但有 ${t.levels.length} 个档位`)

  t.levels.forEach((l, i) => {
    if (i > 0 && l.energy === 0 && l.crystal === 0 && l.mora === 0)
      problems.push(`${t.name} L${i}: 非零等级但完全免费`)
    if (l.mora > 0)
      problems.push(`${t.name} L${i}: 永久天赋不应消耗摩拉（摩拉是局内货币）`)
  })

  const energies = t.levels.map((l) => l.energy)
  for (let i = 2; i < energies.length; i++)
    if (energies[i] < energies[i - 1])
      problems.push(`${t.name} L${i}: 成本 ${energies[i]} 低于上一档 ${energies[i - 1]}`)
}

// 单位专精三份重复的稀释检查
const dmgTalents = talents.filter((t) => t.name.includes('伤害提升') && !t.name.includes('地脉'))
if (dmgTalents.length > 1) {
  const curves = dmgTalents.map((t) => t.levels.map((l) => l.values[0]).join(','))
  if (new Set(curves).size === 1) {
    const extra = dmgTalents.slice(1).reduce((a, t) => a + t.levels.reduce((s, l) => s + l.energy, 0), 0)
    problems.push(`${dmgTalents.length} 条伤害专精曲线完全相同，其中 ${extra.toLocaleString()} 能量属于重复付费（广度惩罚）`)
  }
}

console.log(problems.length ? problems.map((p) => '  ⚠ ' + p).join('\n') : '  全部通过')

console.log('\n\n文档同步检查')
const mdPath = path.join(root, 'docs/天赋数值与消耗一览.md')
if (!fs.existsSync(mdPath)) {
  console.log('  未找到文档')
} else {
  const lines = fs.readFileSync(mdPath, 'utf8').split(/\r?\n/)
  const byName = new Map(talents.map((t) => [t.name, t]))
  let current = null, checked = 0, mismatched = 0

  for (const line of lines) {
    const heading = line.match(/^### (.+)$/)
    if (heading) { current = byName.has(heading[1]) ? byName.get(heading[1]) : null; continue }
    if (!current) continue
    const row = line.match(/^\|\s*(\d+)\s*\|.*\|\s*([\d,]+)\s*\|\s*([\d,]+)\s*\|\s*$/)
    if (!row) continue
    const level = current.levels[Number(row[1])]
    if (!level) continue
    checked++
    const energy = Number(row[2].replace(/,/g, ''))
    const crystal = Number(row[3].replace(/,/g, ''))
    if (energy !== level.energy || crystal !== level.crystal) {
      mismatched++
      console.log(`  ✗ ${current.name} L${row[1]}: 文档 ${energy}/${crystal}，配置 ${level.energy}/${level.crystal}`)
    }
  }
  console.log(mismatched ? `\n  共 ${mismatched} 处不一致` : `  与配置一致（核对 ${checked} 行）`)
}
