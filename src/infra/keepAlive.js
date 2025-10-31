function startKeepAlive(intervalMs = 12 * 60 * 1000) { // ~12 min
  if (!process.env.APP_BASE_URL) {
    console.warn('KeepAlive: APP_BASE_URL ausente, keepalive inativo.');
    return { stop() {} };
  }

  let timer = setInterval(async () => {
    try {
      const url = `${process.env.APP_BASE_URL.replace(/\/+$/, '')}/health`;
      await fetch(url, { cache: 'no-store' });
      // console.log('KeepAlive ping ->', url);
    } catch (_) {
      // silencioso: não queremos crashar o processo por causa de ping
    }
  }, intervalMs);

  console.log('KeepAlive ativo, a pingar:', process.env.APP_BASE_URL);
  return { stop() { clearInterval(timer); } };
}

module.exports = { startKeepAlive };
