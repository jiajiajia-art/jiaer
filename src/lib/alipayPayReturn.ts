export function parseAlipayReturnSearch(search: string):
  { handled: false } | { handled: true; outTradeNo: string; nextSearch: string } {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  if (params.get('alipayPay') !== '1') return { handled: false };
  const outTradeNo = String(params.get('outTradeNo') || '').trim();
  for (const key of ['alipayPay', 'outTradeNo', 'out_trade_no', 'trade_no', 'total_amount',
    'timestamp', 'sign', 'sign_type', 'charset', 'app_id', 'method', 'version', 'seller_id',
    'auth_app_id', 'notify_id', 'notify_type', 'notify_time', 'buyer_id', 'buyer_logon_id',
    'gmt_create', 'gmt_payment', 'gmt_close', 'fund_bill_list', 'invoice_amount',
    'receipt_amount', 'buyer_pay_amount', 'point_amount', 'trade_status', 'subject',
    'body', 'store_id', 'terminal_id', 'passback_params']) params.delete(key);
  return { handled: true, outTradeNo, nextSearch: params.toString() };
}
