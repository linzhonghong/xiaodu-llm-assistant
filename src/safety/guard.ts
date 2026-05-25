import { includesAny } from '../utils/text.js';

export const highRiskKeywords = ['门锁', '锁', '安防', '报警', '摄像头', '燃气', '煤气', '插座', '电热器', '热水器', '烤箱'];

export function isHighRiskControl(query: string): boolean {
  const hasRiskKeyword = includesAny(query, highRiskKeywords);
  const hasControlWord = includesAny(query, ['打开', '开启', '关掉', '关闭', '启动', '停止']);
  return hasRiskKeyword && hasControlWord;
}
