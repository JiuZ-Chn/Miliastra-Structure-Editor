import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'))

const rows = fs
  .readFileSync(path.join(root, 'reference/等级倍率.csv'), 'utf8')
  .trim()
  .split(/\r?\n/)
  .slice(1)
  .map((line) => line.split(',').map(Number))

export const hp = (level) => rows[level - 1][1]
export const atk = (level) => rows[level - 1][2]
export const def = (level) => rows[level - 1][3]

/** 敌方威胁：生命与攻击的乘积，以敌方8级为基准 */
export const threat = (level) => (hp(level) / hp(8)) * (atk(level) / atk(8))

/** 我方战斗功率：攻击乘区 × 生命乘区，以1级无专精为基准 */
export const power = (level, atkBonusPercent = 0, hpBonusPercent = 0) =>
  ((atk(level) / atk(1)) * (1 + atkBonusPercent / 100)) *
  ((hp(level) / hp(1)) * (1 + hpBonusPercent / 100))

/** 敌方单次打地脉的伤害，锚定实测「敌6级打150」 */
export const stoneHit = (enemyLevel) => 150 * (atk(enemyLevel) / atk(6))

/** 单位1级实际生命（实测值） */
export const UNIT_BASE_HP = { 打手: 219, 火箭: 175, 火斧: 439 }

/** 天赋树各曲线，改数值时同步这里 */
export const RANK_LEVELS = [1, 4, 9, 14, 20, 29, 40]
export const RANK_COST = [0, 120, 220, 380, 620, 1000, 1600]
export const DMG_BONUS = [0, 20, 45, 75, 120, 180, 260, 380, 550, 800]
export const DMG_COST = [0, 75, 125, 200, 300, 450, 650, 900, 1250, 1700]
export const HP_BONUS = [0, 10, 20, 30, 40, 50, 60, 75, 90, 110]
export const HP_COST = [0, 50, 75, 125, 200, 300, 450, 650, 900, 1250]

/** 地脉生命对应的天赋档位，索引为关卡序号 */
export const STONE_TIER_BY_STAGE = [0, 0, 1, 1, 2, 2, 3, 4, 5, 6]

/** 关卡首通奖励 */
export const STAGE_REWARD = [125, 150, 180, 210, 250, 300, 360, 430, 510, 650]

export const MOB_TIER = {
  小怪: [438, 439, 440, 445, 447, 451, 453, 458],
  略强: [446, 448, 452, 454],
  精英: [441, 442, 443, 455, 456, 457, 459],
  BOSS级: [444, 449, 450],
}

export const tierOf = (entityId) => {
  const n = Number(String(entityId).slice(-3))
  return Object.keys(MOB_TIER).find((k) => MOB_TIER[k].includes(n)) ?? '未分类'
}

/** 展开关卡配置为易用结构（关卡是 StructList，比天赋树少一层嵌套） */
export function readStages() {
  const doc = readJson('config/关卡配置.json')
  return doc.value[0].value.value.map((entry) => {
    const fields = entry.value.value
    const points = fields[1].value.value.map((p) => {
      const v = p.value.value
      return {
        index: v[0].value,
        delay: Number(v[2].value),
        interval: Number(v[3].value),
        chance: Number(v[4].value),
        cap: Number(v[5].value),
        entities: v[7].value,
        weights: v[8].value.map(Number),
        get rate() {
          return this.chance / this.interval
        },
      }
    })
    const bossField = fields[2].value.value
    return {
      name: fields[0].value,
      enemyLevel: Number(fields[3].value),
      points,
      boss: { entity: bossField[7].value[0], isBoss: bossField[1].value, weights: bossField[8].value },
      get rate() {
        return this.points.reduce((sum, p) => sum + p.rate, 0)
      },
      get flowThreat() {
        return this.rate * threat(this.enemyLevel)
      },
    }
  })
}

/** 展开天赋树为易用结构 */
export function readTalents() {
  const doc = readJson('config/天赋树.json')
  return doc.value[0].value.value.map((entry) => {
    const f = entry.value.value.value
    return {
      name: f[0].value,
      summary: f[1].value,
      maxLevel: Number(f[3].value),
      levels: f[4].value.value.map((x) => {
        const v = x.value.value
        const cost = v[2].value.value.map((y) => Number(y.value))
        return {
          text: v[0].value.replace(/<[^>]+>/g, ''),
          values: v[1].value.map(Number),
          mora: cost[0],
          energy: cost[1],
          crystal: cost[2],
        }
      }),
    }
  })
}

export const pad = (s, n) => String(s).padStart(n)
export const padEnd = (s, n) => String(s).padEnd(n)
