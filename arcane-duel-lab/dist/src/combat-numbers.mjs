export function integerDamage(value){return Number.isFinite(value)&&value>0?Math.max(1,Math.round(value)):0;}
export function damageText(actual,label){const n=integerDamage(actual);if(!label)return String(n);const s=String(label);return /^\d+(?:\.\d+)?/.test(s)?s.replace(/^\d+(?:\.\d+)?/,String(n)):n+' '+s;}
