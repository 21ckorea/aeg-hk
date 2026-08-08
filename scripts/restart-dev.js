const { execFileSync, spawn } = require('child_process');
const path = require('path');

const port = 3000;

function listeningPids() {
  try {
    return [...new Set(
      execFileSync('lsof', ['-ti4TCP:' + port, '-sTCP:LISTEN'], { encoding: 'utf8' })
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map(Number)
    )];
  } catch (error) {
    if (error.status === 1) return [];
    throw error;
  }
}

function wait(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function freePort() {
  const pids = listeningPids();
  if (!pids.length) return;

  console.log(`포트 ${port}에서 실행 중인 개발 서버를 종료합니다. (PID: ${pids.join(', ')})`);
  pids.forEach(pid => {
    try { process.kill(pid, 'SIGTERM'); } catch (error) {
      if (error.code !== 'ESRCH') throw error;
    }
  });

  for (let attempt = 0; attempt < 10; attempt += 1) {
    await wait(150);
    if (!listeningPids().length) return;
  }

  const remainingPids = listeningPids();
  console.log(`포트 ${port}가 해제되지 않아 강제 종료합니다. (PID: ${remainingPids.join(', ')})`);
  remainingPids.forEach(pid => {
    try { process.kill(pid, 'SIGKILL'); } catch (error) {
      if (error.code !== 'ESRCH') throw error;
    }
  });

  for (let attempt = 0; attempt < 10; attempt += 1) {
    await wait(150);
    if (!listeningPids().length) return;
  }
  throw new Error(`포트 ${port}가 계속 사용 중입니다. 다른 프로그램이 즉시 다시 실행하고 있을 수 있습니다.`);
}

async function restart() {
  await freePort();
  console.log(`http://localhost:${port} 에서 개발 서버를 시작합니다.`);
  console.log('화면은 로컬에서 실행하고 API는 Vercel 서버를 사용합니다.');
  const child = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit',
    env: { ...process.env, PORT: String(port) }
  });
  child.on('exit', code => process.exit(code ?? 0));
}

restart().catch(error => {
  console.error(`재시작에 실패했습니다: ${error.message}`);
  process.exit(1);
});
