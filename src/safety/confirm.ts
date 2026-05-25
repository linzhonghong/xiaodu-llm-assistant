export function isConfirmationQuery(query: string): boolean {
  return ['确认', '是的', '是', '继续', '确定', '可以'].includes(query.trim());
}

export function isRejectionQuery(query: string): boolean {
  return ['取消', '不用', '不要', '算了', '否', '不是'].includes(query.trim());
}
